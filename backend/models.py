from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Entry(Base):
    __tablename__ = "entries"
    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    mood = Column(String)          # existing AI output
    summary = Column(Text)         # existing AI output
    template_type = Column(String, default="freeform")  # NEW: gratitude, cbt, dream, freeform
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tags = Column(String)  # simple comma-separated string, matches ai_service.py output
    coaching_feedback = Column(Text)  # AI reflection + one actionable suggestion
    bookmarked = Column(Boolean, default=False)
    media = relationship("Media", back_populates="entry")
    embedding = relationship("EntryEmbedding", uselist=False, back_populates="entry")
    coach_actions = relationship("CoachAction", back_populates="entry")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    # entries relationship removed for now — Entry.tags is a plain string column;
    # we'll wire up a proper many-to-many Tag relationship when we build the tagging UI

class EntryTag(Base):
    __tablename__ = "entry_tags"
    entry_id = Column(Integer, ForeignKey("entries.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)

class Media(Base):
    __tablename__ = "media"
    id = Column(Integer, primary_key=True)
    entry_id = Column(Integer, ForeignKey("entries.id"))
    file_path = Column(String, nullable=False)
    media_type = Column(String)  # "image", "audio"
    entry = relationship("Entry", back_populates="media")

class MoodCheckin(Base):
    __tablename__ = "mood_checkins"
    id = Column(Integer, primary_key=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    mood_score = Column(Integer)  # 1-10 scale, manual check-in (separate from entry-derived mood)

class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # "sleep_hours", "exercised", "screen_time"

class HabitLog(Base):
    __tablename__ = "habit_logs"
    id = Column(Integer, primary_key=True)
    habit_id = Column(Integer, ForeignKey("habits.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    value = Column(Float)  # numeric so correlation math works

class EntryEmbedding(Base):
    __tablename__ = "entry_embeddings"
    entry_id = Column(Integer, ForeignKey("entries.id"), primary_key=True)
    vector = Column(Text)  # stored as JSON string of floats; sqlite-vec table mirrors this
    entry = relationship("Entry", back_populates="embedding")

class CoachAction(Base):
    __tablename__ = "coach_actions"
    id = Column(Integer, primary_key=True)
    entry_id = Column(Integer, ForeignKey("entries.id"), nullable=False)
    action_type = Column(String, nullable=False)  # "coach", "summarize", "followup", "suggest"
    result = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    entry = relationship("Entry", back_populates="coach_actions")

class AISettings(Base):
    __tablename__ = "ai_settings"
    id = Column(Integer, primary_key=True)
    tone = Column(String, default="warm")  # "warm", "clinical", "concise"

class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True)
    scheduled_time = Column(String)  # "HH:MM", derived from writing pattern
    active = Column(Boolean, default=True)
class AuthSettings(Base):
    __tablename__ = "auth_settings"
    id = Column(Integer, primary_key=True)
    pin_hash = Column(String)
    pin_salt = Column(String)
    password_hash = Column(String)
    password_salt = Column(String)
    display_name = Column(String)

class UserProfile(Base):
    __tablename__ = "user_profile"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    date_of_birth = Column(String)  # YYYY-MM-DD
    gender = Column(String)

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True)
    period_type = Column(String, nullable=False)
    period_label = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    prompt_text = Column(Text, nullable=False)
