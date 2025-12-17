from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone


class MetricConfig(BaseModel):
    """Configuration for a single metric"""
    metric_id: str  # e.g., "won_leads", "lost_leads", "open_leads"
    metric_name: str  # Display name
    description: str
    field_name: str  # e.g., "enquiry_stage", "enquiry_status", "enquiry_type"
    field_values: List[str]  # Values that count for this metric
    is_active: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MetricSettingsResponse(BaseModel):
    metrics: List[MetricConfig]
    available_fields: dict  # Available field values from database


# Default metric configurations
DEFAULT_METRICS = [
    {
        "metric_id": "won_leads",
        "metric_name": "Won Leads",
        "description": "Leads that have been successfully converted",
        "field_name": "enquiry_stage",
        "field_values": ["Closed-Won", "Order Booked"],
        "is_active": True
    },
    {
        "metric_id": "lost_leads",
        "metric_name": "Lost Leads",
        "description": "Leads that were not converted",
        "field_name": "enquiry_stage",
        "field_values": ["Closed-Lost", "Closed-Dropped"],
        "is_active": True
    },
    {
        "metric_id": "open_leads",
        "metric_name": "Open Leads",
        "description": "Leads that are still being worked on",
        "field_name": "enquiry_stage",
        "field_values": ["Prospecting", "Qualified"],
        "is_active": True
    },
    {
        "metric_id": "closed_leads",
        "metric_name": "Closed Leads",
        "description": "All leads that have been closed",
        "field_name": "enquiry_status",
        "field_values": ["Closed", "Order Received"],
        "is_active": True
    },
    {
        "metric_id": "hot_leads",
        "metric_name": "Hot Leads",
        "description": "High priority leads",
        "field_name": "enquiry_type",
        "field_values": ["Hot"],
        "is_active": True
    },
    {
        "metric_id": "warm_leads",
        "metric_name": "Warm Leads",
        "description": "Medium priority leads",
        "field_name": "enquiry_type",
        "field_values": ["Warm"],
        "is_active": True
    },
    {
        "metric_id": "cold_leads",
        "metric_name": "Cold Leads",
        "description": "Low priority leads",
        "field_name": "enquiry_type",
        "field_values": ["Cold"],
        "is_active": True
    }
]
