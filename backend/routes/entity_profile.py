from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging

from models.user import User
from routes.auth import get_current_user

router = APIRouter(prefix="/entity", tags=["Entity Profile"])
logger = logging.getLogger(__name__)


async def get_db(request: Request):
    return request.app.state.db


@router.get("/search")
async def search_entities(
    request: Request,
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user)
):
    """Search for states, dealers, cities, and employees"""
    db = await get_db(request)
    results = []
    query_lower = q.lower()
    
    # Search states
    states = await db.leads.distinct("state")
    for state in states:
        if state and query_lower in state.lower():
            count = await db.leads.count_documents({"state": state})
            results.append({
                "type": "state",
                "name": state,
                "id": state,
                "lead_count": count
            })
    
    # Search dealers
    dealers = await db.leads.distinct("dealer")
    for dealer in dealers:
        if dealer and query_lower in dealer.lower():
            # Get dealer's state
            sample = await db.leads.find_one({"dealer": dealer})
            count = await db.leads.count_documents({"dealer": dealer})
            results.append({
                "type": "dealer",
                "name": dealer,
                "id": dealer,
                "state": sample.get("state") if sample else None,
                "lead_count": count
            })
    
    # Search cities/areas
    cities = await db.leads.distinct("area")
    for city in cities:
        if city and query_lower in city.lower():
            sample = await db.leads.find_one({"area": city})
            count = await db.leads.count_documents({"area": city})
            results.append({
                "type": "city",
                "name": city,
                "id": city,
                "state": sample.get("state") if sample else None,
                "lead_count": count
            })
    
    # Search employees
    employees = await db.leads.distinct("employee_name")
    for emp in employees:
        if emp and query_lower in emp.lower():
            sample = await db.leads.find_one({"employee_name": emp})
            count = await db.leads.count_documents({"employee_name": emp})
            results.append({
                "type": "employee",
                "name": emp,
                "id": emp,
                "dealer": sample.get("dealer") if sample else None,
                "state": sample.get("state") if sample else None,
                "lead_count": count
            })
    
    # Sort by lead count descending
    results.sort(key=lambda x: x.get("lead_count", 0), reverse=True)
    
    return {"results": results[:20]}


