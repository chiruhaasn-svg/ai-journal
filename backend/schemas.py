from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class EntryCreate(BaseModel):
    content: str

class EntryResponse(BaseModel):
    id: int
    content: str
    mood: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[str] = None
    coaching_feedback: Optional[str] = None
    bookmarked: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class CoachActionResponse(BaseModel):
    id: int
    entry_id: int
    action_type: str
    result: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProfileResponse(BaseModel):
    display_name: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None

class JournalAskRequest(BaseModel):
    question: str

class JournalAskResponse(BaseModel):
    answer: str
    source_entries: list[EntryResponse]

class ReviewResponse(BaseModel):
    id: int
    period_type: str
    period_label: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReviewCreate(BaseModel):
    period_type: str

class TagListResponse(BaseModel):
    tags: list[str]

class TemplateResponse(BaseModel):
    id: int
    name: str
    prompt_text: str

    class Config:
        from_attributes = True
