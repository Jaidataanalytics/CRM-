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
    by: str = Query("employee", enum=["employee", "dealer", "state", "location", "source"]),
    metric: str = Query("won", enum=["won", "total", "conversion_rate", "kva", "open", "lost", "calls_placed", "quotations_sent", "call_to_quotation_rate"]),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50)
):
    """Get top performers by various metrics"""
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Exclude soft-deleted leads
    base_match = {
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False}
    }
    
    group_field = {
        "employee": "$employee_name",
        "dealer": "$dealer",
        "state": "$state",
        "location": "$location",
        "source": "$source"
    }.get(by, "$employee_name")
    
    # Open stages - leads still being worked on
    OPEN_STAGES = ["Prospecting", "Qualified", "Proposal", "Negotiation"]
    
    pipeline = [
        {"$match": base_match},
        {
            "$group": {
                "_id": group_field,
                "total_leads": {"$sum": 1},
                "won_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}
                },
                "lost_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}
                },
                "open_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", OPEN_STAGES]}, 1, 0]}
                },
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}},
                "calls_placed": {
                    "$sum": {"$cond": [{"$in": ["$call_status", ["Called - No Response", "Called - Interested", "Called - Not Interested", "Called - Follow Up Required", "Called - Converted"]]}, 1, 0]}
                },
                "quotations_sent": {
                    "$sum": {"$cond": [{"$eq": ["$quotation_sent", True]}, 1, 0]}
                }
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
                },
                "call_to_quotation_rate": {
                    "$cond": [
                        {"$eq": ["$calls_placed", 0]},
                        0,
                        {
                            "$multiply": [
                                {"$divide": ["$quotations_sent", "$calls_placed"]},
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
        "kva": "total_kva",
        "open": "open_leads",
        "lost": "lost_leads",
        "calls_placed": "calls_placed",
        "quotations_sent": "quotations_sent",
        "call_to_quotation_rate": "call_to_quotation_rate"
    }.get(metric, "total_leads")
    
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
                "open_leads": r.get("open_leads", 0),
                "conversion_rate": round(r["conversion_rate"], 2),
                "total_kva": round(r["total_kva"], 2),
                "calls_placed": r.get("calls_placed", 0),
                "quotations_sent": r.get("quotations_sent", 0),
                "call_to_quotation_rate": round(r.get("call_to_quotation_rate", 0), 2)
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


@router.get("/closure-analysis")
async def get_closure_analysis(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get analysis of closure data for lost leads.
    Closure questions are: Competitor, Lost Reason, Lost Remarks
    """
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Lost stages query
    lost_stages_query = {
        "$and": [
            {"$or": [
                {"enquiry_stage": {"$regex": "^Closed-", "$options": "i"}},
                {"enquiry_stage": {"$regex": "^Lost$", "$options": "i"}}
            ]},
            {"enquiry_stage": {"$nin": ["Closed-Won", "Order Booked", "Closed-Faulty"]}}
        ]
    }
    
    base_query = {
        **lost_stages_query,
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False}
    }
    
    # Total lost leads
    total_lost_leads = await db.leads.count_documents(base_query)
    
    # Leads with closure data (competitor OR lost_reason OR lost_remarks)
    leads_with_closure_data = await db.leads.count_documents({
        **base_query,
        "$or": [
            {"competitor": {"$exists": True, "$ne": None, "$ne": ""}},
            {"lost_reason": {"$exists": True, "$ne": None, "$ne": ""}},
            {"lost_remarks": {"$exists": True, "$ne": None, "$ne": ""}}
        ]
    })
    
    # Leads pending closure questions
    pending_closure = await db.leads.count_documents({
        **base_query,
        "$and": [
            {"$or": [
                {"competitor": {"$exists": False}},
                {"competitor": None},
                {"competitor": ""}
            ]},
            {"$or": [
                {"lost_reason": {"$exists": False}},
                {"lost_reason": None},
                {"lost_reason": ""}
            ]}
        ]
    })
    
    # ============ COMPETITOR ANALYSIS (Question 1) ============
    competitor_pipeline = [
        {"$match": {
            **base_query,
            "competitor": {"$exists": True, "$ne": None, "$ne": ""}
        }},
        {"$group": {
            "_id": "$competitor",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    competitor_results = await db.leads.aggregate(competitor_pipeline).to_list(15)
    competitor_total = sum(r["count"] for r in competitor_results)
    
    competitor_analysis = {
        "question": "Which competitor won?",
        "question_id": "competitor",
        "total_responses": competitor_total,
        "top_answers": [
            {
                "answer": r["_id"],
                "count": r["count"],
                "percentage": round((r["count"] / competitor_total) * 100, 1) if competitor_total > 0 else 0
            }
            for r in competitor_results if r["_id"]
        ]
    }
    
    # ============ LOST REASON ANALYSIS (Question 2) ============
    lost_reason_pipeline = [
        {"$match": {
            **base_query,
            "lost_reason": {"$exists": True, "$ne": None, "$ne": ""}
        }},
        {"$group": {
            "_id": "$lost_reason",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    lost_reason_results = await db.leads.aggregate(lost_reason_pipeline).to_list(15)
    lost_reason_total = sum(r["count"] for r in lost_reason_results)
    
    lost_reason_analysis = {
        "question": "Why was the lead lost?",
        "question_id": "lost_reason",
        "total_responses": lost_reason_total,
        "top_answers": [
            {
                "answer": r["_id"],
                "count": r["count"],
                "percentage": round((r["count"] / lost_reason_total) * 100, 1) if lost_reason_total > 0 else 0
            }
            for r in lost_reason_results if r["_id"]
        ]
    }
    
    # ============ LOST REMARKS ANALYSIS (Question 3) ============
    # For remarks, just count how many have remarks
    leads_with_remarks = await db.leads.count_documents({
        **base_query,
        "lost_remarks": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    lost_remarks_analysis = {
        "question": "Additional remarks",
        "question_id": "lost_remarks",
        "total_responses": leads_with_remarks,
        "top_answers": [
            {"answer": "Has Remarks", "count": leads_with_remarks, "percentage": 100.0}
        ] if leads_with_remarks > 0 else []
    }
    
    # Combine question analyses
    question_analysis = []
    if competitor_analysis["total_responses"] > 0:
        question_analysis.append(competitor_analysis)
    if lost_reason_analysis["total_responses"] > 0:
        question_analysis.append(lost_reason_analysis)
    if lost_remarks_analysis["total_responses"] > 0:
        question_analysis.append(lost_remarks_analysis)
    
    # Get closure reasons by state
    state_pipeline = [
        {"$match": base_query},
        {"$group": {
            "_id": "$state",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    by_state = await db.leads.aggregate(state_pipeline).to_list(15)
    
    # Get closure reasons by dealer
    dealer_pipeline = [
        {"$match": base_query},
        {"$group": {
            "_id": "$dealer",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    by_dealer = await db.leads.aggregate(dealer_pipeline).to_list(15)
    
    return {
        "summary": {
            "total_lost_leads": total_lost_leads,
            "leads_with_closure_data": leads_with_closure_data,
            "pending_closure": pending_closure,
            "completion_rate": round((leads_with_closure_data / total_lost_leads) * 100, 1) if total_lost_leads > 0 else 0
        },
        "question_analysis": question_analysis,
        "by_state": [
            {"state": s["_id"] or "Unknown", "count": s["count"]}
            for s in by_state if s["_id"]
        ],
        "by_dealer": [
            {"dealer": d["_id"] or "Unknown", "count": d["count"]}
            for d in by_dealer if d["_id"]
        ],
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
    
    # Open stages
    OPEN_STAGES = ["Prospecting", "Qualified", "Proposal", "Negotiation"]
    
    pipeline = [
        {"$match": {"enquiry_date": {"$gte": start_date, "$lte": end_date}}},
        {
            "$group": {
                "_id": "$segment",
                "total_leads": {"$sum": 1},
                "won_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Won", "Order Booked"]]}, 1, 0]}
                },
                "lost_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", ["Closed-Lost", "Closed-Dropped"]]}, 1, 0]}
                },
                "open_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", OPEN_STAGES]}, 1, 0]}
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
                "open_leads": r.get("open_leads", 0),
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


@router.get("/district-performance")
async def get_district_performance(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: str = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get district-wise performance for a state"""
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    query = {"enquiry_date": {"$gte": start_date, "$lte": end_date}}
    if state:
        query["state"] = state
    
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": "$district",
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
                "conversion_rate": {
                    "$cond": [
                        {"$eq": [{"$add": ["$won_leads", "$lost_leads"]}, 0]},
                        0,
                        {"$multiply": [
                            {"$divide": ["$won_leads", {"$add": ["$won_leads", "$lost_leads"]}]},
                            100
                        ]}
                    ]
                }
            }
        },
        {"$sort": {"total_leads": -1}}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(100)
    
    return {
        "districts": [
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
        "state": state,
        "date_range": {"start_date": start_date, "end_date": end_date}
    }


@router.get("/competitor-analysis")
async def get_competitor_analysis(
    request: Request,
    current_user: User = Depends(get_current_user),
    dimension: str = Query("competitor", enum=["competitor", "lost_reason", "lost_remarks"]),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    segment: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get analysis of competitor, lost_reason, or lost_remarks for lost leads.
    This helps understand why leads are being lost and to whom.
    """
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Build query for lost leads
    query = {
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False},
        "$or": [
            {"enquiry_stage": {"$in": ["Closed-Lost", "Closed-Dropped"]}},
            {"closure_type": "lost"}
        ]
    }
    
    # Add optional filters
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if segment:
        query["segment"] = segment
    
    # The field to analyze
    field_map = {
        "competitor": "$competitor",
        "lost_reason": "$lost_reason",
        "lost_remarks": "$lost_remarks"
    }
    group_field = field_map.get(dimension, "$competitor")
    
    # Pipeline for aggregation
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": group_field,
                "count": {"$sum": 1},
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}},
                "states": {"$addToSet": "$state"},
                "dealers": {"$addToSet": "$dealer"},
                "segments": {"$addToSet": "$segment"}
            }
        },
        {"$match": {"_id": {"$ne": None, "$ne": ""}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(limit)
    
    # Get total lost leads for percentage calculation
    total_lost = await db.leads.count_documents(query)
    
    # Format results
    analysis = []
    for r in results:
        value = r["_id"]
        if value:
            analysis.append({
                "value": value,
                "count": r["count"],
                "percentage": round((r["count"] / total_lost * 100), 1) if total_lost > 0 else 0,
                "total_kva": round(r["total_kva"], 2),
                "unique_states": len([s for s in r.get("states", []) if s]),
                "unique_dealers": len([d for d in r.get("dealers", []) if d]),
                "unique_segments": len([s for s in r.get("segments", []) if s])
            })
    
    # Get summary statistics
    summary = {
        "total_lost_leads": total_lost,
        "with_data": sum(r["count"] for r in analysis),
        "without_data": total_lost - sum(r["count"] for r in analysis),
        "unique_values": len(analysis)
    }
    
    # Get top values by KVA
    top_by_kva = sorted(analysis, key=lambda x: x["total_kva"], reverse=True)[:5]
    
    return {
        "dimension": dimension,
        "analysis": analysis,
        "summary": summary,
        "top_by_kva": top_by_kva,
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "state": state,
            "dealer": dealer,
            "segment": segment
        }
    }


@router.get("/lost-leads-breakdown")
async def get_lost_leads_breakdown(
    request: Request,
    current_user: User = Depends(get_current_user),
    group_by: str = Query("competitor", enum=["competitor", "lost_reason", "state", "dealer", "segment", "employee_name"]),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    competitor: Optional[str] = None,
    lost_reason: Optional[str] = None
):
    """
    Get detailed breakdown of lost leads with multiple grouping options.
    Useful for drilling down into specific competitors or reasons.
    """
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Build query for lost leads
    query = {
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False},
        "$or": [
            {"enquiry_stage": {"$in": ["Closed-Lost", "Closed-Dropped"]}},
            {"closure_type": "lost"}
        ]
    }
    
    # Add drill-down filters
    if competitor:
        query["competitor"] = competitor
    if lost_reason:
        query["lost_reason"] = lost_reason
    
    # Group field
    field_map = {
        "competitor": "$competitor",
        "lost_reason": "$lost_reason",
        "state": "$state",
        "dealer": "$dealer",
        "segment": "$segment",
        "employee_name": "$employee_name"
    }
    group_field = field_map.get(group_by, "$competitor")
    
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": group_field,
                "count": {"$sum": 1},
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}},
                "avg_kva": {"$avg": {"$ifNull": ["$kva", 0]}}
            }
        },
        {"$match": {"_id": {"$ne": None, "$ne": ""}}},
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(50)
    
    total = await db.leads.count_documents(query)
    
    return {
        "group_by": group_by,
        "total_lost_leads": total,
        "breakdown": [
            {
                "name": r["_id"] or "Unknown",
                "count": r["count"],
                "percentage": round((r["count"] / total * 100), 1) if total > 0 else 0,
                "total_kva": round(r["total_kva"], 2),
                "avg_kva": round(r["avg_kva"], 2) if r["avg_kva"] else 0
            }
            for r in results
        ],
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "competitor": competitor,
            "lost_reason": lost_reason
        }
    }


@router.get("/summary-builder")
async def get_summary_builder(
    request: Request,
    current_user: User = Depends(get_current_user),
    metric: str = Query("leads", enum=["leads", "qty", "won_leads", "lost_leads", "conversion_rate"]),
    time_frame: str = Query("monthly", enum=["monthly", "quarterly", "yearly"]),
    dimension: str = Query("employee", enum=["employee", "dealer", "state", "location", "segment", "source"]),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Dynamic Summary Builder / Pivot Table endpoint.
    Allows users to create custom reports by selecting metric, time frame, and dimension.
    """
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Build base query - exclude soft-deleted leads
    base_query = {
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False}
    }
    
    # Dimension field mapping
    dimension_field_map = {
        "employee": "$employee_name",
        "dealer": "$dealer",
        "state": "$state",
        "location": "$location",
        "segment": "$segment",
        "source": "$source"
    }
    dimension_field = dimension_field_map.get(dimension, "$employee_name")
    
    # Time frame extraction
    time_frame_map = {
        "monthly": {"$substr": ["$enquiry_date", 0, 7]},  # YYYY-MM
        "quarterly": {
            "$concat": [
                {"$substr": ["$enquiry_date", 0, 4]},  # Year
                "-Q",
                {
                    "$switch": {
                        "branches": [
                            {"case": {"$in": [{"$substr": ["$enquiry_date", 5, 2]}, ["01", "02", "03"]]}, "then": "1"},
                            {"case": {"$in": [{"$substr": ["$enquiry_date", 5, 2]}, ["04", "05", "06"]]}, "then": "2"},
                            {"case": {"$in": [{"$substr": ["$enquiry_date", 5, 2]}, ["07", "08", "09"]]}, "then": "3"},
                            {"case": {"$in": [{"$substr": ["$enquiry_date", 5, 2]}, ["10", "11", "12"]]}, "then": "4"}
                        ],
                        "default": "1"
                    }
                }
            ]
        },
        "yearly": {"$substr": ["$enquiry_date", 0, 4]}  # YYYY
    }
    time_extraction = time_frame_map.get(time_frame, time_frame_map["monthly"])
    
    # Define won/lost stages
    WON_STAGES = ["Closed-Won", "Order Booked"]
    LOST_STAGES = ["Closed-Lost", "Closed-Dropped"]
    
    # Build aggregation pipeline
    pipeline = [
        {"$match": base_query},
        {
            "$addFields": {
                "time_period": time_extraction
            }
        },
        {
            "$group": {
                "_id": {
                    "dimension": dimension_field,
                    "time_period": "$time_period"
                },
                "total_leads": {"$sum": 1},
                "total_qty": {"$sum": {"$ifNull": ["$qty", 0]}},
                "won_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", WON_STAGES]}, 1, 0]}
                },
                "lost_leads": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", LOST_STAGES]}, 1, 0]}
                },
                "won_qty": {
                    "$sum": {"$cond": [{"$in": ["$enquiry_stage", WON_STAGES]}, {"$ifNull": ["$qty", 0]}, 0]}
                }
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
        {"$sort": {"_id.time_period": 1, "_id.dimension": 1}}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(1000)
    
    # Process results into pivot table format
    # Collect all unique time periods and dimensions
    time_periods = sorted(list(set(r["_id"]["time_period"] for r in results if r["_id"]["time_period"])))
    dimensions = sorted(list(set(r["_id"]["dimension"] for r in results if r["_id"]["dimension"])))
    
    # Create a lookup for quick access
    data_lookup = {}
    for r in results:
        dim = r["_id"]["dimension"]
        period = r["_id"]["time_period"]
        if dim and period:
            if dim not in data_lookup:
                data_lookup[dim] = {}
            data_lookup[dim][period] = {
                "leads": r["total_leads"],
                "qty": r["total_qty"],
                "won_leads": r["won_leads"],
                "lost_leads": r["lost_leads"],
                "won_qty": r["won_qty"],
                "conversion_rate": round(r["conversion_rate"], 1)
            }
    
    # Build pivot table rows
    pivot_rows = []
    for dim in dimensions:
        row = {
            "dimension": dim or "Unknown",
            "periods": {},
            "total": 0
        }
        for period in time_periods:
            cell = data_lookup.get(dim, {}).get(period, {
                "leads": 0, "qty": 0, "won_leads": 0, "lost_leads": 0, "won_qty": 0, "conversion_rate": 0
            })
            
            # Select the metric value
            if metric == "leads":
                value = cell["leads"]
            elif metric == "qty":
                value = cell["qty"]
            elif metric == "won_leads":
                value = cell["won_leads"]
            elif metric == "lost_leads":
                value = cell["lost_leads"]
            elif metric == "conversion_rate":
                value = cell["conversion_rate"]
            else:
                value = cell["leads"]
            
            row["periods"][period] = value
            row["total"] += value if metric != "conversion_rate" else 0
        
        # For conversion rate, calculate the total differently
        if metric == "conversion_rate":
            total_won = sum(data_lookup.get(dim, {}).get(p, {}).get("won_leads", 0) for p in time_periods)
            total_lost = sum(data_lookup.get(dim, {}).get(p, {}).get("lost_leads", 0) for p in time_periods)
            row["total"] = round((total_won / (total_won + total_lost) * 100), 1) if (total_won + total_lost) > 0 else 0
        
        pivot_rows.append(row)
    
    # Sort rows by total (descending)
    pivot_rows.sort(key=lambda x: x["total"], reverse=True)
    
    # Calculate column totals
    column_totals = {}
    for period in time_periods:
        if metric == "conversion_rate":
            total_won = sum(data_lookup.get(dim, {}).get(period, {}).get("won_leads", 0) for dim in dimensions)
            total_lost = sum(data_lookup.get(dim, {}).get(period, {}).get("lost_leads", 0) for dim in dimensions)
            column_totals[period] = round((total_won / (total_won + total_lost) * 100), 1) if (total_won + total_lost) > 0 else 0
        else:
            column_totals[period] = sum(row["periods"].get(period, 0) for row in pivot_rows)
    
    # Grand total
    if metric == "conversion_rate":
        total_won_all = sum(r["won_leads"] for r in results)
        total_lost_all = sum(r["lost_leads"] for r in results)
        grand_total = round((total_won_all / (total_won_all + total_lost_all) * 100), 1) if (total_won_all + total_lost_all) > 0 else 0
    else:
        grand_total = sum(row["total"] for row in pivot_rows)
    
    # Generate insights
    insights = []
    
    if len(pivot_rows) > 0:
        top_performer = pivot_rows[0]
        insights.append({
            "type": "top_performer",
            "message": f"Top {dimension}: {top_performer['dimension']} with {top_performer['total']:.0f} total {metric.replace('_', ' ')}"
        })
    
    # Trend analysis (if monthly or quarterly)
    if len(time_periods) >= 2 and metric != "conversion_rate":
        first_period_total = column_totals.get(time_periods[0], 0)
        last_period_total = column_totals.get(time_periods[-1], 0)
        if first_period_total > 0:
            growth = ((last_period_total - first_period_total) / first_period_total) * 100
            trend_direction = "up" if growth > 0 else "down" if growth < 0 else "stable"
            insights.append({
                "type": "trend",
                "message": f"Overall {metric.replace('_', ' ')} is {trend_direction} {abs(growth):.1f}% from {time_periods[0]} to {time_periods[-1]}",
                "growth": round(growth, 1)
            })
    
    # Find best performing period
    if column_totals:
        best_period = max(column_totals, key=column_totals.get)
        insights.append({
            "type": "best_period",
            "message": f"Best period: {best_period} with {column_totals[best_period]:.0f} {metric.replace('_', ' ')}"
        })
    
    return {
        "pivot_table": {
            "columns": time_periods,
            "rows": pivot_rows,
            "column_totals": column_totals,
            "grand_total": grand_total
        },
        "meta": {
            "metric": metric,
            "time_frame": time_frame,
            "dimension": dimension,
            "date_range": {"start_date": start_date, "end_date": end_date}
        },
        "insights": insights
    }
