from fastapi import APIRouter, Request, Depends, Query
from typing import Optional
from datetime import datetime
import logging

from models.user import User
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
    """Get KPI metrics with optional filters"""
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
    
    # Won leads (Closed-Won)
    won_query = {**base_query, "enquiry_stage": "Closed-Won"}
    won_leads = await db.leads.count_documents(won_query)
    
    # Lost leads (Closed-Lost)
    lost_query = {**base_query, "enquiry_stage": "Closed-Lost"}
    lost_leads = await db.leads.count_documents(lost_query)
    
    # Open leads
    open_query = {**base_query, "enquiry_status": "Open"}
    open_leads = await db.leads.count_documents(open_query)
    
    # Hot leads
    hot_query = {**base_query, "enquiry_type": "Hot"}
    hot_leads = await db.leads.count_documents(hot_query)
    
    # Conversion rate
    closed_total = won_leads + lost_leads
    conversion_rate = (won_leads / closed_total * 100) if closed_total > 0 else 0
    
    # Average KVA
    pipeline = [
        {"$match": {**base_query, "kva": {"$ne": None}}},
        {"$group": {"_id": None, "avg_kva": {"$avg": "$kva"}, "total_kva": {"$sum": "$kva"}}}
    ]
    kva_result = await db.leads.aggregate(pipeline).to_list(1)
    avg_kva = kva_result[0]["avg_kva"] if kva_result else 0
    total_kva = kva_result[0]["total_kva"] if kva_result else 0
    
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
    
    return {
        "total_leads": total_leads,
        "won_leads": won_leads,
        "lost_leads": lost_leads,
        "open_leads": open_leads,
        "hot_leads": hot_leads,
        "conversion_rate": round(conversion_rate, 2),
        "avg_kva": round(avg_kva, 2) if avg_kva else 0,
        "total_kva": round(total_kva, 2) if total_kva else 0,
        "segment_distribution": [
            {"segment": s["_id"] or "Unknown", "count": s["count"]}
            for s in segment_distribution
        ],
        "stage_distribution": [
            {"stage": s["_id"] or "Unknown", "count": s["count"]}
            for s in stage_distribution
        ],
        "date_range": {
            "start_date": start_date,
            "end_date": end_date
        }
    }
