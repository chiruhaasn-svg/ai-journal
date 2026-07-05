from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, SessionLocal
from ai_service import analyze_entry

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
    db_entry = models.JournalEntry(
        content=entry.content,
        mood=analysis.get("mood"),
        summary=analysis.get("summary"),
        tags=analysis.get("tags"),
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@app.get("/entries", response_model=List[schemas.EntryResponse])
def get_entries(db: Session = Depends(get_db)):
    return db.query(models.JournalEntry).order_by(models.JournalEntry.created_at.desc()).all()

@app.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}