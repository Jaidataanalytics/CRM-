#!/usr/bin/env python3
"""
Comprehensive Data Cleanup and Merge Script

This script:
1. Cleans up all fields - removes duplicate/concatenated data
2. Normalizes phone numbers and text fields
3. Re-runs the chunk-based merge with intelligent field selection:
   - Remarks: Deduplicate similar remarks, format as "Remark 1: ..., Remark 2: ..."
   - Numeric fields: Most repeated value, then most recent
   - Text fields: Most repeated value
   - Status fields: Most recent advanced stage
"""
import asyncio
import re
import os
from collections import Counter
from datetime import datetime
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Closed stages (merge ends at these)
CLOSED_STAGES = [
    'Closed-Won', 'Closed-Lost', 'Closed-Dropped', 
    'Order Booked', 'Lost', 'Dropped'
]

# Stage hierarchy (higher = more advanced)
STAGE_HIERARCHY = {
    'Prospecting': 1,
    'Qualified': 2,
    'Quotation': 3,
    'Quotation Sent': 3,
    'Negotiation': 4,
    'Closed-Lost': 5,
    'Closed-Dropped': 5,
    'Lost': 5,
    'Dropped': 5,
    'Closed-Won': 6,
    'Order Booked': 7
}

def normalize_text(text: str) -> str:
    """Normalize text for comparison - lowercase, strip, remove extra spaces"""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text).lower().strip())

def texts_are_similar(text1: str, text2: str) -> bool:
    """Check if two texts are similar (case-insensitive, normalized)"""
    return normalize_text(text1) == normalize_text(text2)

def clean_phone_number(phone: Any) -> str:
    """Clean and normalize phone number"""
    if not phone:
        return ""
    phone_str = str(phone)
    # Remove common prefixes and non-digits
    phone_str = re.sub(r'^(\+91|91|0)', '', phone_str)
    phone_str = re.sub(r'[^0-9]', '', phone_str)
    # Keep only last 10 digits if longer
    if len(phone_str) > 10:
        phone_str = phone_str[-10:]
    return phone_str

def split_concatenated_field(value: str, delimiter_pattern: str = r'\s*\|\s*') -> List[str]:
    """Split a potentially concatenated field into individual values"""
    if not value:
        return []
    parts = re.split(delimiter_pattern, str(value))
    # Also try to split by repeated patterns
    return [p.strip() for p in parts if p.strip()]

def deduplicate_remarks(remarks_list: List[tuple]) -> str:
    """
    Deduplicate remarks and format them.
    Input: [(remark, date), ...]
    Output: "Remark 1: ..., Remark 2: ..." or single remark if all similar
    """
    if not remarks_list:
        return ""
    
    # Filter out empty remarks
    remarks_list = [(r, d) for r, d in remarks_list if r and str(r).strip()]
    if not remarks_list:
        return ""
    
    # Group similar remarks
    unique_remarks = []
    seen_normalized = set()
    
    for remark, date in sorted(remarks_list, key=lambda x: x[1] or ''):
        normalized = normalize_text(remark)
        if normalized and normalized not in seen_normalized:
            seen_normalized.add(normalized)
            unique_remarks.append((str(remark).strip(), date))
    
    if len(unique_remarks) == 1:
        return unique_remarks[0][0]
    
    # Format as numbered remarks
    formatted = []
    for i, (remark, date) in enumerate(unique_remarks, 1):
        if len(unique_remarks) <= 3:
            formatted.append(f"Remark {i}: {remark}")
        else:
            # Just keep first 3 if too many
            if i <= 3:
                formatted.append(f"Remark {i}: {remark}")
    
    return " | ".join(formatted)

def get_most_common_or_recent(values: List[tuple]) -> Any:
    """
    Get most repeated value, or most recent if no clear winner.
    Input: [(value, date), ...]
    """
    if not values:
        return None
    
    # Filter out None/empty values
    valid_values = [(v, d) for v, d in values if v is not None and str(v).strip()]
    if not valid_values:
        return None
    
    # Count occurrences
    counter = Counter(v for v, d in valid_values)
    most_common = counter.most_common()
    
    if len(most_common) == 1:
        return most_common[0][0]
    
    # If there's a clear winner (more than others)
    if most_common[0][1] > most_common[1][1]:
        return most_common[0][0]
    
    # If tied, get most recent
    sorted_by_date = sorted(valid_values, key=lambda x: x[1] or '', reverse=True)
    return sorted_by_date[0][0]

def get_most_advanced_stage(stages: List[tuple]) -> str:
    """
    Get the most advanced stage (most recent among highest hierarchy).
    Input: [(stage, date), ...]
    """
    if not stages:
        return ""
    
    valid_stages = [(s, d) for s, d in stages if s and str(s).strip()]
    if not valid_stages:
        return ""
    
    # Sort by hierarchy (desc) then by date (desc)
    def sort_key(item):
        stage, date = item
        hierarchy = STAGE_HIERARCHY.get(stage, 0)
        return (hierarchy, date or '')
    
    sorted_stages = sorted(valid_stages, key=sort_key, reverse=True)
    return sorted_stages[0][0]

