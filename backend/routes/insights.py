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
    by: str = Query("employee", enum=["employee", "dealer", "state", "area"]),
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
        "area": "$area"
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



@router.get("/closure-analysis")
async def get_closure_analysis(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get analysis of closure questions for lost leads"""
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Get closure questions configuration
    questions = await db.closure_questions.find({}).to_list(100)
    question_map = {q.get("question_id"): q.get("question") for q in questions}
    
    # Get all leads with closure answers
    pipeline = [
        {
            "$match": {
                "closure_answers": {"$exists": True, "$ne": []},
                "enquiry_date": {"$gte": start_date, "$lte": end_date},
                "deleted_at": {"$exists": False}
            }
        },
        {
            "$project": {
                "_id": 0,
                "lead_id": 1,
                "closure_answers": 1,
                "closure_type": 1,
                "enquiry_stage": 1,
                "kva": 1,
                "state": 1,
                "dealer": 1,
                "employee_name": 1
            }
        }
    ]
    
    leads_with_answers = await db.leads.aggregate(pipeline).to_list(1000)
    
    # Aggregate answers by question
    question_stats = {}
    answer_breakdown = {}
    
    for lead in leads_with_answers:
        for answer in lead.get("closure_answers", []):
            q_id = answer.get("question_id")
            question = answer.get("question", question_map.get(q_id, "Unknown Question"))
            ans_value = answer.get("answer", "Not Answered")
            
            if question not in question_stats:
                question_stats[question] = {
                    "question": question,
                    "question_id": q_id,
                    "total_responses": 0,
                    "answers": {}
                }
            
            question_stats[question]["total_responses"] += 1
            
            if ans_value not in question_stats[question]["answers"]:
                question_stats[question]["answers"][ans_value] = 0
            question_stats[question]["answers"][ans_value] += 1
    
    # Convert to list format for frontend
    question_analysis = []
    for q_key, stats in question_stats.items():
        answers_list = [
            {"answer": ans, "count": count, "percentage": round((count / stats["total_responses"]) * 100, 1) if stats["total_responses"] > 0 else 0}
            for ans, count in sorted(stats["answers"].items(), key=lambda x: x[1], reverse=True)
        ]
        question_analysis.append({
            "question": stats["question"],
            "question_id": stats["question_id"],
            "total_responses": stats["total_responses"],
            "top_answers": answers_list[:10]  # Top 10 answers
        })
    
    # Get summary stats
    total_lost_leads = await db.leads.count_documents({
        "enquiry_stage": "Closed-Lost",
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False}
    })
    
    leads_with_closure_answers = await db.leads.count_documents({
        "closure_answers": {"$exists": True, "$ne": []},
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False}
    })
    
    pending_closure_questions = await db.leads.count_documents({
        "needs_closure_questions": True,
        "enquiry_date": {"$gte": start_date, "$lte": end_date},
        "deleted_at": {"$exists": False}
    })
    
    # Get closure reasons by state
    state_pipeline = [
        {
            "$match": {
                "closure_answers": {"$exists": True, "$ne": []},
                "enquiry_date": {"$gte": start_date, "$lte": end_date},
                "deleted_at": {"$exists": False}
            }
        },
        {
            "$group": {
                "_id": "$state",
                "count": {"$sum": 1},
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    
    by_state = await db.leads.aggregate(state_pipeline).to_list(15)
    
    # Get closure reasons by dealer
    dealer_pipeline = [
        {
            "$match": {
                "closure_answers": {"$exists": True, "$ne": []},
                "enquiry_date": {"$gte": start_date, "$lte": end_date},
                "deleted_at": {"$exists": False}
            }
        },
        {
            "$group": {
                "_id": "$dealer",
                "count": {"$sum": 1},
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]
    
    by_dealer = await db.leads.aggregate(dealer_pipeline).to_list(15)
    
    return {
        "summary": {
            "total_lost_leads": total_lost_leads,
            "leads_with_closure_answers": leads_with_closure_answers,
            "pending_closure_questions": pending_closure_questions,
            "completion_rate": round((leads_with_closure_answers / total_lost_leads) * 100, 1) if total_lost_leads > 0 else 0
        },
        "question_analysis": sorted(question_analysis, key=lambda x: x["total_responses"], reverse=True),
        "by_state": [
            {"state": s["_id"] or "Unknown", "count": s["count"], "kva_lost": round(s["total_kva"])}
            for s in by_state if s["_id"]
        ],
        "by_dealer": [
            {"dealer": d["_id"] or "Unknown", "count": d["count"], "kva_lost": round(d["total_kva"])}
            for d in by_dealer if d["_id"]
        ],
        "date_range": {"start_date": start_date, "end_date": end_date}
    }
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
