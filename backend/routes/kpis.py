from fastapi import APIRouter, Request, Depends, Query
from typing import Optional, List
from datetime import datetime
import logging

from models.user import User
from models.metric_settings import DEFAULT_METRICS
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/kpis", tags=["KPIs"])


async def get_db(request: Request):
    return request.app.state.db


def get_indian_fy_dates():
    """Get current Indian Financial Year dates (April 1 - March 31)"""
    today = datetime.now()
    if today.month >= 4:
        start_year = today.year
    else:
        start_year = today.year - 1
    
    start_date = f"{start_year}-04-01"
    end_date = f"{start_year + 1}-03-31"
    return start_date, end_date


async def get_metric_config(db, metric_id: str) -> dict:
    """Get metric configuration from database or use default"""
    metric = await db.metric_settings.find_one({"metric_id": metric_id}, {"_id": 0})
    if not metric:
        # Find in defaults
        for default in DEFAULT_METRICS:
            if default["metric_id"] == metric_id:
                return default
        return None
    return metric


async def count_by_metric(db, base_query: dict, metric_config: dict) -> int:
    """Count leads matching a metric configuration"""
    if not metric_config or not metric_config.get("is_active", True):
        return 0
    
    field_name = metric_config.get("field_name")
    field_values = metric_config.get("field_values", [])
    
    if not field_name or not field_values:
        return 0
    
    query = {**base_query, field_name: {"$in": field_values}}
    return await db.leads.count_documents(query)


@router.get("")
async def get_kpis(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    employee_name: Optional[str] = None,
    segment: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get KPI metrics with optional filters - uses configurable metric settings"""
    db = await get_db(request)
    
    # Default to Indian FY if no dates provided
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Build base query
    base_query = {}
    if state:
        base_query["state"] = state
    if dealer:
        base_query["dealer"] = dealer
    if employee_name:
        base_query["employee_name"] = employee_name
    if segment:
        base_query["segment"] = segment
    
    base_query["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
    
    # Total leads
    total_leads = await db.leads.count_documents(base_query)
    
    # Get configurable metrics
    won_config = await get_metric_config(db, "won_leads")
    lost_config = await get_metric_config(db, "lost_leads")
    open_config = await get_metric_config(db, "open_leads")
    closed_config = await get_metric_config(db, "closed_leads")
    hot_config = await get_metric_config(db, "hot_leads")
    warm_config = await get_metric_config(db, "warm_leads")
    cold_config = await get_metric_config(db, "cold_leads")
    
    # Count using configurable metrics
    won_leads = await count_by_metric(db, base_query, won_config)
    lost_leads = await count_by_metric(db, base_query, lost_config)
    open_leads = await count_by_metric(db, base_query, open_config)
    closed_leads = await count_by_metric(db, base_query, closed_config)
    hot_leads = await count_by_metric(db, base_query, hot_config)
    warm_leads = await count_by_metric(db, base_query, warm_config)
    cold_leads = await count_by_metric(db, base_query, cold_config)
    
    # Qualified leads (system-based, not configurable)
    qualified_query = {**base_query, "is_qualified": True}
    qualified_leads = await db.leads.count_documents(qualified_query)
    
    # Faulty leads (explicitly marked as not qualified after being evaluated)
    faulty_query = {**base_query, "is_qualified": False, "qualification_score": {"$exists": True}}
    faulty_leads = await db.leads.count_documents(faulty_query)
    
    # Conversion rate (Won / (Won + Lost))
    closed_for_conversion = won_leads + lost_leads
    conversion_rate = (won_leads / closed_for_conversion * 100) if closed_for_conversion > 0 else 0
    
    # Leads by segment
    segment_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$segment", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    segment_distribution = await db.leads.aggregate(segment_pipeline).to_list(20)
    
    # Leads by stage
    stage_pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$enquiry_stage", "count": {"$sum": 1}}}
    ]
    stage_distribution = await db.leads.aggregate(stage_pipeline).to_list(10)
    
    # Leads by type (Hot/Warm/Cold)
    type_distribution = [
        {"type": "Hot", "count": hot_leads},
        {"type": "Warm", "count": warm_leads},
        {"type": "Cold", "count": cold_leads}
    ]
    
    # Qualification distribution
    qualification_distribution = [
        {"status": "Qualified", "count": qualified_leads},
        {"status": "Faulty", "count": faulty_leads},
        {"status": "Not Evaluated", "count": total_leads - qualified_leads - faulty_leads}
    ]
    
    # Get all custom/additional metrics
    all_metrics = await db.metric_settings.find({"is_active": True}, {"_id": 0}).to_list(50)
    custom_metrics = {}
    for metric in all_metrics:
        if metric["metric_id"] not in ["won_leads", "lost_leads", "open_leads", "closed_leads", "hot_leads", "warm_leads", "cold_leads"]:
            custom_metrics[metric["metric_id"]] = await count_by_metric(db, base_query, metric)
    
    return {
        "total_leads": total_leads,
        "won_leads": won_leads,
        "lost_leads": lost_leads,
        "open_leads": open_leads,
        "closed_leads": closed_leads,
        "hot_leads": hot_leads,
        "warm_leads": warm_leads,
        "cold_leads": cold_leads,
        "qualified_leads": qualified_leads,
        "faulty_leads": faulty_leads,
        "conversion_rate": round(conversion_rate, 2),
        "custom_metrics": custom_metrics,
        "segment_distribution": [
            {"segment": s["_id"] or "Unknown", "count": s["count"]}
            for s in segment_distribution
        ],
        "stage_distribution": [
            {"stage": s["_id"] or "Unknown", "count": s["count"]}
            for s in stage_distribution
        ],
        "type_distribution": type_distribution,
        "qualification_distribution": qualification_distribution,
        "date_range": {
            "start_date": start_date,
            "end_date": end_date
        },
        "metric_configs": {
            "won_leads": won_config,
            "lost_leads": lost_config,
            "open_leads": open_config,
            "closed_leads": closed_config,
            "hot_leads": hot_config,
            "warm_leads": warm_config,
            "cold_leads": cold_config
        }
    }