def clean_single_lead(lead: Dict) -> Dict:
    """Clean a single lead - remove duplicated/concatenated data in fields"""
    cleaned = dict(lead)
    
    # Clean phone number
    if 'phone_number' in cleaned:
        cleaned['phone_number'] = clean_phone_number(cleaned['phone_number'])
    
    # Clean text fields - take first non-empty part if concatenated
    text_fields = ['name', 'email_address', 'address', 'district', 'tehsil', 'pincode', 
                   'dealer', 'segment', 'employee_name', 'state', 'location']
    
    for field in text_fields:
        if field in cleaned and cleaned[field]:
            value = str(cleaned[field])
            # Check if it looks concatenated (contains | or repeated patterns)
            if ' | ' in value or value.count(value[:20]) > 1:
                parts = split_concatenated_field(value)
                if parts:
                    # Take the most common part
                    counter = Counter(normalize_text(p) for p in parts)
                    most_common_normalized = counter.most_common(1)[0][0]
                    # Find original casing
                    for p in parts:
                        if normalize_text(p) == most_common_normalized:
                            cleaned[field] = p
                            break
    
    # Clean remarks - deduplicate if concatenated
    if 'remarks' in cleaned and cleaned['remarks']:
        remarks = str(cleaned['remarks'])
        if ' | ' in remarks or len(remarks) > 500:
            parts = split_concatenated_field(remarks)
            unique_parts = []
            seen = set()
            for p in parts:
                normalized = normalize_text(p)
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    unique_parts.append(p)
            if unique_parts:
                if len(unique_parts) == 1:
                    cleaned['remarks'] = unique_parts[0]
                else:
                    cleaned['remarks'] = " | ".join(f"Remark {i+1}: {r}" for i, r in enumerate(unique_parts[:3]))
    
    return cleaned

def merge_leads_intelligently(leads: List[Dict]) -> Dict:
    """
    Merge multiple leads into one using intelligent field selection.
    - Remarks: Deduplicate similar, format as "Remark 1: ..., Remark 2: ..."
    - Numeric: Most repeated, then most recent
    - Text: Most repeated
    - Status: Most advanced
    """
    if not leads:
        return {}
    
    if len(leads) == 1:
        return clean_single_lead(leads[0])
    
    # Sort leads by date
    sorted_leads = sorted(leads, key=lambda x: x.get('enquiry_date') or '')
    primary_lead = sorted_leads[-1]  # Most recent (or the closed one) will be primary
    
    merged = dict(primary_lead)
    
    # Collect all values for each field
    remarks_with_dates = []
    numeric_fields = {'kva': [], 'qty': [], 'won_qty': []}
    text_fields = {
        'name': [], 'email_address': [], 'address': [], 'district': [], 
        'tehsil': [], 'pincode': [], 'dealer': [], 'segment': [], 
        'employee_name': [], 'state': [], 'location': [], 'phone_number': []
    }
    stages_with_dates = []
    
    for lead in sorted_leads:
        date = lead.get('enquiry_date') or ''
        
        # Collect remarks
        if lead.get('remarks'):
            for part in split_concatenated_field(str(lead['remarks'])):
                remarks_with_dates.append((part, date))
        
        # Collect numeric fields
        for field in numeric_fields:
            if lead.get(field) is not None:
                try:
                    val = float(lead[field])
                    if val > 0:
                        numeric_fields[field].append((val, date))
                except (ValueError, TypeError):
                    pass
        
        # Collect text fields
        for field in text_fields:
            if lead.get(field):
                val = str(lead[field]).strip()
                if val:
                    text_fields[field].append((val, date))
        
        # Collect stages
        if lead.get('enquiry_stage'):
            stages_with_dates.append((lead['enquiry_stage'], date))
    
    # Merge remarks
    merged['remarks'] = deduplicate_remarks(remarks_with_dates)
    
    # Merge numeric fields
    for field, values in numeric_fields.items():
        if values:
            result = get_most_common_or_recent(values)
            if result is not None:
                merged[field] = result
    
    # Merge text fields
    for field, values in text_fields.items():
        if values:
            # For phone, clean first
            if field == 'phone_number':
                values = [(clean_phone_number(v), d) for v, d in values]
            result = get_most_common_or_recent(values)
            if result:
                merged[field] = result
    
    # Merge stage - most advanced
    if stages_with_dates:
        merged['enquiry_stage'] = get_most_advanced_stage(stages_with_dates)
    
    # Store merged enquiry info for audit
    merged_enquiries = []
    for lead in sorted_leads[:-1]:  # All except the primary (most recent)
        merged_enquiries.append({
            'enquiry_no': lead.get('enquiry_no'),
            'enquiry_date': lead.get('enquiry_date'),
            'enquiry_stage': lead.get('enquiry_stage'),
            'enquiry_type': lead.get('enquiry_type'),
            'name': lead.get('name'),
            'kva': lead.get('kva'),
            'qty': lead.get('qty'),
            'remarks': lead.get('remarks', '')[:100] if lead.get('remarks') else ''
        })
    
    if merged_enquiries:
        merged['merged_enquiries'] = merged_enquiries
    
    return clean_single_lead(merged)

