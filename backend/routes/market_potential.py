from fastapi import APIRouter, Request, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime
import logging
import io
import pandas as pd
from bson import ObjectId

from models.user import User
from routes.auth import get_current_user
from routes.kpis import get_indian_fy_dates

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market-potential", tags=["Market Potential"])


async def get_db(request: Request):
    return request.app.state.db


@router.get("/template")
async def download_template(
    current_user: User = Depends(get_current_user)
):
    """
    Download the market potential Excel template.
    Template has two sheets:
    1. District Potentials: Dealer, District, State, FY26 Potential
    2. KVA Range Potentials: KVA Range, Market Size
    """
    # Create Excel file with two sheets
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: District Potentials
        district_df = pd.DataFrame({
            'Dealer': ['Example Dealer 1', 'Example Dealer 1', 'Example Dealer 2'],
            'District': ['District A', 'District B', 'District C'],
            'State': ['Bihar', 'Bihar', 'Jharkhand'],
            'FY26_Potential': [500, 300, 400]
        })
        district_df.to_excel(writer, sheet_name='District Potentials', index=False)
        
        # Sheet 2: KVA Range Potentials
        kva_df = pd.DataFrame({
            'KVA_Range': ['5-12.5', '15-30', '35-75', '82.5', '100-125', '140-180', '200', '250-320', '380-500', '625-750', '800-1010'],
            'Market_Size': [500, 2500, 1700, 285, 650, 400, 300, 200, 150, 100, 50]
        })
        kva_df.to_excel(writer, sheet_name='KVA Range Potentials', index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': 'attachment; filename=market_potential_template.xlsx'
        }
    )


