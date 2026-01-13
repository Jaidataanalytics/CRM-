"""
Summary Builder API - Pivot table functionality for lead analytics
"""
from fastapi import APIRouter, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import logging

from models.user import User
from routes.auth import get_current_user
from routes.kpis import get_indian_fy_dates

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/summary-builder", tags=["Summary Builder"])


async def get_db(request: Request):
    return request.app.state.db


def get_period_boundaries(start_date: str, end_date: str, period_type: str):
    """
    Generate period boundaries based on period_type
    Returns list of (period_label, start, end) tuples
    """
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    
    periods = []
    
    if period_type == 'monthly':
        current = start.replace(day=1)
        while current <= end:
            period_end = (current + relativedelta(months=1)) - timedelta(days=1)
            if period_end > end:
                period_end = end
            label = current.strftime('%b %Y')  # e.g., "Apr 2025"
            periods.append({
                'label': label,
                'start': current.strftime('%Y-%m-%d'),
                'end': period_end.strftime('%Y-%m-%d')
            })
            current = current + relativedelta(months=1)
    
    elif period_type == 'quarterly':
        # Indian FY quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
        current = start.replace(day=1)
        while current <= end:
            month = current.month
            if month in [4, 5, 6]:
                q_start = current.replace(month=4, day=1)
                q_end = current.replace(month=6, day=30)
                q_label = f"Q1 FY{current.year}-{current.year+1}"
            elif month in [7, 8, 9]:
                q_start = current.replace(month=7, day=1)
                q_end = current.replace(month=9, day=30)
                q_label = f"Q2 FY{current.year}-{current.year+1}"
            elif month in [10, 11, 12]:
                q_start = current.replace(month=10, day=1)
                q_end = current.replace(month=12, day=31)
                q_label = f"Q3 FY{current.year}-{current.year+1}"
            else:  # 1, 2, 3
                q_start = current.replace(month=1, day=1)
                q_end = current.replace(month=3, day=31)
                q_label = f"Q4 FY{current.year-1}-{current.year}"
            
            if q_start < start:
                q_start = start
            if q_end > end:
                q_end = end
            
            # Check if this quarter is already added
            if not any(p['label'] == q_label for p in periods):
                periods.append({
                    'label': q_label,
                    'start': q_start.strftime('%Y-%m-%d'),
                    'end': q_end.strftime('%Y-%m-%d')
                })
            
            current = current + relativedelta(months=3)
    
    elif period_type == 'yearly':
        # Indian FY: April to March
        current_year = start.year if start.month >= 4 else start.year - 1
        end_year = end.year if end.month >= 4 else end.year - 1
        
        for fy in range(current_year, end_year + 1):
            fy_start = datetime(fy, 4, 1)
            fy_end = datetime(fy + 1, 3, 31)
            
            if fy_start.strftime('%Y-%m-%d') < start_date:
                fy_start = datetime.strptime(start_date, '%Y-%m-%d')
            if fy_end.strftime('%Y-%m-%d') > end_date:
                fy_end = datetime.strptime(end_date, '%Y-%m-%d')
            
            periods.append({
                'label': f"FY{fy}-{fy+1}",
                'start': fy_start.strftime('%Y-%m-%d'),
                'end': fy_end.strftime('%Y-%m-%d')
            })
    
    else:  # 'total' - single period
        periods.append({
            'label': 'Total',
            'start': start_date,
            'end': end_date
        })
    
    return periods


