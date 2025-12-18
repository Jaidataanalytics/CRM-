from fastapi import APIRouter, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging

from models.user import User, UserRole
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


async def get_db(request: Request):
    return request.app.state.db


@router.get("")
async def get_notifications(
    request: Request,
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100)
):
    """Get follow-up notifications for the current user"""
    db = await get_db(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    three_days = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    
    notifications = []
    
    # Build query based on user role
    base_query = {}
    if current_user.role == UserRole.EMPLOYEE:
        base_query["employee_name"] = current_user.name
    
    # 1. CRITICAL: Missed follow-ups (past dates, not closed)
    missed_query = {
        **base_query,
        "planned_followup_date": {"$lt": today, "$ne": None, "$ne": ""},
        "enquiry_stage": {"$nin": ["Closed-Won", "Closed-Lost"]}
    }
    missed_leads = await db.leads.find(missed_query, {"_id": 0}).to_list(50)
    
    for lead in missed_leads:
        days_overdue = (datetime.now(timezone.utc) - datetime.strptime(lead.get("planned_followup_date", today), "%Y-%m-%d").replace(tzinfo=timezone.utc)).days
        notifications.append({
            "id": f"missed_{lead.get('lead_id', '')}",
            "type": "critical",
            "title": "⚠️ MISSED FOLLOW-UP",
            "message": f"{lead.get('name', 'Unknown')} - {days_overdue} days overdue",
            "lead_id": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "dealer": lead.get("dealer"),
            "followup_date": lead.get("planned_followup_date"),
            "days_overdue": days_overdue,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # 2. WARNING: Follow-up today
    today_query = {
        **base_query,
        "planned_followup_date": today,
        "enquiry_stage": {"$nin": ["Closed-Won", "Closed-Lost"]}
    }
    today_leads = await db.leads.find(today_query, {"_id": 0}).to_list(50)
    
    for lead in today_leads:
        notifications.append({
            "id": f"today_{lead.get('lead_id', '')}",
            "type": "warning",
            "title": "📅 Follow-up TODAY",
            "message": f"{lead.get('name', 'Unknown')} - Due today",
            "lead_id": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "dealer": lead.get("dealer"),
            "followup_date": lead.get("planned_followup_date"),
            "days_overdue": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # 3. INFO: Follow-up in next 3 days
    upcoming_query = {
        **base_query,
        "planned_followup_date": {"$gt": today, "$lte": three_days},
        "enquiry_stage": {"$nin": ["Closed-Won", "Closed-Lost"]}
    }
    upcoming_leads = await db.leads.find(upcoming_query, {"_id": 0}).to_list(50)
    
    for lead in upcoming_leads:
        try:
            followup_date = datetime.strptime(lead.get("planned_followup_date", tomorrow), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            days_until = (followup_date - datetime.now(timezone.utc)).days + 1
        except:
            days_until = 1
        
        notifications.append({
            "id": f"upcoming_{lead.get('lead_id', '')}",
            "type": "info",
            "title": "🔔 Upcoming Follow-up",
            "message": f"{lead.get('name', 'Unknown')} - In {days_until} day{'s' if days_until != 1 else ''}",
            "lead_id": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "dealer": lead.get("dealer"),
            "followup_date": lead.get("planned_followup_date"),
            "days_until": days_until,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Sort: critical first, then warning, then info
    type_order = {"critical": 0, "warning": 1, "info": 2}
    notifications.sort(key=lambda x: (type_order.get(x["type"], 3), x.get("days_overdue", 0) * -1))
    
    # Count by type
    counts = {
        "critical": len([n for n in notifications if n["type"] == "critical"]),
        "warning": len([n for n in notifications if n["type"] == "warning"]),
        "info": len([n for n in notifications if n["type"] == "info"]),
        "total": len(notifications)
    }
    
    return {
        "notifications": notifications[:limit],
        "counts": counts
    }


@router.get("/summary")
async def get_notification_summary(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get notification counts only (for badge)"""
    db = await get_db(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    three_days = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    
    base_query = {}
    if current_user.role == UserRole.EMPLOYEE:
        base_query["employee_name"] = current_user.name
    
    # Count missed
    missed_count = await db.leads.count_documents({
        **base_query,
        "planned_followup_date": {"$lt": today, "$ne": None, "$ne": ""},
        "enquiry_stage": {"$nin": ["Closed-Won", "Closed-Lost"]}
    })
    
    # Count today
    today_count = await db.leads.count_documents({
        **base_query,
        "planned_followup_date": today,
        "enquiry_stage": {"$nin": ["Closed-Won", "Closed-Lost"]}
    })
    
    # Count upcoming
    upcoming_count = await db.leads.count_documents({
        **base_query,
        "planned_followup_date": {"$gt": today, "$lte": three_days},
        "enquiry_stage": {"$nin": ["Closed-Won", "Closed-Lost"]}
    })
    
    return {
        "critical": missed_count,
        "warning": today_count,
        "info": upcoming_count,
        "total": missed_count + today_count + upcoming_count
    }