@router.get("/profile/{entity_type}/{entity_id}")
async def get_entity_profile(
    request: Request,
    entity_type: str,
    entity_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive profile for an entity (state/dealer/city/employee)"""
    db = await get_db(request)
    
    if entity_type not in ["state", "dealer", "city", "employee"]:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    # Build filter based on entity type
    field_map = {
        "state": "state",
        "dealer": "dealer",
        "city": "area",
        "employee": "employee_name"
    }
    
    filter_field = field_map[entity_type]
    base_filter = {filter_field: entity_id}
    
    # Add date filter if provided
    if start_date and end_date:
        base_filter["enquiry_date"] = {
            "$gte": start_date,
            "$lte": end_date
        }
    
    # Check if entity exists
    exists = await db.leads.find_one({filter_field: entity_id})
    if not exists:
        raise HTTPException(status_code=404, detail=f"{entity_type.capitalize()} not found")
    
    # Get basic info
    sample_lead = await db.leads.find_one({filter_field: entity_id})
    
    # Build profile data
    profile = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_id,
    }
    
    # Add parent info based on entity type
    if entity_type == "dealer":
        profile["state"] = sample_lead.get("state")
    elif entity_type == "city":
        profile["state"] = sample_lead.get("state")
    elif entity_type == "employee":
        profile["dealer"] = sample_lead.get("dealer")
        profile["state"] = sample_lead.get("state")
    
    # KPIs
    total_leads = await db.leads.count_documents(base_filter)
    
    won_filter = {**base_filter, "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]}}
    lost_filter = {**base_filter, "enquiry_stage": {"$in": ["Closed-Lost", "Closed-Dropped"]}}
    open_filter = {**base_filter, "enquiry_stage": {"$in": ["Prospecting", "Qualified", "Proposal", "Negotiation"]}}
    
    won_leads = await db.leads.count_documents(won_filter)
    lost_leads = await db.leads.count_documents(lost_filter)
    open_leads = await db.leads.count_documents(open_filter)
    closed_leads = won_leads + lost_leads
    
    conversion_rate = (won_leads / (won_leads + lost_leads) * 100) if (won_leads + lost_leads) > 0 else 0
    
    profile["kpis"] = {
        "total_leads": total_leads,
        "open_leads": open_leads,
        "won_leads": won_leads,
        "lost_leads": lost_leads,
        "closed_leads": closed_leads,
        "conversion_rate": round(conversion_rate, 2)
    }
    
    # Avg Lead Age (for open leads)
    pipeline_age = [
        {"$match": {**base_filter, "enquiry_stage": {"$in": ["Prospecting", "Qualified", "Proposal", "Negotiation"]}}},
        {"$addFields": {
            "enquiry_date_parsed": {"$dateFromString": {"dateString": "$enquiry_date", "onError": None}}
        }},
        {"$match": {"enquiry_date_parsed": {"$ne": None}}},
        {"$project": {
            "age_days": {
                "$divide": [
                    {"$subtract": [datetime.now(timezone.utc), "$enquiry_date_parsed"]},
                    1000 * 60 * 60 * 24
                ]
            }
        }},
        {"$group": {"_id": None, "avg_age": {"$avg": "$age_days"}}}
    ]
    
    age_result = await db.leads.aggregate(pipeline_age).to_list(1)
    avg_lead_age = round(age_result[0]["avg_age"], 1) if age_result and age_result[0].get("avg_age") else 0
    
    # Avg Closure Time (for closed leads)
    pipeline_closure = [
        {"$match": {**base_filter, "enquiry_stage": {"$in": ["Closed-Won", "Order Booked", "Closed-Lost", "Closed-Dropped"]}}},
        {"$addFields": {
            "enquiry_date_parsed": {"$dateFromString": {"dateString": "$enquiry_date", "onError": None}},
            "followup_date_parsed": {"$dateFromString": {"dateString": "$last_followup_date", "onError": None}}
        }},
        {"$match": {"enquiry_date_parsed": {"$ne": None}, "followup_date_parsed": {"$ne": None}}},
        {"$project": {
            "closure_days": {
                "$divide": [
                    {"$subtract": ["$followup_date_parsed", "$enquiry_date_parsed"]},
                    1000 * 60 * 60 * 24
                ]
            }
        }},
        {"$match": {"closure_days": {"$gte": 0}}},
        {"$group": {"_id": None, "avg_closure": {"$avg": "$closure_days"}}}
    ]
    
    closure_result = await db.leads.aggregate(pipeline_closure).to_list(1)
    avg_closure_time = round(closure_result[0]["avg_closure"], 1) if closure_result and closure_result[0].get("avg_closure") else 0
    
    profile["kpis"]["avg_lead_age"] = avg_lead_age
    profile["kpis"]["avg_closure_time"] = avg_closure_time
    
    # Lead Stage Breakdown
    stage_pipeline = [
        {"$match": base_filter},
        {"$group": {"_id": "$enquiry_stage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    stage_breakdown = await db.leads.aggregate(stage_pipeline).to_list(20)
    profile["stage_breakdown"] = [{"stage": s["_id"], "count": s["count"]} for s in stage_breakdown if s["_id"]]
    
    # Lead Source Breakdown
    source_pipeline = [
        {"$match": base_filter},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_breakdown = await db.leads.aggregate(source_pipeline).to_list(20)
    profile["source_breakdown"] = [{"source": s["_id"] or "Unknown", "count": s["count"]} for s in source_breakdown]
    
    # Segment Performance
    segment_pipeline = [
        {"$match": base_filter},
        {"$group": {
            "_id": "$segment",
            "total": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
            "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}}
    ]
    segment_data = await db.leads.aggregate(segment_pipeline).to_list(20)
    profile["segment_performance"] = [{
        "segment": s["_id"] or "Unknown",
        "total": s["total"],
        "won": s["won"],
        "lost": s["lost"],
        "conversion_rate": round((s["won"] / (s["won"] + s["lost"]) * 100), 1) if (s["won"] + s["lost"]) > 0 else 0
    } for s in segment_data]
    
    # Follow-up Status
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue_filter = {
        **base_filter,
        "planned_followup_date": {"$lt": today},
        "enquiry_stage": {"$nin": ["Closed-Won", "Order Booked", "Closed-Lost", "Closed-Dropped"]}
    }
    upcoming_filter = {
        **base_filter,
        "planned_followup_date": {"$gte": today},
        "enquiry_stage": {"$nin": ["Closed-Won", "Order Booked", "Closed-Lost", "Closed-Dropped"]}
    }
    
    overdue_count = await db.leads.count_documents(overdue_filter)
    upcoming_count = await db.leads.count_documents(upcoming_filter)
    
    profile["followup_status"] = {
        "overdue": overdue_count,
        "on_track": upcoming_count
    }
    
    # Trend Over Time (last 6 months)
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")
    trend_pipeline = [
        {"$match": {filter_field: entity_id, "enquiry_date": {"$gte": six_months_ago}}},
        {"$addFields": {
            "month": {"$substr": ["$enquiry_date", 0, 7]}
        }},
        {"$group": {
            "_id": "$month",
            "total": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
            "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    trend_data = await db.leads.aggregate(trend_pipeline).to_list(12)
    profile["trend"] = [{
        "month": t["_id"],
        "total": t["total"],
        "won": t["won"],
        "lost": t["lost"]
    } for t in trend_data]
    
    # Month-over-Month Comparison
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    prev_month = (datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    
    current_month_filter = {filter_field: entity_id, "enquiry_date": {"$regex": f"^{current_month}"}}
    prev_month_filter = {filter_field: entity_id, "enquiry_date": {"$regex": f"^{prev_month}"}}
    
    current_count = await db.leads.count_documents(current_month_filter)
    prev_count = await db.leads.count_documents(prev_month_filter)
    
    mom_change = ((current_count - prev_count) / prev_count * 100) if prev_count > 0 else 0
    
    profile["mom_comparison"] = {
        "current_month": current_month,
        "current_count": current_count,
        "prev_month": prev_month,
        "prev_count": prev_count,
        "change_percent": round(mom_change, 1)
    }
    
    # Sub-entities based on entity type
    if entity_type == "state":
        # Dealers in this state
        dealer_pipeline = [
            {"$match": {"state": entity_id}},
            {"$group": {
                "_id": "$dealer",
                "total": {"$sum": 1},
                "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
                "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 20}
        ]
        dealers = await db.leads.aggregate(dealer_pipeline).to_list(20)
        profile["sub_entities"] = {
            "dealers": [{
                "name": d["_id"],
                "total": d["total"],
                "won": d["won"],
                "lost": d["lost"],
                "conversion_rate": round((d["won"] / (d["won"] + d["lost"]) * 100), 1) if (d["won"] + d["lost"]) > 0 else 0
            } for d in dealers if d["_id"]]
        }
        
        # Cities in this state
        city_pipeline = [
            {"$match": {"state": entity_id}},
            {"$group": {
                "_id": "$area",
                "total": {"$sum": 1},
                "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
                "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 20}
        ]
        cities = await db.leads.aggregate(city_pipeline).to_list(20)
        profile["sub_entities"]["cities"] = [{
            "name": c["_id"],
            "total": c["total"],
            "won": c["won"],
            "lost": c["lost"],
            "conversion_rate": round((c["won"] / (c["won"] + c["lost"]) * 100), 1) if (c["won"] + c["lost"]) > 0 else 0
        } for c in cities if c["_id"]]
        
    elif entity_type == "dealer":
        # Employees under this dealer
        emp_pipeline = [
            {"$match": {"dealer": entity_id}},
            {"$group": {
                "_id": "$employee_name",
                "total": {"$sum": 1},
                "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
                "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 20}
        ]
        employees = await db.leads.aggregate(emp_pipeline).to_list(20)
        profile["sub_entities"] = {
            "employees": [{
                "name": e["_id"],
                "total": e["total"],
                "won": e["won"],
                "lost": e["lost"],
                "conversion_rate": round((e["won"] / (e["won"] + e["lost"]) * 100), 1) if (e["won"] + e["lost"]) > 0 else 0
            } for e in employees if e["_id"]]
        }
        
        # Cities covered by this dealer
        city_pipeline = [
            {"$match": {"dealer": entity_id}},
            {"$group": {
                "_id": "$area",
                "total": {"$sum": 1},
                "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
                "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 20}
        ]
        cities = await db.leads.aggregate(city_pipeline).to_list(20)
        profile["sub_entities"]["cities"] = [{
            "name": c["_id"],
            "total": c["total"],
            "won": c["won"],
            "lost": c["lost"],
            "conversion_rate": round((c["won"] / (c["won"] + c["lost"]) * 100), 1) if (c["won"] + c["lost"]) > 0 else 0
        } for c in cities if c["_id"]]
        
    elif entity_type == "city":
        # Dealers in this city
        dealer_pipeline = [
            {"$match": {"area": entity_id}},
            {"$group": {
                "_id": "$dealer",
                "total": {"$sum": 1},
                "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
                "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 20}
        ]
        dealers = await db.leads.aggregate(dealer_pipeline).to_list(20)
        profile["sub_entities"] = {
            "dealers": [{
                "name": d["_id"],
                "total": d["total"],
                "won": d["won"],
                "lost": d["lost"],
                "conversion_rate": round((d["won"] / (d["won"] + d["lost"]) * 100), 1) if (d["won"] + d["lost"]) > 0 else 0
            } for d in dealers if d["_id"]]
        }
    
    # Top Performers (for state and dealer)
    if entity_type in ["state", "dealer"]:
        if entity_type == "state":
            perf_field = "dealer"
        else:
            perf_field = "employee_name"
        
        top_pipeline = [
            {"$match": base_filter},
            {"$group": {
                "_id": f"${perf_field}",
                "total": {"$sum": 1},
                "won": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}},
                "lost": {"$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}}
            }},
            {"$match": {"$expr": {"$gt": [{"$add": ["$won", "$lost"]}, 5]}}},  # Min 5 closed leads
            {"$addFields": {
                "conversion_rate": {
                    "$cond": [
                        {"$gt": [{"$add": ["$won", "$lost"]}, 0]},
                        {"$multiply": [{"$divide": ["$won", {"$add": ["$won", "$lost"]}]}, 100]},
                        0
                    ]
                }
            }},
            {"$sort": {"conversion_rate": -1}},
            {"$limit": 3}
        ]
        top_performers = await db.leads.aggregate(top_pipeline).to_list(3)
        profile["top_performers"] = [{
            "name": t["_id"],
            "total": t["total"],
            "won": t["won"],
            "conversion_rate": round(t["conversion_rate"], 1)
        } for t in top_performers if t["_id"]]
    
    # Recent Leads (last 7 days, paginated)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    recent_filter = {**base_filter, "enquiry_date": {"$gte": seven_days_ago}}
    
    # Remove date range filter for recent leads query
    if "enquiry_date" in base_filter:
        recent_filter = {filter_field: entity_id, "enquiry_date": {"$gte": seven_days_ago}}
    
    recent_leads = await db.leads.find(
        recent_filter,
        {"_id": 0, "lead_id": 1, "enquiry_no": 1, "name": 1, "enquiry_date": 1, 
         "enquiry_stage": 1, "dealer": 1, "employee_name": 1, "segment": 1, "source": 1}
    ).sort("enquiry_date", -1).limit(10).to_list(10)
    
    recent_total = await db.leads.count_documents(recent_filter)
    
    profile["recent_leads"] = {
        "leads": recent_leads,
        "total": recent_total,
        "showing": len(recent_leads)
    }
    
    # Activity Timeline (recent activities for this entity's leads)
    lead_ids = await db.leads.distinct("lead_id", {filter_field: entity_id})
    activities = await db.activity_logs.find(
        {"resource": "lead", "resource_id": {"$in": lead_ids[:100]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    profile["activity_timeline"] = activities
    
    return profile


@router.get("/recent-leads/{entity_type}/{entity_id}")
async def get_entity_recent_leads(
    request: Request,
    entity_type: str,
    entity_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """Get paginated recent leads for an entity (last 7 days)"""
    db = await get_db(request)
    
    field_map = {
        "state": "state",
        "dealer": "dealer",
        "city": "area",
        "employee": "employee_name"
    }
    
    if entity_type not in field_map:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    filter_field = field_map[entity_type]
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    
    query_filter = {
        filter_field: entity_id,
        "enquiry_date": {"$gte": seven_days_ago}
    }
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query_filter)
    
    leads = await db.leads.find(
        query_filter,
        {"_id": 0, "lead_id": 1, "enquiry_no": 1, "name": 1, "enquiry_date": 1,
         "enquiry_stage": 1, "dealer": 1, "employee_name": 1, "segment": 1, 
         "source": 1, "state": 1, "area": 1, "phone_number": 1}
    ).sort("enquiry_date", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/export/{entity_type}/{entity_id}")
async def export_entity_leads(
    request: Request,
    entity_type: str,
    entity_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Export all leads for an entity to Excel"""
    from fastapi.responses import StreamingResponse
    import io
    
    try:
        import openpyxl
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    db = await get_db(request)
    
    field_map = {
        "state": "state",
        "dealer": "dealer",
        "city": "area",
        "employee": "employee_name"
    }
    
    if entity_type not in field_map:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    filter_field = field_map[entity_type]
    query_filter = {filter_field: entity_id}
    
    if start_date and end_date:
        query_filter["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
    
    leads = await db.leads.find(query_filter, {"_id": 0}).to_list(10000)
    
    if not leads:
        raise HTTPException(status_code=404, detail="No leads found")
    
    # Create Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{entity_type.capitalize()} Leads"
    
    # Headers
    if leads:
        headers = list(leads[0].keys())
        for col, header in enumerate(headers, 1):
            ws.cell(row=1, column=col, value=header)
        
        # Data
        for row, lead in enumerate(leads, 2):
            for col, header in enumerate(headers, 1):
                ws.cell(row=row, column=col, value=lead.get(header, ""))
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"{entity_type}_{entity_id}_leads.xlsx".replace(" ", "_")
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
