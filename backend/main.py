from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import date, timedelta

import models
import schemas
from database import engine, SessionLocal
from ai_service import analyze_entry, run_coach_action, answer_journal_question
from embeddings import get_embedding
from vector_store import get_vec_db
from auth import router as auth_router, active_sessions
from transcribe_router import router as transcribe_router

models.Base.metadata.create_all(bind=engine)

DEFAULT_TEMPLATES = [
    ("Gratitude", "Today I am grateful for...\n\n1. \n2. \n3. \n\nSomething small that made me smile today:"),
    ("Daily Reflection", "What happened today?\n\nHow did I feel throughout the day?\n\nWhat did I learn?\n\nWhat would I do differently tomorrow?"),
    ("Goal Check-in", "My current goal:\n\nProgress this week:\n\nWhat's working:\n\nWhat's blocking me:\n\nNext step I will take:"),
    ("Dream Journal", "Dream summary:\n\nKey images or symbols:\n\nEmotions in the dream:\n\nWhat might this dream be telling me?"),
    ("Letting Go / Venting", "What's weighing on me right now:\n\nWhy it bothers me:\n\nWhat I wish I could say:\n\nWhat I'm ready to release:"),
    ("Future Self Letter", "Dear future me,\n\nRight now I am...\n\nI hope by the time you read this...\n\nRemember that...\n\nWith love,\nPast me"),
]

def seed_templates(db: Session):
    if db.query(models.Template).count() == 0:
        for name, prompt_text in DEFAULT_TEMPLATES:
            db.add(models.Template(name=name, prompt_text=prompt_text))
        db.commit()

def run_migrations():
    import sqlite3
    conn = sqlite3.connect("journal.db")
    auth_cols = {row[1] for row in conn.execute("PRAGMA table_info(auth_settings)")}
    if "display_name" not in auth_cols:
        conn.execute("ALTER TABLE auth_settings ADD COLUMN display_name TEXT")
    entry_cols = {row[1] for row in conn.execute("PRAGMA table_info(entries)")}
    if "bookmarked" not in entry_cols:
        conn.execute("ALTER TABLE entries ADD COLUMN bookmarked BOOLEAN DEFAULT 0")
    conn.commit()
    conn.close()

app = FastAPI()

@app.on_event("startup")
def on_startup():
    run_migrations()
    db = SessionLocal()
    try:
        seed_templates(db)
    finally:
        db.close()

