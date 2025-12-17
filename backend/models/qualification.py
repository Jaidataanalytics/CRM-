from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class AnswerOption(BaseModel):
    """Answer option with score"""
    option_id: str = Field(default_factory=lambda: f"opt_{uuid.uuid4().hex[:8]}")
    text: str
    score: int = 0


class QualificationQuestion(BaseModel):
    """Qualification question with scored answers"""
    model_config = ConfigDict(extra="ignore")
    
    question_id: str = Field(default_factory=lambda: f"qq_{uuid.uuid4().hex[:8]}")
    question: str
    description: Optional[str] = None
    options: List[AnswerOption] = []
    is_required: bool = True
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QualificationQuestionCreate(BaseModel):
    question: str
    description: Optional[str] = None
    options: List[dict]  # [{"text": "Yes", "score": 10}, {"text": "No", "score": 0}]
    is_required: bool = True
    order: int = 0


class QualificationSettings(BaseModel):
    """Global qualification settings"""
    model_config = ConfigDict(extra="ignore")
    
    settings_id: str = "qualification_settings"
    threshold_score: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None


class QualificationAnswer(BaseModel):
    """Answer to a qualification question for a lead"""
    question_id: str
    option_id: str
    score: int = 0
    answered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    answered_by: Optional[str] = None
