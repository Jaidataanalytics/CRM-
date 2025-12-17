from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone


class MetricConfig(BaseModel):
    """Configuration for a single metric"""
    metric_id: str
    metric_name: str
    description: str
    field_name: str
    field_values: List[str]
    is_active: bool = True
    is_custom: bool = False
    color: str = "primary"
    icon: str = "BarChart3"
    show_on_dashboard: bool = True
    dashboard_order: int = 99
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Default metric configurations with colors and icons
DEFAULT_METRICS = [
    {
        "metric_id": "won_leads",
        "metric_name": "Won Leads",
        "description": "Leads that have been successfully converted",
        "field_name": "enquiry_stage",
        "field_values": ["Closed-Won", "Order Booked"],
        "is_active": True,
        "is_custom": False,
        "color": "green",
        "icon": "CheckCircle",
        "show_on_dashboard": True,
        "dashboard_order": 1
    },
    {
        "metric_id": "lost_leads",
        "metric_name": "Lost Leads",
        "description": "Leads that were not converted",
        "field_name": "enquiry_stage",
        "field_values": ["Closed-Lost", "Closed-Dropped"],
        "is_active": True,
        "is_custom": False,
        "color": "red",
        "icon": "XCircle",
        "show_on_dashboard": True,
        "dashboard_order": 2
    },
    {
        "metric_id": "open_leads",
        "metric_name": "Open Leads",
        "description": "Leads that are still being worked on",
        "field_name": "enquiry_stage",
        "field_values": ["Prospecting", "Qualified"],
        "is_active": True,
        "is_custom": False,
        "color": "yellow",
        "icon": "Target",
        "show_on_dashboard": True,
        "dashboard_order": 3
    },
    {
        "metric_id": "closed_leads",
        "metric_name": "Closed Leads",
        "description": "All leads that have been closed",
        "field_name": "enquiry_status",
        "field_values": ["Closed", "Order Received"],
        "is_active": True,
        "is_custom": False,
        "color": "purple",
        "icon": "CheckCircle2",
        "show_on_dashboard": True,
        "dashboard_order": 4
    },
    {
        "metric_id": "hot_leads",
        "metric_name": "Hot Leads",
        "description": "High priority leads",
        "field_name": "enquiry_type",
        "field_values": ["Hot"],
        "is_active": True,
        "is_custom": False,
        "color": "red",
        "icon": "Flame",
        "show_on_dashboard": True,
        "dashboard_order": 5
    },
    {
        "metric_id": "warm_leads",
        "metric_name": "Warm Leads",
        "description": "Medium priority leads",
        "field_name": "enquiry_type",
        "field_values": ["Warm"],
        "is_active": True,
        "is_custom": False,
        "color": "orange",
        "icon": "ThermometerSun",
        "show_on_dashboard": True,
        "dashboard_order": 6
    },
    {
        "metric_id": "cold_leads",
        "metric_name": "Cold Leads",
        "description": "Low priority leads",
        "field_name": "enquiry_type",
        "field_values": ["Cold"],
        "is_active": True,
        "is_custom": False,
        "color": "blue",
        "icon": "Snowflake",
        "show_on_dashboard": True,
        "dashboard_order": 7
    }
]