app.include_router(auth_router)
app.include_router(transcribe_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/entries", response_model=schemas.EntryResponse)
def create_entry(entry: schemas.EntryCreate, db: Session = Depends(get_db)):
    tone_row = db.query(models.AISettings).filter(models.AISettings.id == 1).first()
    tone = tone_row.tone if tone_row else "warm"

    analysis = analyze_entry(entry.content, tone=tone)
    db_entry = models.Entry(
        content=entry.content,
        mood=analysis.get("mood"),
        tags=analysis.get("tags"),
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)

    # Generate + store embedding for semantic search
    try:
        vector = get_embedding(entry.content)
        vec_db = get_vec_db()
        vec_db.execute(
            "INSERT INTO vec_entries (entry_id, embedding) VALUES (?, ?)",
            (db_entry.id, json.dumps(vector))
        )
        vec_db.commit()
        vec_db.close()
    except Exception as e:
        print(f"Embedding generation failed: {e}")  # don't block entry creation if Ollama is down

    return db_entry

@app.get("/entries", response_model=List[schemas.EntryResponse])
def get_entries(db: Session = Depends(get_db)):
    return db.query(models.Entry).order_by(models.Entry.created_at.desc()).all()

@app.get("/entries/search", response_model=List[schemas.EntryResponse])
def semantic_search(query: str, limit: int = 5, db: Session = Depends(get_db)):
    query_vector = get_embedding(query)
    vec_db = get_vec_db()
    results = vec_db.execute("""
        SELECT entry_id, distance
        FROM vec_entries
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
    """, (json.dumps(query_vector), limit)).fetchall()
    vec_db.close()

    entry_ids = [r[0] for r in results]
    if not entry_ids:
        return []
    entries = db.query(models.Entry).filter(models.Entry.id.in_(entry_ids)).all()
    return entries

@app.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


VALID_ACTIONS = {"coach", "summarize", "followup", "suggest"}

@app.post("/entries/{entry_id}/actions/{action_type}", response_model=schemas.CoachActionResponse)
def create_coach_action(entry_id: int, action_type: str, db: Session = Depends(get_db)):
    if action_type not in VALID_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid action_type. Must be one of {VALID_ACTIONS}")

    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    result_text = run_coach_action(entry.content, action_type)

    action = models.CoachAction(
        entry_id=entry_id,
        action_type=action_type,
        result=result_text,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

@app.get("/entries/{entry_id}/actions", response_model=List[schemas.CoachActionResponse])
def get_coach_actions(entry_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.CoachAction)
        .filter(models.CoachAction.entry_id == entry_id)
        .order_by(models.CoachAction.created_at.desc())
        .all()
    )

# ---- Bookmarks ----
@app.patch("/entries/{entry_id}/bookmark", response_model=schemas.EntryResponse)
def toggle_bookmark(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.Entry).filter(models.Entry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.bookmarked = not entry.bookmarked
    db.commit()
    db.refresh(entry)
    return entry

@app.get("/entries/bookmarked", response_model=List[schemas.EntryResponse])
def get_bookmarked(db: Session = Depends(get_db)):
    return (
        db.query(models.Entry)
        .filter(models.Entry.bookmarked == True)
        .order_by(models.Entry.created_at.desc())
        .all()
    )

# ---- Tags ----
@app.get("/tags", response_model=schemas.TagListResponse)
def list_tags(db: Session = Depends(get_db)):
    rows = db.query(models.Entry.tags).filter(models.Entry.tags.isnot(None)).all()
    tag_set = set()
    for (tag_str,) in rows:
        for t in tag_str.split(","):
            t = t.strip()
            if t:
                tag_set.add(t)
    return {"tags": sorted(tag_set)}

@app.get("/entries/by-tag/{tag}", response_model=List[schemas.EntryResponse])
def entries_by_tag(tag: str, db: Session = Depends(get_db)):
    return (
        db.query(models.Entry)
        .filter(models.Entry.tags.ilike(f"%{tag}%"))
        .order_by(models.Entry.created_at.desc())
        .all()
    )

# ---- Quick search (spotlight typeahead) ----
@app.get("/entries/quick-search", response_model=List[schemas.EntryResponse])
def quick_search(q: str, limit: int = 8, db: Session = Depends(get_db)):
    like = f"%{q}%"
    return (
        db.query(models.Entry)
        .filter((models.Entry.content.ilike(like)) | (models.Entry.tags.ilike(like)))
        .order_by(models.Entry.created_at.desc())
        .limit(limit)
        .all()
    )

# ---- Reviews ----
def _period_bounds(period_type: str):
    today = date.today()
    if period_type == "week":
        start = today - timedelta(days=today.weekday())
        label = f"{start.isocalendar().year}-W{start.isocalendar().week:02d}"
    elif period_type == "month":
        start = today.replace(day=1)
        label = start.strftime("%Y-%m")
    elif period_type == "year":
        start = today.replace(month=1, day=1)
        label = str(start.year)
    else:
        raise HTTPException(status_code=400, detail="period_type must be week, month, or year")
    return start, label

@app.post("/reviews", response_model=schemas.ReviewResponse)
def create_review(payload: schemas.ReviewCreate, db: Session = Depends(get_db)):
    from ai_service import generate_review_summary
    start, label = _period_bounds(payload.period_type)
    entries = (
        db.query(models.Entry)
        .filter(models.Entry.created_at >= start)
        .order_by(models.Entry.created_at.asc())
        .all()
    )
    if not entries:
        raise HTTPException(status_code=400, detail="No entries found for this period")

    entries_text = "\n\n".join(e.content for e in entries)
    summary = generate_review_summary(entries_text, label)

    review = models.Review(period_type=payload.period_type, period_label=label, content=summary)
    db.add(review)
    db.commit()
    db.refresh(review)
    return review

@app.get("/reviews", response_model=List[schemas.ReviewResponse])
def list_reviews(db: Session = Depends(get_db)):
    return db.query(models.Review).order_by(models.Review.created_at.desc()).all()

# ---- Templates ----
@app.get("/templates", response_model=List[schemas.TemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    return db.query(models.Template).order_by(models.Template.id).all()

# ---- Profile ----
@app.get("/profile", response_model=schemas.ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    row = db.query(models.AuthSettings).filter(models.AuthSettings.id == 1).first()
    return schemas.ProfileResponse(display_name=row.display_name if row else None)

@app.put("/profile", response_model=schemas.ProfileResponse)
def update_profile(payload: schemas.ProfileUpdate, db: Session = Depends(get_db)):
    row = db.query(models.AuthSettings).filter(models.AuthSettings.id == 1).first()
    if not row:
        raise HTTPException(status_code=404, detail="Account not configured")
    if payload.display_name is not None:
        row.display_name = payload.display_name.strip() or None
    db.commit()
    db.refresh(row)
    return schemas.ProfileResponse(display_name=row.display_name)

# ---- Account deletion ----
@app.delete("/account")
def delete_account(db: Session = Depends(get_db)):
    import os
    import sqlite3

    media_rows = db.query(models.Media).all()
    for m in media_rows:
        if m.file_path and os.path.isfile(m.file_path):
            os.remove(m.file_path)

    db.query(models.CoachAction).delete()
    db.query(models.EntryTag).delete()
    db.query(models.EntryEmbedding).delete()
    db.query(models.Media).delete()
    db.query(models.Entry).delete()
    db.query(models.Review).delete()
    db.query(models.MoodCheckin).delete()
    db.query(models.HabitLog).delete()
    db.query(models.Habit).delete()
    db.query(models.UserProfile).delete()
    db.query(models.AuthSettings).delete()
    db.commit()

    vec_db = sqlite3.connect("journal.db")
    vec_db.execute("DELETE FROM vec_entries")
    vec_db.commit()
    vec_db.close()

    active_sessions.clear()
    return {"ok": True}

# ---- Journal Q&A ----
@app.post("/journal/ask", response_model=schemas.JournalAskResponse)
def ask_journal(payload: schemas.JournalAskRequest, db: Session = Depends(get_db)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    query_vector = get_embedding(question)
    vec_db = get_vec_db()
    results = vec_db.execute("""
        SELECT entry_id, distance
        FROM vec_entries
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
    """, (json.dumps(query_vector), 5)).fetchall()
    vec_db.close()

    entry_ids = [r[0] for r in results]
    source_entries = []
    if entry_ids:
        source_entries = (
            db.query(models.Entry)
            .filter(models.Entry.id.in_(entry_ids))
            .all()
        )

    entries_context = "\n\n---\n\n".join(
        f"[{e.created_at.strftime('%Y-%m-%d')}] {e.content}" for e in source_entries
    )
    if not entries_context:
        entries_context = "(No relevant journal entries found.)"

    answer = answer_journal_question(entries_context, question)
    return schemas.JournalAskResponse(answer=answer, source_entries=source_entries)
