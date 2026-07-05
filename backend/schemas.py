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
    created_at: datetime

    class Config:
        from_attributes = True