@router.post("/upload")
async def upload_market_potential(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload market potential data from Excel file.
    Accepts sheets named either:
    - 'District Potentials' / 'KVA Range Potentials' (template format)
    - 'Dealer' / 'KVA_Range' (user format)
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
    
    db = await get_db(request)
    
    try:
        contents = await file.read()
        excel_file = io.BytesIO(contents)
        
        # Get sheet names to handle different naming conventions
        xl = pd.ExcelFile(excel_file)
        sheet_names = xl.sheet_names
        
        # Find district sheet (try different names)
        district_sheet = None
        for name in ['District Potentials', 'Dealer', 'Districts', 'district', 'dealers']:
            if name in sheet_names:
                district_sheet = name
                break
        
        # Find KVA sheet (try different names)
        kva_sheet = None
        for name in ['KVA Range Potentials', 'KVA_Range', 'KVA', 'kva', 'KVA Range']:
            if name in sheet_names:
                kva_sheet = name
                break
        
        if not district_sheet:
            raise HTTPException(status_code=400, detail=f"Could not find district sheet. Found sheets: {sheet_names}")
        
        # Read sheets
        excel_file.seek(0)
        district_df = pd.read_excel(excel_file, sheet_name=district_sheet)
        
        kva_df = None
        if kva_sheet:
            excel_file.seek(0)
            kva_df = pd.read_excel(excel_file, sheet_name=kva_sheet)
        
        # Validate and normalize district columns
        # Accept both FY26_Potential and Potential
        if 'FY26_Potential' not in district_df.columns and 'Potential' not in district_df.columns:
            # Check if there's any column with 'potential' in it
            potential_col = None
            for col in district_df.columns:
                if 'potential' in col.lower() or 'fy' in col.lower():
                    potential_col = col
                    break
            if potential_col:
                district_df['FY26_Potential'] = district_df[potential_col]
            else:
                district_df['FY26_Potential'] = 0
        elif 'Potential' in district_df.columns:
            district_df['FY26_Potential'] = district_df['Potential']
        
        required_district_cols = ['Dealer', 'District']
        missing_cols = [col for col in required_district_cols if col not in district_df.columns]
        if missing_cols:
            raise HTTPException(status_code=400, detail=f"Missing required columns: {missing_cols}. Found columns: {list(district_df.columns)}")
        
        # Clear existing data
        await db.market_potential_districts.delete_many({})
        await db.market_potential_kva.delete_many({})
        
        # Get user identifier
        user_id = getattr(current_user, 'email', None) or getattr(current_user, 'name', None) or 'unknown'
        
        # Insert district potentials
        district_records = []
        for _, row in district_df.iterrows():
            if pd.notna(row['Dealer']) and pd.notna(row['District']):
                potential_value = row.get('FY26_Potential', 0)
                district_records.append({
                    'dealer': str(row['Dealer']).strip(),
                    'district': str(row['District']).strip(),
                    'state': str(row['State']).strip() if 'State' in row and pd.notna(row['State']) else '',
                    'potential': int(potential_value) if pd.notna(potential_value) else 0,
                    'created_at': datetime.utcnow(),
                    'created_by': user_id
                })
        
        if district_records:
            await db.market_potential_districts.insert_many(district_records)
        
        # Insert KVA potentials
        kva_records = []
        if kva_df is not None and not kva_df.empty:
            for _, row in kva_df.iterrows():
                kva_range_val = row.get('KVA_Range') or row.get('kva_range') or row.get('KVA')
                market_size_val = row.get('Market_Size') or row.get('market_size') or row.get('Size') or 0
                
                if pd.notna(kva_range_val):
                    kva_records.append({
                        'kva_range': str(kva_range_val).strip(),
                        'market_size': int(market_size_val) if pd.notna(market_size_val) else 0,
                        'created_at': datetime.utcnow(),
                        'created_by': user_id
                    })
        
        if kva_records:
            await db.market_potential_kva.insert_many(kva_records)
        
        return {
            'status': 'success',
            'message': 'Market potential data uploaded successfully',
            'districts_imported': len(district_records),
            'kva_ranges_imported': len(kva_records)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading market potential: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/districts")
async def get_district_potentials(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None,
    dealer: Optional[str] = None
):
    """Get all district potential data with optional filters"""
    db = await get_db(request)
    
    query = {}
    if state:
        query['state'] = state
    if dealer:
        query['dealer'] = dealer
    
    districts = await db.market_potential_districts.find(query, {'_id': 0}).to_list(1000)
    
    return {
        'districts': districts,
        'total': len(districts)
    }


@router.get("/kva-ranges")
async def get_kva_potentials(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all KVA range potential data"""
    db = await get_db(request)
    
    kva_ranges = await db.market_potential_kva.find({}, {'_id': 0}).to_list(100)
    
    return {
        'kva_ranges': kva_ranges,
        'total': len(kva_ranges)
    }


@router.post("/districts")
async def add_district_potential(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Add a new district potential entry manually"""
    db = await get_db(request)
    data = await request.json()
    
    record = {
        'dealer': data.get('dealer', '').strip(),
        'district': data.get('district', '').strip(),
        'state': data.get('state', '').strip(),
        'potential': int(data.get('potential', 0)),
        'created_at': datetime.utcnow(),
        'created_by': getattr(current_user, 'email', None) or getattr(current_user, 'name', 'unknown')
    }
    
    if not record['dealer'] or not record['district']:
        raise HTTPException(status_code=400, detail="Dealer and District are required")
    
    result = await db.market_potential_districts.insert_one(record)
    
    return {
        'status': 'success',
        'message': 'District potential added successfully',
        'id': str(result.inserted_id)
    }


@router.put("/districts/{district}/{dealer}")
async def update_district_potential(
    request: Request,
    district: str,
    dealer: str,
    current_user: User = Depends(get_current_user)
):
    """Update an existing district potential entry"""
    db = await get_db(request)
    data = await request.json()
    
    update_data = {
        'potential': int(data.get('potential', 0)),
        'updated_at': datetime.utcnow(),
        'updated_by': getattr(current_user, 'email', None) or getattr(current_user, 'name', 'unknown')
    }
    
    if 'state' in data:
        update_data['state'] = data['state'].strip()
    
    result = await db.market_potential_districts.update_one(
        {'district': district, 'dealer': dealer},
        {'$set': update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="District potential not found")
    
    return {
        'status': 'success',
        'message': 'District potential updated successfully'
    }


@router.delete("/districts/{district}/{dealer}")
async def delete_district_potential(
    request: Request,
    district: str,
    dealer: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a district potential entry"""
    db = await get_db(request)
    
    result = await db.market_potential_districts.delete_one({
        'district': district,
        'dealer': dealer
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="District potential not found")
    
    return {
        'status': 'success',
        'message': 'District potential deleted successfully'
    }


@router.post("/kva-ranges")
async def add_kva_potential(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Add a new KVA range potential entry manually"""
    db = await get_db(request)
    data = await request.json()
    
    record = {
        'kva_range': data.get('kva_range', '').strip(),
        'market_size': int(data.get('market_size', 0)),
        'created_at': datetime.utcnow(),
        'created_by': getattr(current_user, 'email', None) or getattr(current_user, 'name', 'unknown')
    }
    
    if not record['kva_range']:
        raise HTTPException(status_code=400, detail="KVA Range is required")
    
    result = await db.market_potential_kva.insert_one(record)
    
    return {
        'status': 'success',
        'message': 'KVA potential added successfully',
        'id': str(result.inserted_id)
    }


@router.put("/kva-ranges/{kva_range}")
async def update_kva_potential(
    request: Request,
    kva_range: str,
    current_user: User = Depends(get_current_user)
):
    """Update an existing KVA range potential entry"""
    db = await get_db(request)
    data = await request.json()
    
    update_data = {
        'market_size': int(data.get('market_size', 0)),
        'updated_at': datetime.utcnow(),
        'updated_by': getattr(current_user, 'email', None) or getattr(current_user, 'name', 'unknown')
    }
    
    result = await db.market_potential_kva.update_one(
        {'kva_range': kva_range},
        {'$set': update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="KVA potential not found")
    
    return {
        'status': 'success',
        'message': 'KVA potential updated successfully'
    }


@router.delete("/kva-ranges/{kva_range}")
async def delete_kva_potential(
    request: Request,
    kva_range: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a KVA range potential entry"""
    db = await get_db(request)
    
    result = await db.market_potential_kva.delete_one({'kva_range': kva_range})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="KVA potential not found")
    
    return {
        'status': 'success',
        'message': 'KVA potential deleted successfully'
    }


@router.get("/comparison")
async def get_market_comparison(
    request: Request,
    current_user: User = Depends(get_current_user),
    compare_by: str = Query("district", enum=["district", "dealer", "state", "kva"]),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    state: Optional[str] = None,
    dealer: Optional[str] = None
):
    """
    Get market share comparison data.
    Compares actual sales against market potential.
    Also includes YoY comparison with last year's sales.
    """
    db = await get_db(request)
    
    if not start_date or not end_date:
        start_date, end_date = get_indian_fy_dates()
    
    # Calculate last year dates
    from datetime import datetime as dt
    try:
        start_dt = dt.strptime(start_date, "%Y-%m-%d")
        end_dt = dt.strptime(end_date, "%Y-%m-%d")
        ly_start = start_dt.replace(year=start_dt.year - 1).strftime("%Y-%m-%d")
        ly_end = end_dt.replace(year=end_dt.year - 1).strftime("%Y-%m-%d")
    except:
        ly_start = start_date
        ly_end = end_date
    
    # Build leads query for current year and last year
    base_query = {
        "deleted_at": {"$exists": False},
        "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
        "has_so_record": True
    }
    
    if state:
        base_query["state"] = state
    if dealer:
        base_query["dealer"] = dealer
    
    current_query = {**base_query, "enquiry_date": {"$gte": start_date, "$lte": end_date}}
    last_year_query = {**base_query, "enquiry_date": {"$gte": ly_start, "$lte": ly_end}}
    
    comparison_data = []
    
    if compare_by == "kva":
        # KVA Range comparison
        kva_potentials = await db.market_potential_kva.find({}, {'_id': 0}).to_list(100)
        
        # Define KVA range mappings for aggregation
        kva_ranges = [
            {'name': 'LKVA (<82.5)', 'min': 0, 'max': 82.5},
            {'name': 'MKVA (82.5-249)', 'min': 82.5, 'max': 250},
            {'name': 'HKVA (≥250)', 'min': 250, 'max': 999999}
        ]
        
        for kva_range in kva_ranges:
            kva_query_current = {
                **current_query,
                "kva": {"$gte": kva_range['min'], "$lt": kva_range['max']}
            }
            kva_query_ly = {
                **last_year_query,
                "kva": {"$gte": kva_range['min'], "$lt": kva_range['max']}
            }
            
            current_sales = await db.leads.count_documents(kva_query_current)
            ly_sales = await db.leads.count_documents(kva_query_ly)
            
            # Sum up relevant KVA potentials for this range
            potential = sum(p['market_size'] for p in kva_potentials)  # Use total for now
            
            yoy_change = ((current_sales - ly_sales) / ly_sales * 100) if ly_sales > 0 else 0
            market_share = (current_sales / potential * 100) if potential > 0 else 0
            
            comparison_data.append({
                'name': kva_range['name'],
                'potential': potential,
                'current_sales': current_sales,
                'last_year_sales': ly_sales,
                'market_share': round(market_share, 1),
                'yoy_change': round(yoy_change, 1)
            })
    
    elif compare_by == "district":
        # District comparison
        district_potentials = await db.market_potential_districts.find({}, {'_id': 0}).to_list(1000)
        
        # Group potentials by district
        district_potential_map = {}
        for dp in district_potentials:
            district = dp['district']
            if district not in district_potential_map:
                district_potential_map[district] = {'potential': 0, 'state': dp.get('state', '')}
            district_potential_map[district]['potential'] += dp['potential']
        
        # Get sales by district
        pipeline_current = [
            {"$match": current_query},
            {"$group": {"_id": "$location", "sales": {"$sum": 1}}}
        ]
        pipeline_ly = [
            {"$match": last_year_query},
            {"$group": {"_id": "$location", "sales": {"$sum": 1}}}
        ]
        
        current_sales_data = await db.leads.aggregate(pipeline_current).to_list(1000)
        ly_sales_data = await db.leads.aggregate(pipeline_ly).to_list(1000)
        
        current_sales_map = {s['_id']: s['sales'] for s in current_sales_data if s['_id']}
        ly_sales_map = {s['_id']: s['sales'] for s in ly_sales_data if s['_id']}
        
        # Combine all districts
        all_districts = set(district_potential_map.keys()) | set(current_sales_map.keys())
        
        for district in all_districts:
            potential = district_potential_map.get(district, {}).get('potential', 0)
            state_name = district_potential_map.get(district, {}).get('state', '')
            current_sales = current_sales_map.get(district, 0)
            ly_sales = ly_sales_map.get(district, 0)
            
            yoy_change = ((current_sales - ly_sales) / ly_sales * 100) if ly_sales > 0 else 0
            market_share = (current_sales / potential * 100) if potential > 0 else 0
            
            comparison_data.append({
                'name': district or 'Unknown',
                'state': state_name,
                'potential': potential,
                'current_sales': current_sales,
                'last_year_sales': ly_sales,
                'market_share': round(market_share, 1),
                'yoy_change': round(yoy_change, 1)
            })
        
        # Sort by current sales descending
        comparison_data.sort(key=lambda x: x['current_sales'], reverse=True)
    
    elif compare_by == "dealer":
        # Dealer comparison
        district_potentials = await db.market_potential_districts.find({}, {'_id': 0}).to_list(1000)
        
        # Group potentials by dealer
        dealer_potential_map = {}
        for dp in district_potentials:
            dlr = dp['dealer']
            if dlr not in dealer_potential_map:
                dealer_potential_map[dlr] = {'potential': 0, 'districts': []}
            dealer_potential_map[dlr]['potential'] += dp['potential']
            dealer_potential_map[dlr]['districts'].append(dp['district'])
        
        # Get sales by dealer
        pipeline_current = [
            {"$match": current_query},
            {"$group": {"_id": "$dealer", "sales": {"$sum": 1}}}
        ]
        pipeline_ly = [
            {"$match": last_year_query},
            {"$group": {"_id": "$dealer", "sales": {"$sum": 1}}}
        ]
        
        current_sales_data = await db.leads.aggregate(pipeline_current).to_list(1000)
        ly_sales_data = await db.leads.aggregate(pipeline_ly).to_list(1000)
        
        current_sales_map = {s['_id']: s['sales'] for s in current_sales_data if s['_id']}
        ly_sales_map = {s['_id']: s['sales'] for s in ly_sales_data if s['_id']}
        
        # Combine all dealers
        all_dealers = set(dealer_potential_map.keys()) | set(current_sales_map.keys())
        
        for dlr in all_dealers:
            potential = dealer_potential_map.get(dlr, {}).get('potential', 0)
            districts = dealer_potential_map.get(dlr, {}).get('districts', [])
            current_sales = current_sales_map.get(dlr, 0)
            ly_sales = ly_sales_map.get(dlr, 0)
            
            yoy_change = ((current_sales - ly_sales) / ly_sales * 100) if ly_sales > 0 else 0
            market_share = (current_sales / potential * 100) if potential > 0 else 0
            
            comparison_data.append({
                'name': dlr or 'Unknown',
                'districts_count': len(districts),
                'potential': potential,
                'current_sales': current_sales,
                'last_year_sales': ly_sales,
                'market_share': round(market_share, 1),
                'yoy_change': round(yoy_change, 1)
            })
        
        comparison_data.sort(key=lambda x: x['current_sales'], reverse=True)
    
    elif compare_by == "state":
        # State comparison
        district_potentials = await db.market_potential_districts.find({}, {'_id': 0}).to_list(1000)
        
        # Group potentials by state
        state_potential_map = {}
        for dp in district_potentials:
            st = dp.get('state', 'Unknown')
            if st not in state_potential_map:
                state_potential_map[st] = {'potential': 0, 'districts': [], 'dealers': set()}
            state_potential_map[st]['potential'] += dp['potential']
            state_potential_map[st]['districts'].append(dp['district'])
            state_potential_map[st]['dealers'].add(dp['dealer'])
        
        # Get sales by state
        pipeline_current = [
            {"$match": current_query},
            {"$group": {"_id": "$state", "sales": {"$sum": 1}}}
        ]
        pipeline_ly = [
            {"$match": last_year_query},
            {"$group": {"_id": "$state", "sales": {"$sum": 1}}}
        ]
        
        current_sales_data = await db.leads.aggregate(pipeline_current).to_list(100)
        ly_sales_data = await db.leads.aggregate(pipeline_ly).to_list(100)
        
        current_sales_map = {s['_id']: s['sales'] for s in current_sales_data if s['_id']}
        ly_sales_map = {s['_id']: s['sales'] for s in ly_sales_data if s['_id']}
        
        # Combine all states
        all_states = set(state_potential_map.keys()) | set(current_sales_map.keys())
        
        for st in all_states:
            potential = state_potential_map.get(st, {}).get('potential', 0)
            districts = state_potential_map.get(st, {}).get('districts', [])
            dealers = state_potential_map.get(st, {}).get('dealers', set())
            current_sales = current_sales_map.get(st, 0)
            ly_sales = ly_sales_map.get(st, 0)
            
            yoy_change = ((current_sales - ly_sales) / ly_sales * 100) if ly_sales > 0 else 0
            market_share = (current_sales / potential * 100) if potential > 0 else 0
            
            comparison_data.append({
                'name': st or 'Unknown',
                'districts_count': len(districts),
                'dealers_count': len(dealers),
                'potential': potential,
                'current_sales': current_sales,
                'last_year_sales': ly_sales,
                'market_share': round(market_share, 1),
                'yoy_change': round(yoy_change, 1)
            })
        
        comparison_data.sort(key=lambda x: x['current_sales'], reverse=True)
    
    # Calculate totals
    total_potential = sum(d['potential'] for d in comparison_data)
    total_current = sum(d['current_sales'] for d in comparison_data)
    total_ly = sum(d['last_year_sales'] for d in comparison_data)
    total_market_share = (total_current / total_potential * 100) if total_potential > 0 else 0
    total_yoy = ((total_current - total_ly) / total_ly * 100) if total_ly > 0 else 0
    
    return {
        'compare_by': compare_by,
        'data': comparison_data,
        'totals': {
            'potential': total_potential,
            'current_sales': total_current,
            'last_year_sales': total_ly,
            'market_share': round(total_market_share, 1),
            'yoy_change': round(total_yoy, 1)
        },
        'date_range': {
            'current': {'start': start_date, 'end': end_date},
            'last_year': {'start': ly_start, 'end': ly_end}
        }
    }


@router.get("/summary")
async def get_potential_summary(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get summary of uploaded market potential data"""
    db = await get_db(request)
    
    district_count = await db.market_potential_districts.count_documents({})
    kva_count = await db.market_potential_kva.count_documents({})
    
    # Get unique dealers and states
    dealers = await db.market_potential_districts.distinct('dealer')
    states = await db.market_potential_districts.distinct('state')
    
    # Calculate total potential
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$potential"}}}
    ]
    total_result = await db.market_potential_districts.aggregate(pipeline).to_list(1)
    total_district_potential = total_result[0]['total'] if total_result else 0
    
    kva_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$market_size"}}}
    ]
    kva_total_result = await db.market_potential_kva.aggregate(kva_pipeline).to_list(1)
    total_kva_potential = kva_total_result[0]['total'] if kva_total_result else 0
    
    return {
        'district_entries': district_count,
        'kva_entries': kva_count,
        'unique_dealers': len(dealers),
        'unique_states': len(states),
        'total_district_potential': total_district_potential,
        'total_kva_potential': total_kva_potential,
        'has_data': district_count > 0 or kva_count > 0
    }
