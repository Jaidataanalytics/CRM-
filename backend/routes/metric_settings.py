from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List
from datetime import datetime, timezone
import logging

from models.user import User, UserRole
from models.metric_settings import MetricConfig, DEFAULT_METRICS
from routes.auth import get_current_user, require_roles

router = APIRouter(prefix="/metric-settings", tags=["Metric Settings"])
logger = logging.getLogger(__name__)


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
        # Initialize with defaults
        for metric in DEFAULT_METRICS:
            metric["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.metric_settings.insert_one(metric)
        saved_metrics = DEFAULT_METRICS
    
    # Get available field values from leads collection
    available_fields = {
        "enquiry_stage": await db.leads.distinct("enquiry_stage"),
        "enquiry_status": await db.leads.distinct("enquiry_status"),
        "enquiry_type": await db.leads.distinct("enquiry_type")
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
    metric_update: dict,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Update a specific metric configuration"""
    db = await get_db(request)
    
    # Validate metric_id
    existing = await db.metric_settings.find_one({"metric_id": metric_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Metric '{metric_id}' not found")
    
    # Update the metric
    update_data = {
        "field_values": metric_update.get("field_values", existing.get("field_values", [])),
        "is_active": metric_update.get("is_active", existing.get("is_active", True)),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Optionally update name and description
    if "metric_name" in metric_update:
        update_data["metric_name"] = metric_update["metric_name"]
    if "description" in metric_update:
        update_data["description"] = metric_update["description"]
    
    await db.metric_settings.update_one(
        {"metric_id": metric_id},
        {"$set": update_data}
    )
    
    # Return updated metric
    updated = await db.metric_settings.find_one({"metric_id": metric_id}, {"_id": 0})
    return updated


@router.post("/reset")
async def reset_metric_settings(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Reset all metric settings to defaults"""
    db = await get_db(request)
    
    # Delete all existing settings
    await db.metric_settings.delete_many({})
    
    # Insert defaults
    for metric in DEFAULT_METRICS:
        metric["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.metric_settings.insert_one(metric)
    
    return {"message": "Metric settings reset to defaults", "metrics": DEFAULT_METRICS}


@router.post("/add")
async def add_custom_metric(
    request: Request,
    metric: dict,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Add a new custom metric"""
    db = await get_db(request)
    
    # Check if metric_id already exists
    existing = await db.metric_settings.find_one({"metric_id": metric.get("metric_id")})
    if existing:
        raise HTTPException(status_code=400, detail=f"Metric '{metric.get('metric_id')}' already exists")
    
    # Validate required fields
    required = ["metric_id", "metric_name", "field_name", "field_values"]
    for field in required:
        if field not in metric:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Create new metric
    new_metric = {
        "metric_id": metric["metric_id"],
        "metric_name": metric["metric_name"],
        "description": metric.get("description", ""),
        "field_name": metric["field_name"],
        "field_values": metric["field_values"],
        "is_active": metric.get("is_active", True),
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
    """Delete a custom metric (cannot delete default metrics)"""
    db = await get_db(request)
    
    # Check if it's a default metric
    default_ids = [m["metric_id"] for m in DEFAULT_METRICS]
    if metric_id in default_ids:
        raise HTTPException(status_code=400, detail="Cannot delete default metrics. You can disable them instead.")
    
    result = await db.metric_settings.delete_one({"metric_id": metric_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Metric '{metric_id}' not found")
    
    return {"message": f"Metric '{metric_id}' deleted"}
