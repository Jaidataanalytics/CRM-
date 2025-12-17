from fastapi import APIRouter, Request, Depends, Query
from typing import Optional, List
import logging

from models.user import User
from routes.auth import get_current_user
from routes.kpis import get_indian_fy_dates

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/insights", tags=["Insights"])


async def get_db(request: Request):
    return request.app.state.db


@router.get("/top-performers")
async def get_top_performers(
    request: Request,
    current_user: User = Depends(get_current_user),
    by: str = Query("employee", enum=["employee", "dealer", "state"]),
    metric: str = Query("won", enum=["won", "total", "conversion_rate", "kva"]),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50)
):
    """Get top performers by various metrics"""
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    base_match = {"enquiry_date": {"$gte": start_date, "$lte": end_date}}
    
    group_field = {
        "employee": "$employee_name",
        "dealer": "$dealer",
        "state": "$state"
    }[by]
    
    pipeline = [
        {"$match": base_match},
        {
            "$group": {
                "_id": group_field,
                "total_leads": {"$sum": 1},
                "won_leads": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}
                },
                "lost_leads": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}
                },
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
            }
        },
        {
            "$addFields": {
                "closed_total": {"$add": ["$won_leads", "$lost_leads"]},
                "conversion_rate": {
                    "$cond": [
                        {"$eq": [{"$add": ["$won_leads", "$lost_leads"]}, 0]},
                        0,
                        {
                            "$multiply": [
                                {"$divide": ["$won_leads", {"$add": ["$won_leads", "$lost_leads"]}]},
                                100
                            ]
                        }
                    ]
                }
            }
        }
    ]
    
    # Sort by selected metric
    sort_field = {
        "won": "won_leads",
        "total": "total_leads",
        "conversion_rate": "conversion_rate",
        "kva": "total_kva"
    }[metric]
    
    pipeline.append({"$sort": {sort_field: -1}})
    pipeline.append({"$limit": limit})
    
    results = await db.leads.aggregate(pipeline).to_list(limit)
    
    return {
        "performers": [
            {
                "name": r["_id"] or "Unknown",
                "total_leads": r["total_leads"],
                "won_leads": r["won_leads"],
                "lost_leads": r["lost_leads"],
                "conversion_rate": round(r["conversion_rate"], 2),
                "total_kva": round(r["total_kva"], 2)
            }
            for r in results if r["_id"]
        ],
        "by": by,
        "metric": metric,
        "date_range": {"start_date": start_date, "end_date": end_date}
    }


@router.get("/conversion-vs-followups")
async def get_conversion_vs_followups(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Analyze conversion rate vs number of follow-ups"""
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    pipeline = [
        {
            "$match": {
                "enquiry_date": {"$gte": start_date, "$lte": end_date},
                "no_of_followups": {"$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$no_of_followups",
                "total": {"$sum": 1},
                "won": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}
                },
                "lost": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(50)
    
    data = []
    for r in results:
        closed = r["won"] + r["lost"]
        conversion = (r["won"] / closed * 100) if closed > 0 else 0
        data.append({
            "followups": r["_id"],
            "total_leads": r["total"],
            "won": r["won"],
            "lost": r["lost"],
            "conversion_rate": round(conversion, 2)
        })
    
    return {
        "data": data,
        "date_range": {"start_date": start_date, "end_date": end_date}
    }


@router.get("/segment-analysis")
async def get_segment_analysis(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Detailed segment analysis"""
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    pipeline = [
        {"$match": {"enquiry_date": {"$gte": start_date, "$lte": end_date}}},
        {
            "$group": {
                "_id": "$segment",
                "total_leads": {"$sum": 1},
                "won_leads": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}
                },
                "lost_leads": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}
                },
                "hot_leads": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_type", "Hot"]}, 1, 0]}
                },
                "avg_kva": {"$avg": {"$ifNull": ["$kva", 0]}},
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
            }
        },
        {
            "$addFields": {
                "conversion_rate": {
                    "$cond": [
                        {"$eq": [{"$add": ["$won_leads", "$lost_leads"]}, 0]},
                        0,
                        {
                            "$multiply": [
                                {"$divide": ["$won_leads", {"$add": ["$won_leads", "$lost_leads"]}]},
                                100
                            ]
                        }
                    ]
                }
            }
        },
        {"$sort": {"total_leads": -1}}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(50)
    
    return {
        "segments": [
            {
                "segment": r["_id"] or "Unknown",
                "total_leads": r["total_leads"],
                "won_leads": r["won_leads"],
                "lost_leads": r["lost_leads"],
                "hot_leads": r["hot_leads"],
                "conversion_rate": round(r["conversion_rate"], 2),
                "avg_kva": round(r["avg_kva"], 2),
                "total_kva": round(r["total_kva"], 2)
            }
            for r in results
        ],
        "date_range": {"start_date": start_date, "end_date": end_date}
    }


@router.get("/monthly-trends")
async def get_monthly_trends(
    request: Request,
    current_user: User = Depends(get_current_user),
    months: int = Query(12, ge=3, le=24)
):
    """Get monthly lead trends"""
    db = await get_db(request)
    
    pipeline = [
        {
            "$addFields": {
                "month": {"$substr": ["$enquiry_date", 0, 7]}
            }
        },
        {
            "$group": {
                "_id": "$month",
                "total_leads": {"$sum": 1},
                "won": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}
                },
                "lost": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}
                },
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
            }
        },
        {"$sort": {"_id": -1}},
        {"$limit": months}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(months)
    results.reverse()  # Chronological order
    
    return {
        "trends": [
            {
                "month": r["_id"],
                "total_leads": r["total_leads"],
                "won": r["won"],
                "lost": r["lost"],
                "total_kva": round(r["total_kva"], 2)
            }
            for r in results if r["_id"]
        ]
    }
