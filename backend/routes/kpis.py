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
    
    # Get conversion rate config (can be customized by admin)
    conversion_config = await get_metric_config(db, "conversion_rate")
    
    # Calculate conversion rate using configurable formula
    if conversion_config and conversion_config.get("numerator_metric") and conversion_config.get("denominator_metric"):
        # Parse numerator and denominator from config
        numerator_metrics = conversion_config.get("numerator_metric", "won_leads").split("+")
        denominator_metrics = conversion_config.get("denominator_metric", "won_leads+lost_leads").split("+")
        
        metric_values = {
            "won_leads": won_leads,
            "lost_leads": lost_leads,
            "open_leads": open_leads,
            "closed_leads": closed_leads,
            "hot_leads": hot_leads,
            "warm_leads": warm_leads,
            "cold_leads": cold_leads,
            "total_leads": total_leads
        }
        
        numerator = sum(metric_values.get(m.strip(), 0) for m in numerator_metrics)
        denominator = sum(metric_values.get(m.strip(), 0) for m in denominator_metrics)
        conversion_rate = (numerator / denominator * 100) if denominator > 0 else 0
    else:
        # Default formula: Won / (Won + Lost)
        closed_for_conversion = won_leads + lost_leads
        conversion_rate = (won_leads / closed_for_conversion * 100) if closed_for_conversion > 0 else 0
    
    # Calculate Average Lead Age (for open leads)
    today_str = datetime.now().strftime('%Y-%m-%d')
    open_stages = open_config.get("field_values", ["Prospecting", "Qualified"]) if open_config else ["Prospecting", "Qualified"]
    
    avg_lead_age_pipeline = [
        {"$match": {**base_query, "enquiry_stage": {"$in": open_stages}}},
        {
            "$addFields": {
                "lead_age_days": {
                    "$divide": [
                        {"$subtract": [{"$dateFromString": {"dateString": today_str}}, {"$dateFromString": {"dateString": "$enquiry_date"}}]},
                        86400000  # milliseconds in a day
                    ]
                }
            }
        },
        {"$group": {"_id": None, "avg_age": {"$avg": "$lead_age_days"}}}
    ]
    
    avg_lead_age_result = await db.leads.aggregate(avg_lead_age_pipeline).to_list(1)
    avg_lead_age = round(avg_lead_age_result[0]["avg_age"], 1) if avg_lead_age_result and avg_lead_age_result[0].get("avg_age") else 0
    
    # Calculate Average Closure Time (for won + lost leads)
    closed_stages = (won_config.get("field_values", []) if won_config else []) + (lost_config.get("field_values", []) if lost_config else [])
    if not closed_stages:
        closed_stages = ["Closed-Won", "Order Booked", "Closed-Lost", "Closed-Dropped"]
    
    # We need a "closure_date" or use updated_at - for now use enquiry_date to last_followup_date or a reasonable estimate
    avg_closure_pipeline = [
        {"$match": {
            **base_query, 
            "enquiry_stage": {"$in": closed_stages},
            "last_followup_date": {"$exists": True, "$ne": None, "$ne": ""}
        }},
        {
            "$addFields": {
                "closure_days": {
                    "$divide": [
                        {"$subtract": [
                            {"$dateFromString": {"dateString": "$last_followup_date", "onError": {"$dateFromString": {"dateString": "$enquiry_date"}}}},
                            {"$dateFromString": {"dateString": "$enquiry_date"}}
                        ]},
                        86400000
                    ]
                }
            }
        },
        {"$match": {"closure_days": {"$gte": 0}}},  # Filter out negative values
        {"$group": {"_id": None, "avg_closure": {"$avg": "$closure_days"}}}
    ]
    
    avg_closure_result = await db.leads.aggregate(avg_closure_pipeline).to_list(1)
    avg_closure_time = round(avg_closure_result[0]["avg_closure"], 1) if avg_closure_result and avg_closure_result[0].get("avg_closure") else 0
    
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
    
    # Get all metrics for dashboard display
    all_metrics = await db.metric_settings.find(
        {"is_active": True, "show_on_dashboard": True}, 
        {"_id": 0}
    ).sort("dashboard_order", 1).to_list(50)
    
    # Pre-calculated values for formula metrics
    calculated_values = {
        "won_leads": won_leads,
        "lost_leads": lost_leads,
        "open_leads": open_leads,
        "closed_leads": closed_leads,
        "hot_leads": hot_leads,
        "warm_leads": warm_leads,
        "cold_leads": cold_leads,
        "total_leads": total_leads,
        "qualified_leads": qualified_leads,
        "avg_lead_age": avg_lead_age,
        "avg_closure_time": avg_closure_time,
        "conversion_rate": round(conversion_rate, 2)
    }
    
    # Calculate counts for all metrics
    dashboard_metrics = []
    for metric in all_metrics:
        metric_type = metric.get("metric_type", "count")
        metric_id = metric["metric_id"]
        
        if metric_type == "calculated" and metric_id in calculated_values:
            # Use pre-calculated value
            value = calculated_values[metric_id]
        elif metric_type == "formula":
            # Calculate using formula
            numerator_metrics = metric.get("numerator_metric", "").split("+")
            denominator_metrics = metric.get("denominator_metric", "").split("+")
            
            numerator = sum(calculated_values.get(m.strip(), 0) for m in numerator_metrics if m.strip())
            denominator = sum(calculated_values.get(m.strip(), 0) for m in denominator_metrics if m.strip())
            value = round((numerator / denominator * 100), 2) if denominator > 0 else 0
        else:
            # Count-based metric
            value = await count_by_metric(db, base_query, metric)
        
        dashboard_metrics.append({
            "metric_id": metric_id,
            "metric_name": metric["metric_name"],
            "value": value,
            "color": metric.get("color", "primary"),
            "icon": metric.get("icon", "BarChart3"),
            "field_name": metric.get("field_name"),
            "field_values": metric.get("field_values", []),
            "is_custom": metric.get("is_custom", False),
            "metric_type": metric_type,
            "unit": metric.get("unit", ""),
            "numerator_metric": metric.get("numerator_metric"),
            "denominator_metric": metric.get("denominator_metric")
        })
    
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
        "dashboard_metrics": dashboard_metrics,
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
