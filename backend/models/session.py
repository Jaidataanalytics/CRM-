from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone, timedelta
import uuid


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7)
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
