from fastapi import APIRouter, Request, Depends, Query, HTTPException
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging

from models.user import User, UserRole
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


def parse_date_safe(date_str: str, default_date: str = None) -> datetime:
    """
    Parse date string in multiple formats safely.
    Returns default_date as datetime if parsing fails.
    """
    if not date_str:
        if default_date:
            return datetime.strptime(default_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc)
    
    date_str = str(date_str).strip()
    
    formats = [
        "%Y-%m-%d",      # 2026-02-07
        "%d %b %Y",      # 07 Feb 2026
        "%d-%b-%Y",      # 07-Feb-2026
        "%d/%m/%Y",      # 07/02/2026
        "%Y/%m/%d",      # 2026/02/07
        "%d %B %Y",      # 07 February 2026
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    # Fallback to default
    if default_date:
        return datetime.strptime(default_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


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
    
    # Closed/Won stages that should NOT have follow-up reminders
    CLOSED_STAGES = ["Closed-Won", "Closed-Lost", "Closed-Dropped", "Order Booked", "Won", "Lost"]
    
    # Build query based on user role
    # For employees: show leads they added (added_by) OR system imports (shown to everyone)
    if current_user.role == UserRole.EMPLOYEE:
        # Employees see:
        # 1. Leads they added (added_by = their name)
        # 2. System Import leads (shown to everyone)
        # 3. Legacy leads without added_by
        user_name = current_user.name or current_user.email
        base_query = {
            "is_deleted": {"$ne": True},
            "$and": [
                {"$or": [{"is_transferred": {"$exists": False}}, {"is_transferred": False}, {"is_transferred": None}]},
                {"$or": [
                    {"added_by": user_name},
                    {"added_by": "System Import"},
                    {"added_by": {"$exists": False}},
                    {"added_by": None}
                ]}
            ]
        }
    else:
        # Admin/Manager see all
        base_query = {
            "is_deleted": {"$ne": True},
            "$or": [
                {"is_transferred": {"$exists": False}},
                {"is_transferred": False},
                {"is_transferred": None}
            ]
        }
    
    # 1. CRITICAL: Missed follow-ups (past dates, not closed)
    missed_query = {
        **base_query,
        "planned_followup_date": {"$lt": today, "$nin": [None, "", "nan", "NaN"]},
        "enquiry_stage": {"$nin": CLOSED_STAGES}
    }
    missed_leads = await db.leads.find(missed_query, {"_id": 0}).to_list(50)
    
    for lead in missed_leads:
        followup_date_parsed = parse_date_safe(lead.get("planned_followup_date"), today)
        days_overdue = (datetime.now(timezone.utc) - followup_date_parsed).days
        notifications.append({
            "id": f"missed_{lead.get('lead_id', '')}",
            "type": "critical",
            "title": "⚠️ MISSED FOLLOW-UP",
            "message": f"{lead.get('name', 'Unknown')} - {days_overdue} days overdue",
            "lead_id": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "dealer": lead.get("dealer"),
            "added_by": lead.get("added_by"),
            "followup_date": lead.get("planned_followup_date"),
            "days_overdue": days_overdue,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # 2. WARNING: Follow-up today
    today_query = {
        **base_query,
        "planned_followup_date": today,
        "enquiry_stage": {"$nin": CLOSED_STAGES}
    }
    today_leads = await db.leads.find(today_query, {"_id": 0}).to_list(20)
    
    for lead in today_leads:
        notifications.append({
            "id": f"today_{lead.get('lead_id', '')}",
            "type": "warning",
            "title": "📅 Follow-up TODAY",
            "message": f"{lead.get('name', 'Unknown')} - Due today",
            "lead_id": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "dealer": lead.get("dealer"),
            "added_by": lead.get("added_by"),
            "followup_date": lead.get("planned_followup_date"),
            "days_overdue": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # 3. INFO: Follow-up in next 3 days
    upcoming_query = {
        **base_query,
        "planned_followup_date": {"$gt": today, "$lte": three_days},
        "enquiry_stage": {"$nin": CLOSED_STAGES}
    }
    upcoming_leads = await db.leads.find(upcoming_query, {"_id": 0}).to_list(50)
    
    for lead in upcoming_leads:
        try:
            followup_date = parse_date_safe(lead.get("planned_followup_date"), tomorrow)
            days_until = (followup_date - datetime.now(timezone.utc)).days + 1
        except Exception:
            days_until = 1
        
        notifications.append({
            "id": f"upcoming_{lead.get('lead_id', '')}",
            "type": "info",
            "title": "🔔 Upcoming Follow-up",
            "message": f"{lead.get('name', 'Unknown')} - In {days_until} day{'s' if days_until != 1 else ''}",
            "lead_id": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "dealer": lead.get("dealer"),
            "added_by": lead.get("added_by"),
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


@router.post("/dismiss")
async def dismiss_notification(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Dismiss a notification by updating the lead's follow-up date"""
    db = await get_db(request)
    body = await request.json()
    lead_id = body.get("lead_id")
    action = body.get("action", "snooze")  # "snooze" or "clear"
    
    if not lead_id:
        raise HTTPException(status_code=400, detail="lead_id is required")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    if action == "clear":
        # Clear by removing the follow-up date
        await db.leads.update_one(
            {"lead_id": lead_id},
            {"$set": {"planned_followup_date": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Snooze by setting follow-up to tomorrow
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        await db.leads.update_one(
            {"lead_id": lead_id},
            {"$set": {"planned_followup_date": tomorrow, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": f"Notification {action}ed successfully"}


@router.post("/dismiss-all")
async def dismiss_all_notifications(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Dismiss overdue notifications only (not upcoming)"""
    db = await get_db(request)
    body = await request.json()
    notification_type = body.get("type", "overdue")  # "overdue" (default), "today", or "all"
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    CLOSED_STAGES = ["Closed-Won", "Closed-Lost", "Closed-Dropped", "Order Booked", "Won", "Lost"]
    base_query = {
        "enquiry_stage": {"$nin": CLOSED_STAGES},
        "is_deleted": {"$ne": True}
    }
    
    if current_user.role == UserRole.EMPLOYEE:
        user_name = current_user.name or current_user.email
        base_query["$or"] = [
            {"added_by": user_name},
            {"added_by": "System Import"},
            {"added_by": {"$exists": False}},
            {"added_by": None}
        ]
    
    if notification_type == "overdue":
        # Clear only overdue follow-ups (past dates) - DEFAULT behavior
        query = {**base_query, "planned_followup_date": {"$lt": today, "$nin": [None, "", "nan", "NaN"]}}
    elif notification_type == "today":
        # Clear today's follow-ups
        query = {**base_query, "planned_followup_date": today}
    elif notification_type == "all":
        # Clear all overdue + today (but NOT upcoming)
        query = {**base_query, "planned_followup_date": {"$lte": today, "$nin": [None, "", "nan", "NaN"]}}
    else:
        # Default: only overdue
        query = {**base_query, "planned_followup_date": {"$lt": today, "$nin": [None, "", "nan", "NaN"]}}
    
    result = await db.leads.update_many(
        query,
        {"$set": {"planned_followup_date": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Cleared {result.modified_count} overdue follow-ups", "cleared_count": result.modified_count}


@router.get("/summary")
async def get_notification_summary(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get notification counts only (for badge)"""
    db = await get_db(request)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    three_days = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    
    # Closed/Won stages that should NOT have follow-up reminders
    CLOSED_STAGES = ["Closed-Won", "Closed-Lost", "Closed-Dropped", "Order Booked", "Won", "Lost"]
    
    # Build query based on user role
    base_query = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"is_transferred": {"$exists": False}},
            {"is_transferred": False},
            {"is_transferred": None}
        ]
    }
    
    if current_user.role == UserRole.EMPLOYEE:
        # Employees see leads they added OR system imports
        user_name = current_user.name or current_user.email
        base_query = {
            "is_deleted": {"$ne": True},
            "$and": [
                {"$or": [{"is_transferred": {"$exists": False}}, {"is_transferred": False}, {"is_transferred": None}]},
                {"$or": [
                    {"added_by": user_name},
                    {"added_by": "System Import"},
                    {"added_by": {"$exists": False}},
                    {"added_by": None}
                ]}
            ]
        }
    
    # Count missed
    missed_count = await db.leads.count_documents({
        **base_query,
        "planned_followup_date": {"$lt": today, "$nin": [None, "", "nan", "NaN"]},
        "enquiry_stage": {"$nin": CLOSED_STAGES}
    })
    
    # Count today
    today_count = await db.leads.count_documents({
        **base_query,
        "planned_followup_date": today,
        "enquiry_stage": {"$nin": CLOSED_STAGES}
    })
    
    # Count upcoming
    upcoming_count = await db.leads.count_documents({
        **base_query,
        "planned_followup_date": {"$gt": today, "$lte": three_days},
        "enquiry_stage": {"$nin": CLOSED_STAGES}
    })
    
    return {
        "critical": missed_count,
        "warning": today_count,
        "info": upcoming_count,
        "total": missed_count + today_count + upcoming_count
    }
