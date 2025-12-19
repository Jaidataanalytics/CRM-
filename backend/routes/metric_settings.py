from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from models.user import User, UserRole
from models.metric_settings import MetricConfig, DEFAULT_METRICS
from routes.auth import get_current_user, require_roles

router = APIRouter(prefix="/metric-settings", tags=["Metric Settings"])
logger = logging.getLogger(__name__)


class CustomMetricCreate(BaseModel):
    metric_id: str
    metric_name: str
    description: Optional[str] = ""
    field_name: str
    field_values: List[str]
    color: Optional[str] = "primary"
    icon: Optional[str] = "BarChart3"
    show_on_dashboard: bool = True
    dashboard_order: Optional[int] = 99


class MetricUpdate(BaseModel):
    metric_name: Optional[str] = None
    description: Optional[str] = None
    field_values: Optional[List[str]] = None
    is_active: Optional[bool] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    show_on_dashboard: Optional[bool] = None
    dashboard_order: Optional[int] = None
    # Formula-based metric fields
    metric_type: Optional[str] = None
    numerator_metric: Optional[str] = None
    denominator_metric: Optional[str] = None
    unit: Optional[str] = None


async def get_db(request: Request):
    return request.app.state.db


@router.get("")
async def get_metric_settings(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all metric configurations and available field values"""
    db = await get_db(request)
    
    # Get saved metrics from database
    saved_metrics = await db.metric_settings.find({}, {"_id": 0}).to_list(100)
    
    # If no saved metrics, use defaults
    if not saved_metrics:
        for metric in DEFAULT_METRICS:
            metric_doc = {
                **metric,
                "color": metric.get("color", "primary"),
                "icon": metric.get("icon", "BarChart3"),
                "show_on_dashboard": metric.get("show_on_dashboard", True),
                "dashboard_order": metric.get("dashboard_order", 99),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.metric_settings.insert_one(metric_doc)
        saved_metrics = await db.metric_settings.find({}, {"_id": 0}).to_list(100)
    
    # Sort by dashboard_order
    saved_metrics.sort(key=lambda x: x.get("dashboard_order", 99))
    
    # Get available field values from leads collection
    available_fields = {
        "enquiry_stage": await db.leads.distinct("enquiry_stage"),
        "enquiry_status": await db.leads.distinct("enquiry_status"),
        "enquiry_type": await db.leads.distinct("enquiry_type"),
        "segment": await db.leads.distinct("segment"),
        "state": await db.leads.distinct("state"),
        "dealer": await db.leads.distinct("dealer"),
        "source": await db.leads.distinct("source"),
        "customer_type": await db.leads.distinct("customer_type")
    }
    
    # Clean up None values
    for field in available_fields:
        available_fields[field] = [v for v in available_fields[field] if v is not None]
    
    # Get counts for each value
    field_counts = {}
    for field, values in available_fields.items():
        field_counts[field] = {}
        for value in values:
            count = await db.leads.count_documents({field: value})
            field_counts[field][value] = count
    
    return {
        "metrics": saved_metrics,
        "available_fields": available_fields,
        "field_counts": field_counts
    }


@router.put("/{metric_id}")
async def update_metric_setting(
    request: Request,
    metric_id: str,
    metric_update: MetricUpdate,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Update a specific metric configuration"""
    db = await get_db(request)
    
    existing = await db.metric_settings.find_one({"metric_id": metric_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Metric '{metric_id}' not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if metric_update.field_values is not None:
        update_data["field_values"] = metric_update.field_values
    if metric_update.is_active is not None:
        update_data["is_active"] = metric_update.is_active
    if metric_update.metric_name is not None:
        update_data["metric_name"] = metric_update.metric_name
    if metric_update.description is not None:
        update_data["description"] = metric_update.description
    if metric_update.color is not None:
        update_data["color"] = metric_update.color
    if metric_update.icon is not None:
        update_data["icon"] = metric_update.icon
    if metric_update.show_on_dashboard is not None:
        update_data["show_on_dashboard"] = metric_update.show_on_dashboard
    if metric_update.dashboard_order is not None:
        update_data["dashboard_order"] = metric_update.dashboard_order
    # Formula fields
    if metric_update.metric_type is not None:
        update_data["metric_type"] = metric_update.metric_type
    if metric_update.numerator_metric is not None:
        update_data["numerator_metric"] = metric_update.numerator_metric
    if metric_update.denominator_metric is not None:
        update_data["denominator_metric"] = metric_update.denominator_metric
    if metric_update.unit is not None:
        update_data["unit"] = metric_update.unit
    
    await db.metric_settings.update_one(
        {"metric_id": metric_id},
        {"$set": update_data}
    )
    
    updated = await db.metric_settings.find_one({"metric_id": metric_id}, {"_id": 0})
    return updated


@router.post("/reset")
async def reset_metric_settings(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Reset all metric settings to defaults"""
    db = await get_db(request)
    
    await db.metric_settings.delete_many({})
    
    for i, metric in enumerate(DEFAULT_METRICS):
        metric_doc = {
            **metric,
            "color": metric.get("color", "primary"),
            "icon": metric.get("icon", "BarChart3"),
            "show_on_dashboard": True,
            "dashboard_order": i,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.metric_settings.insert_one(metric_doc)
    
    return {"message": "Metric settings reset to defaults"}


@router.post("/create")
async def create_custom_metric(
    request: Request,
    metric: CustomMetricCreate,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Create a new custom metric"""
    db = await get_db(request)
    
    existing = await db.metric_settings.find_one({"metric_id": metric.metric_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Metric '{metric.metric_id}' already exists")
    
    # Get max order
    max_order_doc = await db.metric_settings.find_one(sort=[("dashboard_order", -1)])
    max_order = max_order_doc.get("dashboard_order", 0) if max_order_doc else 0
    
    new_metric = {
        "metric_id": metric.metric_id,
        "metric_name": metric.metric_name,
        "description": metric.description or "",
        "field_name": metric.field_name,
        "field_values": metric.field_values,
        "is_active": True,
        "is_custom": True,
        "color": metric.color or "primary",
        "icon": metric.icon or "BarChart3",
        "show_on_dashboard": metric.show_on_dashboard,
        "dashboard_order": metric.dashboard_order if metric.dashboard_order != 99 else max_order + 1,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.metric_settings.insert_one(new_metric)
    return new_metric


@router.delete("/{metric_id}")
async def delete_metric(
    request: Request,
    metric_id: str,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a custom metric"""
    db = await get_db(request)
    
    existing = await db.metric_settings.find_one({"metric_id": metric_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Metric '{metric_id}' not found")
    
    if not existing.get("is_custom", False):
        raise HTTPException(status_code=400, detail="Cannot delete default metrics. You can hide them instead.")
    
    await db.metric_settings.delete_one({"metric_id": metric_id})
    return {"message": f"Metric '{metric_id}' deleted"}


@router.put("/reorder")
async def reorder_metrics(
    request: Request,
    order: List[str],  # List of metric_ids in desired order
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Reorder metrics on dashboard"""
    db = await get_db(request)
    
    for i, metric_id in enumerate(order):
        await db.metric_settings.update_one(
            {"metric_id": metric_id},
            {"$set": {"dashboard_order": i}}
        )
    
    return {"message": "Metrics reordered successfully"}
