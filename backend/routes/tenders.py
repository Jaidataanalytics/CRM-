from fastapi import APIRouter, HTTPException, Request, Depends, Query, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import os
import httpx
import base64

from models.user import User
from routes.auth import get_current_user
from database import get_db

router = APIRouter(prefix="/tenders", tags=["Tenders"])

# Tender status options
TENDER_STATUSES = ["pending", "participated", "won", "lost", "not_participated", "cancelled"]

# Document types
DOCUMENT_TYPES = ["bid_doc", "technical_spec", "boq", "our_quotation", "result_letter", "other"]


def serialize_tender(tender):
    """Convert MongoDB document to JSON-serializable dict"""
    if tender is None:
        return None
    tender["_id"] = str(tender["_id"])
    if "documents" in tender:
        for doc in tender["documents"]:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
    return tender


@router.get("")
async def list_tenders(
    request: Request,
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    department: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    search: Optional[str] = None
):
    """List all tenders with filters"""
    db = await get_db(request)
    
    query = {"deleted_at": {"$exists": False}}
    
    if status:
        query["status"] = status
    if department:
        query["department_name"] = {"$regex": department, "$options": "i"}
    if start_date:
        query["bid_end_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("bid_end_date", {})["$lte"] = end_date
    if min_value:
        query["estimated_value"] = {"$gte": min_value}
    if max_value:
        query.setdefault("estimated_value", {})["$lte"] = max_value
    if search:
        query["$or"] = [
            {"bid_number": {"$regex": search, "$options": "i"}},
            {"department_name": {"$regex": search, "$options": "i"}},
            {"beneficiary": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.tenders.count_documents(query)
    skip = (page - 1) * limit
    
    tenders = await db.tenders.find(query).sort("bid_end_date", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "tenders": [serialize_tender(t) for t in tenders],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/stats")
async def get_tender_stats(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get tender statistics for dashboard"""
    db = await get_db(request)
    
    base_query = {"deleted_at": {"$exists": False}}
    if start_date:
        base_query["dated"] = {"$gte": start_date}
    if end_date:
        base_query.setdefault("dated", {})["$lte"] = end_date
    
    total = await db.tenders.count_documents(base_query)
    won = await db.tenders.count_documents({**base_query, "status": "won"})
    lost = await db.tenders.count_documents({**base_query, "status": "lost"})
    pending = await db.tenders.count_documents({**base_query, "status": "pending"})
    participated = await db.tenders.count_documents({**base_query, "status": {"$in": ["participated", "won", "lost"]}})
    not_participated = await db.tenders.count_documents({**base_query, "status": "not_participated"})
    
    # Total values
    pipeline = [
        {"$match": base_query},
        {"$group": {
            "_id": None,
            "total_value": {"$sum": "$estimated_value"},
            "won_value": {"$sum": {"$cond": [{"$eq": ["$status", "won"]}, "$estimated_value", 0]}},
            "our_total_bid": {"$sum": {"$cond": [{"$gt": ["$our_bid_amount", 0]}, "$our_bid_amount", 0]}}
        }}
    ]
    value_stats = await db.tenders.aggregate(pipeline).to_list(1)
    values = value_stats[0] if value_stats else {"total_value": 0, "won_value": 0, "our_total_bid": 0}
    
    # Win rate
    win_rate = round((won / participated * 100), 1) if participated > 0 else 0
    
    # Upcoming deadlines (next 7 days)
    from datetime import timedelta
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    next_week = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    upcoming = await db.tenders.count_documents({
        **base_query,
        "status": "pending",
        "bid_end_date": {"$gte": today, "$lte": next_week}
    })
    
    return {
        "total": total,
        "won": won,
        "lost": lost,
        "pending": pending,
        "participated": participated,
        "not_participated": not_participated,
        "win_rate": win_rate,
        "total_value": values.get("total_value", 0),
        "won_value": values.get("won_value", 0),
        "our_total_bid": values.get("our_total_bid", 0),
        "upcoming_deadlines": upcoming
    }


@router.get("/analytics")
async def get_tender_analytics(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get detailed analytics for tenders"""
    db = await get_db(request)
    
    base_query = {"deleted_at": {"$exists": False}}
    if start_date:
        base_query["dated"] = {"$gte": start_date}
    if end_date:
        base_query.setdefault("dated", {})["$lte"] = end_date
    
    # Win rate by department
    dept_pipeline = [
        {"$match": {**base_query, "status": {"$in": ["won", "lost"]}}},
        {"$group": {
            "_id": "$department_name",
            "total": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$status", "won"]}, 1, 0]}},
            "total_value": {"$sum": "$estimated_value"},
            "won_value": {"$sum": {"$cond": [{"$eq": ["$status", "won"]}, "$estimated_value", 0]}}
        }},
        {"$addFields": {
            "win_rate": {"$cond": [{"$gt": ["$total", 0]}, {"$multiply": [{"$divide": ["$won", "$total"]}, 100]}, 0]}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    by_department = await db.tenders.aggregate(dept_pipeline).to_list(10)
    
    # Monthly trend
    monthly_pipeline = [
        {"$match": base_query},
        {"$addFields": {
            "month": {"$substr": ["$dated", 0, 7]}
        }},
        {"$group": {
            "_id": "$month",
            "total": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$status", "won"]}, 1, 0]}},
            "lost": {"$sum": {"$cond": [{"$eq": ["$status", "lost"]}, 1, 0]}},
            "participated": {"$sum": {"$cond": [{"$in": ["$status", ["won", "lost", "participated"]]}, 1, 0]}},
            "total_value": {"$sum": "$estimated_value"}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12}
    ]
    monthly_trend = await db.tenders.aggregate(monthly_pipeline).to_list(12)
    
    # Win rate by value range
    value_ranges = [
        {"min": 0, "max": 500000, "label": "< 5 Lakh"},
        {"min": 500000, "max": 1000000, "label": "5-10 Lakh"},
        {"min": 1000000, "max": 2500000, "label": "10-25 Lakh"},
        {"min": 2500000, "max": 5000000, "label": "25-50 Lakh"},
        {"min": 5000000, "max": float('inf'), "label": "> 50 Lakh"}
    ]
    
    by_value_range = []
    for vr in value_ranges:
        vr_query = {
            **base_query,
            "status": {"$in": ["won", "lost"]},
            "estimated_value": {"$gte": vr["min"]}
        }
        if vr["max"] != float('inf'):
            vr_query["estimated_value"]["$lt"] = vr["max"]
        
        total = await db.tenders.count_documents(vr_query)
        won = await db.tenders.count_documents({**vr_query, "status": "won"})
        
        by_value_range.append({
            "range": vr["label"],
            "total": total,
            "won": won,
            "win_rate": round((won / total * 100), 1) if total > 0 else 0
        })
    
    # Top competitors
    competitor_pipeline = [
        {"$match": {**base_query, "competitors": {"$exists": True, "$ne": []}}},
        {"$unwind": "$competitors"},
        {"$group": {
            "_id": "$competitors.name",
            "total_participations": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$eq": ["$competitors.rank", 1]}, 1, 0]}},
            "avg_bid": {"$avg": "$competitors.bid_amount"}
        }},
        {"$addFields": {
            "win_rate": {"$cond": [{"$gt": ["$total_participations", 0]}, {"$multiply": [{"$divide": ["$wins", "$total_participations"]}, 100]}, 0]}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": 10}
    ]
    top_competitors = await db.tenders.aggregate(competitor_pipeline).to_list(10)
    
    return {
        "by_department": by_department,
        "monthly_trend": monthly_trend,
        "by_value_range": by_value_range,
        "top_competitors": top_competitors
    }


@router.get("/competitors")
async def get_competitor_analysis(
    request: Request,
    current_user: User = Depends(get_current_user),
    competitor_name: Optional[str] = None
):
    """Get historical competitor analysis"""
    db = await get_db(request)
    
    base_query = {
        "deleted_at": {"$exists": False},
        "competitors": {"$exists": True, "$ne": []}
    }
    
    if competitor_name:
        base_query["competitors.name"] = {"$regex": competitor_name, "$options": "i"}
    
    # Get all unique competitors
    all_competitors_pipeline = [
        {"$match": {"deleted_at": {"$exists": False}, "competitors": {"$exists": True, "$ne": []}}},
        {"$unwind": "$competitors"},
        {"$group": {
            "_id": "$competitors.name",
            "participations": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$eq": ["$competitors.rank", 1]}, 1, 0]}},
            "total_bid_value": {"$sum": "$competitors.bid_amount"},
            "avg_bid": {"$avg": "$competitors.bid_amount"},
            "tenders": {"$push": {
                "bid_number": "$bid_number",
                "department": "$department_name",
                "estimated_value": "$estimated_value",
                "competitor_bid": "$competitors.bid_amount",
                "rank": "$competitors.rank",
                "date": "$dated"
            }}
        }},
        {"$addFields": {
            "win_rate": {"$cond": [{"$gt": ["$participations", 0]}, {"$round": [{"$multiply": [{"$divide": ["$wins", "$participations"]}, 100]}, 1]}, 0]}
        }},
        {"$sort": {"participations": -1}},
        {"$limit": 50}
    ]
    
    competitors = await db.tenders.aggregate(all_competitors_pipeline).to_list(50)
    
    return {
        "competitors": competitors,
        "total_unique": len(competitors)
    }


@router.get("/{tender_id}")
async def get_tender(
    request: Request,
    tender_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get single tender by ID"""
    db = await get_db(request)
    
    try:
        tender = await db.tenders.find_one({"_id": ObjectId(tender_id), "deleted_at": {"$exists": False}})
    except:
        raise HTTPException(status_code=400, detail="Invalid tender ID")
    
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    return serialize_tender(tender)


@router.post("")
async def create_tender(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create a new tender"""
    db = await get_db(request)
    data = await request.json()
    
    tender = {
        "bid_number": data.get("bid_number", ""),
        "dated": data.get("dated", ""),
        "bid_end_date": data.get("bid_end_date", ""),
        "bid_opening_date": data.get("bid_opening_date", ""),
        "department_name": data.get("department_name", ""),
        "total_quantity": data.get("total_quantity", 0),
        "estimated_value": data.get("estimated_value", 0),
        "beneficiary": data.get("beneficiary", ""),
        "consignees": data.get("consignees", []),
        "emd_amount": data.get("emd_amount", 0),
        "item_specifications": data.get("item_specifications", ""),
        "product_category": data.get("product_category", ""),
        "delivery_period": data.get("delivery_period", 0),
        "warranty_period": data.get("warranty_period", ""),
        "payment_terms": data.get("payment_terms", ""),
        
        # Manual fields
        "status": data.get("status", "pending"),
        "our_bid_amount": data.get("our_bid_amount", 0),
        "assigned_employee": data.get("assigned_employee", ""),
        "notes": data.get("notes", ""),
        
        # Winner/Result
        "winner_name": data.get("winner_name", ""),
        "winner_amount": data.get("winner_amount", 0),
        "result_date": data.get("result_date", ""),
        "loss_reason": data.get("loss_reason", ""),
        
        # Competitors
        "competitors": data.get("competitors", []),
        
        # Documents
        "documents": data.get("documents", []),
        
        # Timeline
        "timeline": [{
            "action": "created",
            "date": datetime.now(timezone.utc).isoformat(),
            "user": current_user.email,
            "details": "Tender created"
        }],
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.email
    }
    
    result = await db.tenders.insert_one(tender)
    tender["_id"] = str(result.inserted_id)
    
    return tender


@router.put("/{tender_id}")
async def update_tender(
    request: Request,
    tender_id: str,
    current_user: User = Depends(get_current_user)
):
    """Update a tender"""
    db = await get_db(request)
    data = await request.json()
    
    try:
        existing = await db.tenders.find_one({"_id": ObjectId(tender_id), "deleted_at": {"$exists": False}})
    except:
        raise HTTPException(status_code=400, detail="Invalid tender ID")
    
    if not existing:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    # Track status change in timeline
    timeline_entry = None
    if "status" in data and data["status"] != existing.get("status"):
        timeline_entry = {
            "action": "status_changed",
            "date": datetime.now(timezone.utc).isoformat(),
            "user": current_user.email,
            "details": f"Status changed from {existing.get('status')} to {data['status']}"
        }
    
    # Update fields
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    allowed_fields = [
        "bid_number", "dated", "bid_end_date", "bid_opening_date", "department_name",
        "total_quantity", "estimated_value", "beneficiary", "consignees", "emd_amount",
        "item_specifications", "product_category", "delivery_period", "warranty_period",
        "payment_terms", "status", "our_bid_amount", "assigned_employee", "notes",
        "winner_name", "winner_amount", "result_date", "loss_reason", "competitors"
    ]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    if timeline_entry:
        update_data["$push"] = {"timeline": timeline_entry}
        await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {"$set": {k: v for k, v in update_data.items() if k != "$push"}, "$push": update_data["$push"]}
        )
    else:
        await db.tenders.update_one({"_id": ObjectId(tender_id)}, {"$set": update_data})
    
    updated = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    return serialize_tender(updated)


@router.delete("/{tender_id}")
async def delete_tender(
    request: Request,
    tender_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a tender"""
    db = await get_db(request)
    
    try:
        result = await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid tender ID")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    return {"message": "Tender deleted successfully"}


@router.post("/{tender_id}/documents")
async def add_document(
    request: Request,
    tender_id: str,
    current_user: User = Depends(get_current_user)
):
    """Add a document to a tender"""
    db = await get_db(request)
    data = await request.json()
    
    try:
        existing = await db.tenders.find_one({"_id": ObjectId(tender_id), "deleted_at": {"$exists": False}})
    except:
        raise HTTPException(status_code=400, detail="Invalid tender ID")
    
    if not existing:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    document = {
        "_id": str(ObjectId()),
        "name": data.get("name", "Document"),
        "type": data.get("type", "other"),
        "url": data.get("url", ""),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.email
    }
    
    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {
            "$push": {"documents": document},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return document


@router.delete("/{tender_id}/documents/{doc_id}")
async def remove_document(
    request: Request,
    tender_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a document from a tender"""
    db = await get_db(request)
    
    try:
        result = await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {
                "$pull": {"documents": {"_id": doc_id}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid tender ID")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document removed successfully"}


@router.post("/extract-pdf")
async def extract_pdf_data(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Extract tender data from uploaded PDF using AI"""
    db = await get_db(request)
    data = await request.json()
    
    pdf_url = data.get("pdf_url")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="PDF URL is required")
    
    # Use Gemini for PDF extraction
    try:
        from emergentintegrations.llm.gemini import GeminiChat, GeminiConfig
        
        config = GeminiConfig(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            model="gemini-2.0-flash"
        )
        chat = GeminiChat(config=config)
        
        extraction_prompt = """Extract the following fields from this tender/bid document PDF. Return ONLY a JSON object with these exact keys:

{
    "bid_number": "the bid/tender number",
    "dated": "YYYY-MM-DD format",
    "bid_end_date": "YYYY-MM-DD HH:MM:SS format",
    "bid_opening_date": "YYYY-MM-DD HH:MM:SS format", 
    "department_name": "full department name",
    "total_quantity": number,
    "estimated_value": number (in rupees, no commas),
    "beneficiary": "beneficiary name and address",
    "consignees": [{"name": "", "address": "", "quantity": number, "delivery_days": number}],
    "emd_amount": number,
    "item_specifications": "brief description of items",
    "product_category": "product category",
    "delivery_period": number (in days),
    "warranty_period": "warranty description",
    "payment_terms": "payment terms summary"
}

If a field is not found, use empty string for text, 0 for numbers, or empty array for arrays."""

        response = await chat.send_message_async(
            message=extraction_prompt,
            file_paths=[pdf_url]
        )
        
        # Parse JSON from response
        import json
        import re
        
        # Try to extract JSON from response
        response_text = response.text if hasattr(response, 'text') else str(response)
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        
        if json_match:
            extracted_data = json.loads(json_match.group())
            return {"success": True, "data": extracted_data}
        else:
            return {"success": False, "error": "Could not parse JSON from response", "raw_response": response_text}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/upcoming/deadlines")
async def get_upcoming_deadlines(
    request: Request,
    current_user: User = Depends(get_current_user),
    days: int = Query(7, ge=1, le=30)
):
    """Get tenders with upcoming deadlines"""
    db = await get_db(request)
    
    from datetime import timedelta
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
    
    tenders = await db.tenders.find({
        "deleted_at": {"$exists": False},
        "status": "pending",
        "bid_end_date": {"$gte": today, "$lte": future_date}
    }).sort("bid_end_date", 1).to_list(50)
    
    return {
        "tenders": [serialize_tender(t) for t in tenders],
        "count": len(tenders)
    }
