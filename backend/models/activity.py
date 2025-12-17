from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid


class LeadActivity(BaseModel):
    """Activity record for a lead"""
    model_config = ConfigDict(extra="ignore")
    
    activity_id: str = Field(default_factory=lambda: f"act_{uuid.uuid4().hex[:8]}")
    lead_id: str
    user_id: str
    user_name: Optional[str] = None
    action: str  # created, updated, qualified, status_changed, followup_added, etc.
    field_changes: Optional[Dict[str, Any]] = None  # {"field": {"old": x, "new": y}}
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FollowUp(BaseModel):
    """Follow-up record for a lead"""
    followup_id: str = Field(default_factory=lambda: f"fu_{uuid.uuid4().hex[:8]}")
    lead_id: str
    user_id: str
    user_name: Optional[str] = None
    followup_date: str
    notes: Optional[str] = None
    outcome: Optional[str] = None  # positive, negative, neutral, pending
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
