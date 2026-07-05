from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from database import Base

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    mood = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    tags = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)