async def run_cleanup_and_merge(db):
    """Main function to clean and merge all leads"""
    logger.info("Starting comprehensive data cleanup and merge...")
    
    # Step 1: Clean ALL existing leads first
    logger.info("Step 1: Cleaning all existing leads...")
    all_leads = await db.leads.find({}, {'_id': 0}).to_list(None)
    logger.info(f"Found {len(all_leads)} total leads to clean")
    
    cleaned_count = 0
    for lead in all_leads:
        cleaned = clean_single_lead(lead)
        if cleaned != lead:
            await db.leads.update_one(
                {'lead_id': lead['lead_id']},
                {'$set': cleaned}
            )
            cleaned_count += 1
    
    logger.info(f"Cleaned {cleaned_count} leads")
    
    # Step 2: Group leads by phone number
    logger.info("Step 2: Grouping leads by phone number...")
    phone_groups = {}
    
    for lead in all_leads:
        phone = clean_phone_number(lead.get('phone_number'))
        if phone and len(phone) >= 10:
            if phone not in phone_groups:
                phone_groups[phone] = []
            phone_groups[phone].append(lead)
    
    # Filter to groups with multiple leads
    multi_lead_phones = {p: leads for p, leads in phone_groups.items() if len(leads) > 1}
    logger.info(f"Found {len(multi_lead_phones)} phone numbers with multiple leads")
    
    # Step 3: Process each phone group with chunk-based merge
    logger.info("Step 3: Running chunk-based merge...")
    total_merged = 0
    total_marked_duplicate = 0
    
    for phone, leads in multi_lead_phones.items():
        # Sort by enquiry date
        sorted_leads = sorted(leads, key=lambda x: x.get('enquiry_date') or '')
        
        # Build chunks - each chunk ends at a closed lead
        chunks = []
        current_chunk = []
        
        for lead in sorted_leads:
            current_chunk.append(lead)
            stage = lead.get('enquiry_stage', '')
            is_closed = stage in CLOSED_STAGES or stage.lower().startswith('closed')
            
            if is_closed:
                chunks.append(current_chunk)
                current_chunk = []
        
        # Add remaining open leads as final chunk (no merge target yet)
        if current_chunk:
            chunks.append(current_chunk)
        
        # Process each chunk
        for chunk in chunks:
            if len(chunk) <= 1:
                continue
            
            # Check if last lead in chunk is closed (has merge target)
            last_lead = chunk[-1]
            last_stage = last_lead.get('enquiry_stage', '')
            has_closed_target = last_stage in CLOSED_STAGES or last_stage.lower().startswith('closed')
            
            if has_closed_target:
                # Merge all into the closed lead
                merged = merge_leads_intelligently(chunk)
                
                # Update the closed lead (last one) with merged data
                await db.leads.update_one(
                    {'lead_id': last_lead['lead_id']},
                    {'$set': merged}
                )
                
                # Mark other leads as duplicates
                for lead in chunk[:-1]:
                    await db.leads.update_one(
                        {'lead_id': lead['lead_id']},
                        {'$set': {
                            'is_duplicate': True,
                            'duplicate_of': last_lead['lead_id'],
                            'merged_into': last_lead['lead_id']
                        }}
                    )
                    total_marked_duplicate += 1
                
                total_merged += 1
    
    logger.info(f"Merge complete: {total_merged} groups merged, {total_marked_duplicate} leads marked as duplicates")
    
    # Step 4: Final verification
    final_total = await db.leads.count_documents({})
    final_duplicates = await db.leads.count_documents({'is_duplicate': True})
    final_non_duplicates = final_total - final_duplicates
    
    logger.info(f"Final counts: {final_total} total, {final_duplicates} duplicates, {final_non_duplicates} non-duplicates")
    
    return {
        'cleaned': cleaned_count,
        'merged_groups': total_merged,
        'marked_duplicate': total_marked_duplicate,
        'total_leads': final_total,
        'duplicates': final_duplicates,
        'non_duplicates': final_non_duplicates
    }

async def main():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    result = await run_cleanup_and_merge(db)
    
    print("\n" + "="*60)
    print("CLEANUP AND MERGE COMPLETE")
    print("="*60)
    print(f"Leads cleaned: {result['cleaned']}")
    print(f"Groups merged: {result['merged_groups']}")
    print(f"Marked as duplicate: {result['marked_duplicate']}")
    print(f"Total leads: {result['total_leads']}")
    print(f"Duplicates: {result['duplicates']}")
    print(f"Non-duplicates (shown): {result['non_duplicates']}")
    print("="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
