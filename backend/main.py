from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json

import models
import schemas
from database import engine, SessionLocal
from ai_service import analyze_entry
from embeddings import get_embedding
from vector_store import get_vec_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
    analysis = analyze_entry(entry.content)
    db_entry = models.Entry(
        content=entry.content,
        mood=analysis.get("mood"),
        summary=analysis.get("summary"),
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
