from fastapi import APIRouter, Request, Depends, Query
from typing import Optional, List
from datetime import datetime
import logging
import copy
import asyncio

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
    
    # Deep copy base_query to avoid mutating the original
    query = copy.deepcopy(base_query)
    
    # Handle boolean fields (like quotation_sent)
    if len(field_values) == 1 and isinstance(field_values[0], bool):
        query[field_name] = field_values[0]
    else:
        query[field_name] = {"$in": field_values}
    
    # Exclude soft-deleted leads
    query["deleted_at"] = {"$exists": False}
    
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
    end_date: Optional[str] = None,
    kva_min: Optional[float] = None,
    kva_max: Optional[float] = None
):
    """Get KPI metrics with optional filters - uses configurable metric settings"""
    db = await get_db(request)
    
    # Default to Indian FY if no dates provided
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Build base query - exclude soft-deleted, transferred leads, AND duplicates
    # This is used for counting leads in pipeline (enquiries, open, hot, etc.)
    base_query = {
        "is_deleted": {"$ne": True},
        "$and": [
            {"$or": [
                {"is_transferred": {"$exists": False}},
                {"is_transferred": False},
                {"is_transferred": None}
            ]},
            {"$or": [
                {"is_duplicate": {"$exists": False}},
                {"is_duplicate": False},
                {"is_duplicate": None}
            ]}
        ]
    }
    
    # Build won query - for won leads, DON'T exclude duplicates!
    # Each won lead represents a real sale, even from repeat customers
    # Use $and to properly group the is_transferred condition
    # IMPORTANT: Only count Won leads that have a matching SO record (has_so_record: true)
    won_base_query = {
        "is_deleted": {"$ne": True},
        "has_so_record": True,  # Only count verified SO leads as Won
        "$and": [
            {"$or": [
                {"is_transferred": {"$exists": False}},
                {"is_transferred": False},
                {"is_transferred": None}
            ]}
        ]
        # NOTE: No is_duplicate filter for won leads - repeat purchases count!
    }
    
    if state:
        base_query["state"] = state
        won_base_query["state"] = state
    if dealer:
        base_query["dealer"] = dealer
        won_base_query["dealer"] = dealer
    if employee_name:
        base_query["employee_name"] = employee_name
        won_base_query["employee_name"] = employee_name
    if segment:
        base_query["segment"] = segment
        won_base_query["segment"] = segment
    
    # KVA range filter
    if kva_min is not None or kva_max is not None:
        kva_filter = {}
        if kva_min is not None:
            kva_filter["$gte"] = kva_min
        if kva_max is not None:
            kva_filter["$lte"] = kva_max
        base_query["kva"] = kva_filter
        won_base_query["kva"] = kva_filter
    
    base_query["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
    won_base_query["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
    
    # Total leads (excluding transferred and duplicates) - for pipeline counting
    # Run all count queries in PARALLEL using asyncio.gather for performance
    
    # Build all query variants
    open_query = {**base_query, "enquiry_status": "Open"}
    hot_query = {**base_query, "enquiry_status": "Open", "enquiry_type": "Hot"}
    warm_query = {**base_query, "enquiry_status": "Open", "enquiry_type": "Warm"}
    cold_query = {**base_query, "enquiry_status": "Open", "enquiry_type": "Cold"}
    
    calls_placed_statuses = [
        'Called - No Response',
        'Called - Interested', 
        'Called - Not Interested',
        'Called - Follow Up Required',
        'Called - Converted'
    ]
    calls_placed_query = {**base_query, "call_status": {"$in": calls_placed_statuses}}
    not_called_query = {**base_query, "$or": [
        {"call_status": {"$exists": False}},
        {"call_status": None},
        {"call_status": "Not Called"}
    ]}
    
    transferred_query = {
        "is_deleted": {"$ne": True},
        "is_transferred": True,
        "enquiry_date": {"$gte": start_date, "$lte": end_date}
    }
    
    # KVA Category queries for open leads
    # LKVA: < 82.5, MKVA: 82.5 - 249, HKVA: >= 250
    open_lkva_query = {**base_query, "enquiry_status": "Open", "kva": {"$lt": 82.5}}
    open_mkva_query = {**base_query, "enquiry_status": "Open", "kva": {"$gte": 82.5, "$lt": 250}}
    open_hkva_query = {**base_query, "enquiry_status": "Open", "kva": {"$gte": 250}}
    
    dispatch_base_query = {
        "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
        "deleted_at": {"$exists": False}
    }
    if state:
        dispatch_base_query["state"] = state
    if dealer:
        dispatch_base_query["dealer"] = dealer
    
    pending_dispatch_query = {**dispatch_base_query, "dispatch_status": "pending"}
    dispatched_query = {**dispatch_base_query, "dispatch_status": "dispatched"}
    no_dispatch_status_query = {**dispatch_base_query, "dispatch_status": {"$exists": False}}
    qualified_query = {**base_query, "is_qualified": True}
    faulty_query = {**base_query, "is_qualified": False, "qualification_score": {"$exists": True}}
    
    # Quotations query
    quotations_sent_query = copy.deepcopy(won_base_query)
    quotations_sent_query["deleted_at"] = {"$exists": False}
    quotations_sent_query["$and"].append({
        "$or": [
            {"quotation_sent": True},
            {"quotation_no": {"$exists": True, "$ne": None, "$ne": ""}},
            {"quotation_date": {"$exists": True, "$ne": None, "$ne": ""}}
        ]
    })
    
    # Get metric configs in parallel
    metric_configs_task = asyncio.gather(
        get_metric_config(db, "won_leads"),
        get_metric_config(db, "lost_leads"),
        get_metric_config(db, "closed_config"),
        get_metric_config(db, "open_leads"),
        get_metric_config(db, "hot_leads"),
        get_metric_config(db, "warm_leads"),
        get_metric_config(db, "cold_leads"),
    )
    
    won_config, lost_config, closed_config, open_config, hot_config, warm_config, cold_config = await metric_configs_task
    
    # Build won query for metrics
    won_metric_query = copy.deepcopy(won_base_query)
    if won_config and won_config.get("field_name") and won_config.get("field_values"):
        won_metric_query[won_config["field_name"]] = {"$in": won_config["field_values"]}
    won_metric_query["deleted_at"] = {"$exists": False}
    
    # Build lost query for metrics
    lost_metric_query = copy.deepcopy(base_query)
    if lost_config and lost_config.get("field_name") and lost_config.get("field_values"):
        lost_metric_query[lost_config["field_name"]] = {"$in": lost_config["field_values"]}
    lost_metric_query["deleted_at"] = {"$exists": False}
    
    # Execute ALL count queries in parallel
    count_results = await asyncio.gather(
        db.leads.count_documents(base_query),  # 0: total_leads
        db.leads.count_documents(won_metric_query),  # 1: won_leads
        db.leads.count_documents(lost_metric_query),  # 2: lost_leads
        db.leads.count_documents(open_query),  # 3: open_leads
        db.leads.count_documents(hot_query),  # 4: hot_leads
        db.leads.count_documents(warm_query),  # 5: warm_leads
        db.leads.count_documents(cold_query),  # 6: cold_leads
        db.leads.count_documents(calls_placed_query),  # 7: calls_placed
        db.leads.count_documents(not_called_query),  # 8: not_called
        db.leads.count_documents(quotations_sent_query),  # 9: quotations_sent
        db.leads.count_documents(transferred_query),  # 10: transferred_leads
        db.leads.count_documents(pending_dispatch_query),  # 11: pending_dispatch
        db.leads.count_documents(dispatched_query),  # 12: dispatched_count
        db.leads.count_documents(no_dispatch_status_query),  # 13: no_dispatch_status
        db.leads.count_documents(qualified_query),  # 14: qualified_leads
        db.leads.count_documents(faulty_query),  # 15: faulty_leads
        db.leads.count_documents(open_lkva_query),  # 16: open_lkva
        db.leads.count_documents(open_mkva_query),  # 17: open_mkva
        db.leads.count_documents(open_hkva_query),  # 18: open_hkva
    )
    
    total_leads = count_results[0]
    won_leads = count_results[1]
    lost_leads = count_results[2]
    open_leads = count_results[3]
    hot_leads = count_results[4]
    warm_leads = count_results[5]
    cold_leads = count_results[6]
    calls_placed = count_results[7]
    not_called = count_results[8]
    quotations_sent = count_results[9]
    transferred_leads = count_results[10]
    pending_dispatch = count_results[11]
    dispatched_count = count_results[12]
    no_dispatch_status = count_results[13]
    qualified_leads = count_results[14]
    faulty_leads = count_results[15]
    open_lkva = count_results[16]
    open_mkva = count_results[17]
    open_hkva = count_results[18]
    
    # Closed leads count
    closed_leads = won_leads + lost_leads
    
    # Call to Quotation rate
    call_to_quotation_rate = (quotations_sent / calls_placed * 100) if calls_placed > 0 else 0
    
    # ============ QTY CALCULATIONS (PARALLEL) ============
    # Qty tracks gensets sold - only applicable to Won leads
    # Priority: won_qty > qty > 1 (default)
    # IMPORTANT: Use won_base_query for qty calculations (includes duplicate won leads)
    
    # Add deleted_at check for won qty calculations
    # Use deepcopy to avoid mutation issues
    qty_won_base_query = copy.deepcopy(won_base_query)
    qty_won_base_query["deleted_at"] = {"$exists": False}
    
    # Reusable qty aggregation expression
    qty_sum_expr = {"$sum": {
        "$cond": [
            {"$and": [{"$ne": ["$won_qty", None]}, {"$gt": ["$won_qty", 0]}]},
            "$won_qty",
            {"$cond": [
                {"$and": [{"$ne": ["$qty", None]}, {"$gt": ["$qty", 0]}]},
                "$qty",
                1
            ]}
        ]
    }}
    
    # Build all qty pipelines
    won_qty_pipeline = [
        {"$match": {**qty_won_base_query, "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]}}},
        {"$group": {"_id": None, "result": qty_sum_expr}}
    ]
    dispatched_qty_pipeline = [
        {"$match": {**qty_won_base_query, "dispatch_status": "dispatched"}},
        {"$group": {"_id": None, "result": qty_sum_expr}}
    ]
    pending_dispatch_qty_pipeline = [
        {"$match": {**qty_won_base_query, "dispatch_status": "pending"}},
        {"$group": {"_id": None, "result": qty_sum_expr}}
    ]
    
    # Execute all qty aggregations in parallel
    qty_results = await asyncio.gather(
        db.leads.aggregate(won_qty_pipeline).to_list(1),
        db.leads.aggregate(dispatched_qty_pipeline).to_list(1),
        db.leads.aggregate(pending_dispatch_qty_pipeline).to_list(1),
    )
    
    won_qty = qty_results[0][0]["result"] if qty_results[0] else 0
    dispatched_qty = qty_results[1][0]["result"] if qty_results[1] else 0
    pending_dispatch_qty = qty_results[2][0]["result"] if qty_results[2] else 0
    
    # ============ END QTY CALCULATIONS ============
    
    # ============ OLD ENQUIRIES CLOSED KPI (RUN IN PARALLEL) ============
    # This KPI shows leads that were WON within the selected date range
    # but their original enquiry_date is from BEFORE the selected start_date
    # This helps track sales from older pipeline leads
    
    old_enquiries_closed_query = {
        "is_deleted": {"$ne": True},
        "deleted_at": {"$exists": False},
        "$and": [
            {"$or": [
                {"is_transferred": {"$exists": False}},
                {"is_transferred": False},
                {"is_transferred": None}
            ]},
            {"$or": [
                {"is_duplicate": {"$exists": False}},
                {"is_duplicate": False},
                {"is_duplicate": None}
            ]}
        ],
        "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
        # Enquiry date is BEFORE the selected start_date
        "enquiry_date": {"$lt": start_date},
        # Won/closed within the selected date range (using won_date, invoice_date or sales_order_date)
        "$or": [
            {"won_date": {"$gte": start_date, "$lte": end_date}},
            {"invoice_date": {"$gte": start_date, "$lte": end_date}},
            {"sales_order_date": {"$gte": start_date, "$lte": end_date}}
        ]
    }
    
    # Apply same filters as base query
    if state:
        old_enquiries_closed_query["state"] = state
    if dealer:
        old_enquiries_closed_query["dealer"] = dealer
    if employee_name:
        old_enquiries_closed_query["employee_name"] = employee_name
    if segment:
        old_enquiries_closed_query["segment"] = segment
    
    old_enquiries_closed_qty_pipeline = [
        {"$match": old_enquiries_closed_query},
        {"$group": {"_id": None, "total_qty": qty_sum_expr}}
    ]
    
    # Run old enquiries count and qty in parallel
    old_enquiries_results = await asyncio.gather(
        db.leads.count_documents(old_enquiries_closed_query),
        db.leads.aggregate(old_enquiries_closed_qty_pipeline).to_list(1),
    )
    
    old_enquiries_closed_count = old_enquiries_results[0]
    old_enquiries_closed_qty = old_enquiries_results[1][0]["total_qty"] if old_enquiries_results[1] else 0
    
    # ============ END OLD ENQUIRIES CLOSED KPI ============
    
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
            "total_leads": total_leads,
            "calls_placed": calls_placed,
            "quotations_sent": quotations_sent
        }
        
        numerator = sum(metric_values.get(m.strip(), 0) for m in numerator_metrics)
        denominator = sum(metric_values.get(m.strip(), 0) for m in denominator_metrics)
        conversion_rate = (numerator / denominator * 100) if denominator > 0 else 0
    else:
        # Default formula: Won / (Won + Lost)
        closed_for_conversion = won_leads + lost_leads
        conversion_rate = (won_leads / closed_for_conversion * 100) if closed_for_conversion > 0 else 0
    
    # Calculate Average Lead Age (configurable)
    avg_lead_age_config = await get_metric_config(db, "avg_lead_age")
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    # Default: open leads, enquiry_date to today
    if avg_lead_age_config:
        age_filter_stages = avg_lead_age_config.get("filter_stages") or []
        age_start_field = avg_lead_age_config.get("start_date_field") or "enquiry_date"
        age_end_field = avg_lead_age_config.get("end_date_field") or "today"
    else:
        age_filter_stages = []
        age_start_field = "enquiry_date"
        age_end_field = "today"
    
    # If no filter stages specified, use open_leads stages
    if not age_filter_stages:
        age_filter_stages = open_config.get("field_values", ["Prospecting", "Qualified"]) if open_config else ["Prospecting", "Qualified"]
    
    # Build end date expression
    if age_end_field == "today":
        end_date_expr = {"$dateFromString": {"dateString": today_str}}
    else:
        end_date_expr = {"$dateFromString": {"dateString": f"${age_end_field}", "onError": {"$dateFromString": {"dateString": today_str}}}}
    
    avg_lead_age_pipeline = [
        {"$match": {
            **base_query, 
            "enquiry_stage": {"$in": age_filter_stages},
            age_start_field: {"$exists": True, "$nin": [None, ""]}
        }},
        {
            "$addFields": {
                "lead_age_days": {
                    "$divide": [
                        {"$subtract": [
                            end_date_expr,
                            {"$dateFromString": {"dateString": f"${age_start_field}", "onError": None}}
                        ]},
                        86400000  # milliseconds in a day
                    ]
                }
            }
        },
        {"$match": {"lead_age_days": {"$gte": 0, "$ne": None}}},
        {"$group": {"_id": None, "avg_age": {"$avg": "$lead_age_days"}}}
    ]
    
    avg_lead_age_result = await db.leads.aggregate(avg_lead_age_pipeline).to_list(1)
    avg_lead_age = round(avg_lead_age_result[0]["avg_age"], 1) if avg_lead_age_result and avg_lead_age_result[0].get("avg_age") else 0
    
    # Calculate Average Closure Time (configurable)
    avg_closure_config = await get_metric_config(db, "avg_closure_time")
    
    # Default: closed leads, enquiry_date to last_followup_date
    if avg_closure_config:
        closure_filter_stages = avg_closure_config.get("filter_stages") or []
        closure_start_field = avg_closure_config.get("start_date_field") or "enquiry_date"
        closure_end_field = avg_closure_config.get("end_date_field") or "last_followup_date"
    else:
        closure_filter_stages = []
        closure_start_field = "enquiry_date"
        closure_end_field = "last_followup_date"
    
    # If no filter stages specified, use closed stages
    if not closure_filter_stages:
        closure_filter_stages = (won_config.get("field_values", []) if won_config else []) + (lost_config.get("field_values", []) if lost_config else [])
        if not closure_filter_stages:
            closure_filter_stages = ["Closed-Won", "Order Booked", "Closed-Lost", "Closed-Dropped"]
    
    # Build end date expression for closure
    if closure_end_field == "today":
        closure_end_expr = {"$dateFromString": {"dateString": today_str}}
    else:
        closure_end_expr = {"$dateFromString": {"dateString": f"${closure_end_field}", "onError": {"$dateFromString": {"dateString": f"${closure_start_field}"}}}}
    
    avg_closure_pipeline = [
        {"$match": {
            **base_query, 
            "enquiry_stage": {"$in": closure_filter_stages},
            closure_start_field: {"$exists": True, "$nin": [None, ""]},
            closure_end_field: {"$exists": True, "$nin": [None, ""]}
        }},
        {
            "$addFields": {
                "closure_days": {
                    "$divide": [
                        {"$subtract": [
                            closure_end_expr,
                            {"$dateFromString": {"dateString": f"${closure_start_field}", "onError": None}}
                        ]},
                        86400000
                    ]
                }
            }
        },
        {"$match": {"closure_days": {"$gte": 0, "$ne": None}}},
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
        "conversion_rate": round(conversion_rate, 2),
        "calls_placed": calls_placed,
        "not_called": not_called,
        "quotations_sent": quotations_sent,
        "call_to_quotation_rate": round(call_to_quotation_rate, 2),
        "transferred_leads": transferred_leads
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
        "total_qty": won_qty,  # Total qty sold = won qty
        "won_leads": won_leads,
        "won_qty": won_qty,
        "lost_leads": lost_leads,
        "open_leads": open_leads,
        "closed_leads": closed_leads,
        "hot_leads": hot_leads,
        "warm_leads": warm_leads,
        "cold_leads": cold_leads,
        "qualified_leads": qualified_leads,
        "faulty_leads": faulty_leads,
        "conversion_rate": round(conversion_rate, 2),
        "avg_lead_age": avg_lead_age,
        "avg_closure_time": avg_closure_time,
        "calls_placed": calls_placed,
        "not_called": not_called,
        "quotations_sent": quotations_sent,
        "call_to_quotation_rate": round(call_to_quotation_rate, 2),
        "transferred_leads": transferred_leads,
        "pending_dispatch": pending_dispatch,
        "pending_dispatch_qty": pending_dispatch_qty,
        "dispatched": dispatched_count,
        "dispatched_qty": dispatched_qty,
        "needs_dispatch_migration": no_dispatch_status,
        "old_enquiries_closed": old_enquiries_closed_count,
        "old_enquiries_closed_qty": old_enquiries_closed_qty,
        # KVA Category breakdown for open leads
        "open_lkva": open_lkva,  # < 82.5 KVA
        "open_mkva": open_mkva,  # 82.5 - 249 KVA
        "open_hkva": open_hkva,  # >= 250 KVA
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