def get_metric_query(metric: str):
    """
    Get MongoDB query conditions for each metric type
    """
    metrics = {
        'total_leads': {},
        'won_leads': {"enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]}},
        'lost_leads': {
            "$and": [
                {"$or": [
                    {"enquiry_stage": {"$regex": "^Closed-", "$options": "i"}},
                    {"enquiry_stage": {"$regex": "^Lost$", "$options": "i"}}
                ]},
                {"enquiry_stage": {"$nin": ["Closed-Won", "Order Booked"]}}
            ]
        },
        'open_leads': {"enquiry_status": "Open"},
        'hot_leads': {"enquiry_status": "Open", "enquiry_type": "Hot"},
        'warm_leads': {"enquiry_status": "Open", "enquiry_type": "Warm"},
        'cold_leads': {"enquiry_status": "Open", "enquiry_type": "Cold"},
        'qualified_leads': {"is_qualified": True},
        'quotations_sent': {"$or": [
            {"quotation_sent": True},
            {"quotation_no": {"$exists": True, "$ne": None, "$ne": ""}}
        ]},
        'dispatched': {"dispatch_status": "dispatched"},
        'pending_dispatch': {"dispatch_status": "pending"},
    }
    return metrics.get(metric, {})


@router.get("/config")
async def get_summary_config(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get available metrics, dimensions, and period types"""
    db = await get_db(request)
    
    # Get distinct values for each dimension
    states = await db.leads.distinct("state", {"state": {"$ne": None, "$ne": ""}})
    dealers = await db.leads.distinct("dealer", {"dealer": {"$ne": None, "$ne": ""}})
    employees = await db.leads.distinct("employee_name", {"employee_name": {"$ne": None, "$ne": ""}})
    segments = await db.leads.distinct("segment", {"segment": {"$ne": None, "$ne": ""}})
    sources = await db.leads.distinct("source", {"source": {"$ne": None, "$ne": ""}})
    
    return {
        "metrics": [
            {"id": "total_leads", "name": "Total Leads", "description": "All leads in the period"},
            {"id": "won_leads", "name": "Won Leads", "description": "Closed-Won or Order Booked"},
            {"id": "lost_leads", "name": "Lost Leads", "description": "Closed-Lost or Lost"},
            {"id": "open_leads", "name": "Open Leads", "description": "Status = Open"},
            {"id": "hot_leads", "name": "Hot Leads", "description": "Open + Hot type"},
            {"id": "warm_leads", "name": "Warm Leads", "description": "Open + Warm type"},
            {"id": "cold_leads", "name": "Cold Leads", "description": "Open + Cold type"},
            {"id": "qualified_leads", "name": "Qualified Leads", "description": "50%+ fields filled"},
            {"id": "quotations_sent", "name": "Quotations Sent", "description": "Leads with quotation"},
            {"id": "dispatched", "name": "Dispatched", "description": "Orders dispatched"},
            {"id": "pending_dispatch", "name": "Pending Dispatch", "description": "Awaiting dispatch"},
        ],
        "dimensions": [
            {"id": "state", "name": "State", "values": sorted([s for s in states if s])},
            {"id": "dealer", "name": "Dealer", "values": sorted([d for d in dealers if d])},
            {"id": "employee_name", "name": "Employee", "values": sorted([e for e in employees if e])},
            {"id": "segment", "name": "Segment", "values": sorted([s for s in segments if s])},
            {"id": "source", "name": "Source", "values": sorted([s for s in sources if s])},
            {"id": "enquiry_type", "name": "Lead Type", "values": ["Hot", "Warm", "Cold"]},
        ],
        "period_types": [
            {"id": "monthly", "name": "Monthly"},
            {"id": "quarterly", "name": "Quarterly"},
            {"id": "yearly", "name": "Yearly"},
            {"id": "total", "name": "Total (No Breakdown)"},
        ]
    }


@router.get("/generate")
async def generate_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    metric: str = Query(..., description="Metric to analyze"),
    dimension: str = Query(..., description="Dimension to group by"),
    period_type: str = Query("quarterly", description="Period breakdown"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    filter_state: Optional[str] = None,
    filter_dealer: Optional[str] = None,
    filter_segment: Optional[str] = None
):
    """
    Generate pivot-table style summary data
    Returns:
    - rows: dimension values (dealers, employees, etc.)
    - columns: time periods (Q1, Q2, Q3, Q4 or months)
    - cells: metric values for each dimension+period combination
    - totals: row totals and column totals
    """
    db = await get_db(request)
    
    # Default to Indian FY
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Get periods
    periods = get_period_boundaries(start_date, end_date, period_type)
    
    # Build base query
    base_query = {
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
        ]
    }
    
    # Add metric-specific conditions
    metric_conditions = get_metric_query(metric)
    if metric_conditions:
        if "$and" in metric_conditions:
            base_query["$and"].extend(metric_conditions["$and"])
        elif "$or" in metric_conditions:
            base_query["$and"].append({"$or": metric_conditions["$or"]})
        else:
            base_query.update(metric_conditions)
    
    # Add filters
    if filter_state:
        base_query["state"] = filter_state
    if filter_dealer:
        base_query["dealer"] = filter_dealer
    if filter_segment:
        base_query["segment"] = filter_segment
    
    # Get all unique dimension values
    dimension_values = await db.leads.distinct(dimension, {
        dimension: {"$ne": None, "$ne": ""},
        "enquiry_date": {"$gte": start_date, "$lte": end_date}
    })
    dimension_values = sorted([v for v in dimension_values if v])
    
    # Build result matrix
    data = []
    column_totals = {p['label']: 0 for p in periods}
    column_totals['Total'] = 0
    
    for dim_value in dimension_values:
        row = {
            'dimension': dim_value,
            'values': {},
            'total': 0
        }
        
        for period in periods:
            query = {
                **base_query,
                dimension: dim_value,
                "enquiry_date": {"$gte": period['start'], "$lte": period['end']}
            }
            
            count = await db.leads.count_documents(query)
            row['values'][period['label']] = count
            row['total'] += count
            column_totals[period['label']] += count
            column_totals['Total'] += count
        
        data.append(row)
    
    # Sort by total descending
    data.sort(key=lambda x: x['total'], reverse=True)
    
    # Calculate trends (compare last period to previous)
    trends = {}
    if len(periods) >= 2:
        for dim_value in dimension_values:
            row = next((r for r in data if r['dimension'] == dim_value), None)
            if row:
                last_period = periods[-1]['label']
                prev_period = periods[-2]['label']
                last_val = row['values'].get(last_period, 0)
                prev_val = row['values'].get(prev_period, 0)
                
                if prev_val > 0:
                    change = round(((last_val - prev_val) / prev_val) * 100, 1)
                else:
                    change = 100 if last_val > 0 else 0
                
                trends[dim_value] = {
                    'change_percent': change,
                    'direction': 'up' if change > 0 else 'down' if change < 0 else 'flat'
                }
    
    # Historical comparison (this period vs same period last year)
    historical = {}
    if period_type in ['quarterly', 'yearly']:
        # Get previous year's data for comparison
        prev_start = (datetime.strptime(start_date, '%Y-%m-%d') - relativedelta(years=1)).strftime('%Y-%m-%d')
        prev_end = (datetime.strptime(end_date, '%Y-%m-%d') - relativedelta(years=1)).strftime('%Y-%m-%d')
        
        for dim_value in dimension_values[:10]:  # Top 10 only for performance
            current_query = {
                **base_query,
                dimension: dim_value,
                "enquiry_date": {"$gte": start_date, "$lte": end_date}
            }
            prev_query = {
                **base_query,
                dimension: dim_value,
                "enquiry_date": {"$gte": prev_start, "$lte": prev_end}
            }
            
            current_count = await db.leads.count_documents(current_query)
            prev_count = await db.leads.count_documents(prev_query)
            
            if prev_count > 0:
                yoy_change = round(((current_count - prev_count) / prev_count) * 100, 1)
            else:
                yoy_change = 100 if current_count > 0 else 0
            
            historical[dim_value] = {
                'current': current_count,
                'previous_year': prev_count,
                'yoy_change': yoy_change
            }
    
    return {
        "metric": metric,
        "dimension": dimension,
        "period_type": period_type,
        "date_range": {"start_date": start_date, "end_date": end_date},
        "periods": [p['label'] for p in periods],
        "data": data,
        "column_totals": column_totals,
        "grand_total": column_totals['Total'],
        "trends": trends,
        "historical_comparison": historical,
        "row_count": len(data)
    }


@router.get("/data-quality")
async def get_data_quality_report(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze data quality and identify issues like:
    - Duplicate columns storing same data
    - Missing critical fields
    - Inconsistent field values
    """
    db = await get_db(request)
    
    total_leads = await db.leads.count_documents({"deleted_at": {"$exists": False}})
    
    # Field completeness analysis
    fields_to_check = [
        ('phone_number', 'Phone Number'),
        ('name', 'Name'),
        ('corporate_name', 'Corporate Name'),
        ('state', 'State'),
        ('dealer', 'Dealer'),
        ('employee_name', 'Employee'),
        ('enquiry_date', 'Enquiry Date'),
        ('enquiry_stage', 'Stage'),
        ('segment', 'Segment'),
        ('source', 'Source'),
        ('kva', 'KVA'),
        ('competitor', 'Competitor (Lost)'),
        ('lost_reason', 'Lost Reason'),
    ]
    
    field_stats = []
    for field, label in fields_to_check:
        filled = await db.leads.count_documents({
            "deleted_at": {"$exists": False},
            field: {"$exists": True, "$ne": None, "$ne": ""}
        })
        field_stats.append({
            'field': field,
            'label': label,
            'filled': filled,
            'empty': total_leads - filled,
            'fill_rate': round((filled / total_leads) * 100, 1) if total_leads > 0 else 0
        })
    
    # Check for potential duplicates (same phone, different records)
    duplicate_phone_pipeline = [
        {"$match": {"phone_number": {"$exists": True, "$ne": None, "$ne": ""}, "deleted_at": {"$exists": False}}},
        {"$group": {"_id": "$phone_number", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$count": "duplicate_phones"}
    ]
    dup_result = await db.leads.aggregate(duplicate_phone_pipeline).to_list(1)
    duplicate_phone_count = dup_result[0]["duplicate_phones"] if dup_result else 0
    
    # Check name vs corporate_name overlap
    both_names_count = await db.leads.count_documents({
        "deleted_at": {"$exists": False},
        "name": {"$exists": True, "$ne": None, "$ne": ""},
        "corporate_name": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    # Location field analysis (tehsil vs district vs location)
    location_overlap = await db.leads.count_documents({
        "deleted_at": {"$exists": False},
        "$or": [
            {"$and": [
                {"tehsil": {"$exists": True, "$ne": None, "$ne": ""}},
                {"district": {"$exists": True, "$ne": None, "$ne": ""}}
            ]},
            {"$and": [
                {"location": {"$exists": True, "$ne": None, "$ne": ""}},
                {"district": {"$exists": True, "$ne": None, "$ne": ""}}
            ]}
        ]
    })
    
    return {
        "total_leads": total_leads,
        "field_completeness": sorted(field_stats, key=lambda x: x['fill_rate']),
        "data_issues": {
            "potential_phone_duplicates": duplicate_phone_count,
            "leads_with_both_names": both_names_count,
            "location_field_overlap": location_overlap
        },
        "recommendations": [
            f"Consider merging {duplicate_phone_count} potential duplicate phone records" if duplicate_phone_count > 0 else None,
            f"Standardize name fields - {both_names_count} leads have both name and corporate_name" if both_names_count > 100 else None,
            f"Review location fields - {location_overlap} leads have overlapping tehsil/district/location" if location_overlap > 100 else None,
            f"Improve competitor data - only {next((f['fill_rate'] for f in field_stats if f['field'] == 'competitor'), 0)}% filled" if any(f['field'] == 'competitor' and f['fill_rate'] < 20 for f in field_stats) else None,
        ]
    }
