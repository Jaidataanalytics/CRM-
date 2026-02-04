"""
Duplicate Lead Detection and Merge Utility
Identifies duplicate leads based on phone number with smart logic.
Provides merge logic to combine duplicate leads.
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

# Closed stages - if previous lead has any of these, new lead is NOT a duplicate
CLOSED_STAGES = [
    "Closed-Won", "Order Booked", 
    "Closed-Lost", "Closed-Dropped", "Lost",
    "Closed-Not Interested", "Closed-Budget Issue", "Closed-Competitor"
]

# Time gap threshold for considering it a new enquiry (1 year)
NEW_ENQUIRY_TIME_GAP_DAYS = 365


class DuplicateDetector:
    """
    Detects duplicate leads using phone number matching with smart logic.
    
    A lead is considered a DUPLICATE only if:
    - Same phone_number (exact match after normalization)
    - AND the previous enquiry is still OPEN (not closed)
    - AND the time gap is less than 1 year
    
    A lead is considered NEW (not duplicate) if:
    - Different phone number
    - OR previous enquiry is CLOSED (won/lost) - this is a repeat customer
    - OR time gap > 1 year - this is a returning customer
    """
    
    def __init__(self):
        pass
    
    def normalize_phone(self, phone) -> str:
        """Normalize phone number for comparison - keep only digits"""
        if not phone:
            return ""
        # Remove all non-digit characters
        normalized = ''.join(c for c in str(phone) if c.isdigit())
        # Handle country code prefixes (India: 91)
        if len(normalized) > 10 and normalized.startswith('91'):
            normalized = normalized[2:]
        # Return last 10 digits
        return normalized[-10:] if len(normalized) >= 10 else normalized
    
    def parse_date(self, date_val) -> Optional[datetime]:
        """Parse date value to datetime for comparison"""
        if not date_val:
            return None
        if isinstance(date_val, datetime):
            return date_val
        if isinstance(date_val, str):
            # Try various formats
            formats = [
                "%Y-%m-%d",
                "%d-%b-%Y",
                "%d %b %Y",
                "%d/%m/%Y",
                "%Y-%m-%dT%H:%M:%S",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_val.split()[0], fmt)
                except (ValueError, IndexError):
                    continue
            # Try ISO format
            try:
                return datetime.fromisoformat(date_val.replace('Z', '+00:00'))
            except ValueError:
                pass
        return None
    
    def is_lead_closed(self, lead: Dict) -> bool:
        """Check if a lead is in a closed state"""
        stage = lead.get('enquiry_stage') or ''
        if stage:
            stage = str(stage).strip()
        return stage in CLOSED_STAGES or stage.lower().startswith('closed')
    
    def should_be_duplicate(self, existing_lead: Dict, new_lead: Dict) -> Tuple[bool, str]:
        """
        Determine if new_lead should be marked as duplicate of existing_lead.
        
        Returns:
            - (True, reason) if it should be a duplicate
            - (False, reason) if it should be a new lead
        """
        # Rule 1: If existing lead is CLOSED, new lead is NOT a duplicate
        # This is a repeat/returning customer
        if self.is_lead_closed(existing_lead):
            return False, "Previous enquiry is closed - this is a repeat customer"
        
        # Rule 2: If time gap > 1 year, new lead is NOT a duplicate
        existing_date = self.parse_date(existing_lead.get('enquiry_date'))
        new_date = self.parse_date(new_lead.get('enquiry_date'))
        
        if existing_date and new_date:
            time_gap = abs((new_date - existing_date).days)
            if time_gap > NEW_ENQUIRY_TIME_GAP_DAYS:
                return False, f"Time gap of {time_gap} days exceeds {NEW_ENQUIRY_TIME_GAP_DAYS} days - this is a returning customer"
        
        # Rule 3: If existing lead is OPEN, new lead IS a duplicate
        return True, "Previous enquiry is still open - this is a duplicate entry"
    
    def merge_leads(self, original: Dict, incoming: Dict) -> Dict:
        """
        Merge incoming lead data into original lead.
        
        Rules:
        - Empty fields in original get filled with incoming values
        - Text fields (remarks, etc.) get concatenated
        - Lists get combined
        - Keep original's lead_id and enquiry_no
        
        Returns merged data dict (updates for original)
        """
        merged_updates = {}
        
        # Fields to concatenate (text fields where we want both values)
        concat_fields = ['remarks', 'lost_remarks', 'lost_reason', 'address', 'delivery_address']
        
        # Fields to combine as lists
        list_fields = ['engine_numbers', 'followup_history', 'call_remarks', 'dispatch_status_history', 'closure_answers']
        
        # Fields to skip (don't overwrite these from original)
        skip_fields = ['lead_id', 'created_at', 'is_duplicate', 'original_lead_id', 
                       'duplicate_detected_at', 'deleted_at', '_id']
        
        for key, incoming_value in incoming.items():
            if key in skip_fields:
                continue
            
            # Check for empty/null values - handle numpy arrays properly
            if incoming_value is None:
                continue
            if isinstance(incoming_value, str) and incoming_value == '':
                continue
            if isinstance(incoming_value, list) and len(incoming_value) == 0:
                continue
            # Check for numpy/pandas NaN
            try:
                import pandas as pd
                if pd.isna(incoming_value):
                    continue
            except (TypeError, ValueError):
                pass
            
            original_value = original.get(key)
            
            if key in concat_fields:
                # Concatenate text fields
                if original_value and incoming_value:
                    if str(original_value).strip() != str(incoming_value).strip():
                        merged_updates[key] = f"{original_value} | {incoming_value}"
                elif incoming_value:
                    merged_updates[key] = incoming_value
                    
            elif key in list_fields:
                # Combine lists
                orig_list = original_value if isinstance(original_value, list) else []
                inc_list = incoming_value if isinstance(incoming_value, list) else []
                if inc_list:
                    combined = orig_list + [x for x in inc_list if x not in orig_list]
                    if combined != orig_list:
                        merged_updates[key] = combined
                        
            elif key == 'enquiry_no':
                # Special handling: keep original enquiry_no, store incoming in duplicate field
                if incoming_value and incoming_value != original_value:
                    # Store the duplicate enquiry_no for reference
                    dup_enquiries = original.get('duplicate_enquiry_nos', [])
                    if not isinstance(dup_enquiries, list):
                        dup_enquiries = []
                    if incoming_value not in dup_enquiries:
                        dup_enquiries.append(incoming_value)
                        merged_updates['duplicate_enquiry_nos'] = dup_enquiries
                        
            else:
                # For other fields: fill empty, don't overwrite existing
                if not original_value and incoming_value:
                    merged_updates[key] = incoming_value
        
        return merged_updates
    
    def find_duplicates_by_phone(self, leads: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Group leads by normalized phone number.
        
        Returns dict: {normalized_phone: [list of leads with that phone]}
        """
        phone_groups: Dict[str, List[Dict]] = {}
        
        for lead in leads:
            phone = self.normalize_phone(lead.get('phone_number'))
            if phone:
                if phone not in phone_groups:
                    phone_groups[phone] = []
                phone_groups[phone].append(lead)
        
        return phone_groups
    
    def detect_and_flag_duplicates(
        self, 
        leads: List[Dict]
    ) -> Tuple[List[Dict], Dict[str, str]]:
        """
        Detect duplicates across all leads based on phone number with smart logic.
        
        Smart Logic:
        - Same phone + previous lead OPEN = DUPLICATE (merge into previous)
        - Same phone + previous lead CLOSED = NEW LEAD (repeat customer)
        - Same phone + gap > 1 year = NEW LEAD (returning customer)
        
        Returns:
            - List of leads that should be flagged as duplicates
            - Dict mapping duplicate lead_id -> original lead_id
        """
        if not leads:
            return [], {}
        
        phone_groups = self.find_duplicates_by_phone(leads)
        
        duplicates_to_flag = []
        duplicate_mapping = {}  # duplicate_id -> original_id
        
        for phone, group in phone_groups.items():
            if len(group) < 2:
                continue
            
            # Sort by enquiry_date ascending - OLDEST first
            def get_enquiry_date(lead_item):
                date = self.parse_date(lead_item.get('enquiry_date'))
                return date if date else datetime.max
            
            group.sort(key=get_enquiry_date)
            
            # Process leads in chronological order
            # Track the "current original" - changes when we hit a closed lead
            current_original = group[0]
            original_id = current_original.get('lead_id')
            
            for i, lead in enumerate(group[1:], 1):
                lead_id = lead.get('lead_id')
                if not lead_id or lead_id == original_id:
                    continue
                
                # Check if this should be a duplicate using smart logic
                is_dup, reason = self.should_be_duplicate(current_original, lead)
                
                if is_dup:
                    # This is a duplicate - flag it
                    duplicates_to_flag.append(lead)
                    duplicate_mapping[lead_id] = original_id
                    logger.debug(f"Lead {lead_id} is duplicate of {original_id}: {reason}")
                else:
                    # This is a NEW lead (repeat/returning customer)
                    # It becomes the new "original" for subsequent leads
                    logger.debug(f"Lead {lead_id} is NEW (not duplicate): {reason}")
                    current_original = lead
                    original_id = lead_id
        
        return duplicates_to_flag, duplicate_mapping


# Singleton instance
duplicate_detector = DuplicateDetector()


async def run_duplicate_detection_migration(db):
    """
    Run duplicate detection on all existing leads and flag duplicates.
    Also merges data from duplicates into original leads.
    
    Note: This runs in background and is skipped if already ran in last 6 hours.
    """
    logger.info("Starting duplicate detection migration (phone-based)...")
    
    try:
        # Check if we already ran recently (within 6 hours) to avoid running on every restart
        from datetime import timedelta
        last_run = await db.migration_status.find_one({"migration": "duplicate_detection_v2"})
        if last_run and last_run.get("last_run"):
            last_run_time = last_run.get("last_run")
            if isinstance(last_run_time, str):
                last_run_time = datetime.fromisoformat(last_run_time.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) - last_run_time < timedelta(hours=6):
                logger.info("Duplicate detection already ran in last 6 hours, skipping...")
                return {"duplicates_flagged": 0, "total_checked": 0, "merged": 0, "skipped": True}
        
        # Get all leads that are not soft-deleted - use projection to reduce memory
        leads = await db.leads.find(
            {"deleted_at": {"$exists": False}},
            {
                "_id": 0, 
                "lead_id": 1, 
                "phone_number": 1, 
                "enquiry_date": 1, 
                "enquiry_stage": 1,
                "name": 1,
                "kva": 1,
                "remarks": 1,
                "address": 1
            }
        ).to_list(100000)
        
        logger.info(f"Checking {len(leads)} leads for duplicates...")
        
        # Reset all duplicate flags first for fresh detection
        await db.leads.update_many(
            {"deleted_at": {"$exists": False}},
            {"$set": {"is_duplicate": False, "original_lead_id": None}}
        )
        
        # Detect duplicates
        duplicates_to_flag, duplicate_mapping = duplicate_detector.detect_and_flag_duplicates(leads)
        
        if not duplicates_to_flag:
            logger.info("No duplicates found.")
            # Record successful run
            await db.migration_status.update_one(
                {"migration": "duplicate_detection_v2"},
                {"$set": {"migration": "duplicate_detection_v2", "last_run": datetime.now(timezone.utc).isoformat(), "result": "no_duplicates"}},
                upsert=True
            )
            return {"duplicates_flagged": 0, "total_checked": len(leads), "merged": 0}
        
        logger.info(f"Found {len(duplicates_to_flag)} duplicate leads to flag and merge.")
        
        # Create lookup for leads
        lead_lookup = {lead.get('lead_id'): lead for lead in leads}
        
        # Flag duplicates and merge data into originals
        flagged_count = 0
        merged_count = 0
        now = datetime.now(timezone.utc).isoformat()
        
        for dup in duplicates_to_flag:
            dup_id = dup.get('lead_id')
            original_id = duplicate_mapping.get(dup_id)
            original_lead = lead_lookup.get(original_id)
            
            if original_lead:
                # Merge duplicate's data into original
                merge_updates = duplicate_detector.merge_leads(original_lead, dup)
                
                if merge_updates:
                    merge_updates['updated_at'] = now
                    await db.leads.update_one(
                        {"lead_id": original_id},
                        {"$set": merge_updates}
                    )
                    merged_count += 1
                    # Update local lookup for subsequent merges
                    for key, val in merge_updates.items():
                        original_lead[key] = val
            
            # Flag as duplicate
            result = await db.leads.update_one(
                {"lead_id": dup_id},
                {
                    "$set": {
                        "is_duplicate": True,
                        "original_lead_id": original_id,
                        "duplicate_detected_at": now,
                        "updated_at": now
                    }
                }
            )
            
            if result.modified_count > 0:
                flagged_count += 1
        
        logger.info(f"Duplicate detection complete. Flagged {flagged_count}, merged data into {merged_count} originals.")
        
        return {
            "duplicates_flagged": flagged_count,
            "total_checked": len(leads),
            "merged": merged_count
        }
        
    except Exception as e:
        logger.error(f"Error during duplicate detection: {e}")
        raise


async def find_and_merge_by_phone(db, phone: str, incoming_lead: Dict) -> Optional[Dict]:
    """
    Find existing lead by phone number and determine if it should be merged.
    
    Uses SMART duplicate logic:
    - If existing lead is CLOSED (won/lost) → NOT a duplicate (repeat customer)
    - If time gap > 1 year → NOT a duplicate (returning customer)  
    - If existing lead is OPEN and gap < 1 year → IS a duplicate (merge)
    
    Returns:
        - {"existing_lead": ..., "merge_updates": ..., "is_duplicate": True} if should merge as duplicate
        - {"existing_lead": ..., "is_duplicate": False, "reason": ...} if NOT a duplicate (repeat/returning customer)
        - None if no match found
    """
    normalized_phone = duplicate_detector.normalize_phone(phone)
    if not normalized_phone:
        return None
    
    # Find existing leads with this phone (non-deleted, non-duplicate, sorted by enquiry_date DESC)
    # We want the most recent lead for comparison
    existing_leads = await db.leads.find({
        "$and": [
            {"$or": [
                {"phone_number": normalized_phone},
                {"phone_number": {"$regex": f"{normalized_phone}$"}}
            ]},
            {"deleted_at": {"$exists": False}},
            {"$or": [
                {"is_duplicate": {"$exists": False}},
                {"is_duplicate": False}
            ]}
        ]
    }, {"_id": 0}).sort("enquiry_date", -1).to_list(10)
    
    if not existing_leads:
        return None
    
    # Get the most recent non-duplicate lead
    existing = existing_leads[0]
    
    # Apply SMART duplicate logic
    is_dup, reason = duplicate_detector.should_be_duplicate(existing, incoming_lead)
    
    if is_dup:
        # This IS a duplicate - merge data into existing lead
        merge_updates = duplicate_detector.merge_leads(existing, incoming_lead)
        return {
            "existing_lead": existing,
            "merge_updates": merge_updates,
            "is_duplicate": True,
            "reason": reason
        }
    else:
        # This is NOT a duplicate - it's a repeat/returning customer
        # Return existing lead info but flag that this should be a NEW lead
        return {
            "existing_lead": existing,
            "is_duplicate": False,
            "reason": reason
        }


async def find_by_enquiry_no(db, enquiry_no: str) -> Optional[Dict]:
    """Find existing lead by enquiry number."""
    if not enquiry_no:
        return None
    
    enquiry_no_clean = str(enquiry_no).strip() if enquiry_no else ""
    if not enquiry_no_clean:
        return None
    
    existing = await db.leads.find_one({
        "enquiry_no": enquiry_no_clean,
        "deleted_at": {"$exists": False}
    }, {"_id": 0})
    
    return existing


# Key fields to check for qualified status (50%+ should be filled)
QUALIFIED_FIELDS = [
    'name', 'phone_number', 'enquiry_no', 'enquiry_date', 'state', 'dealer',
    'employee_name', 'kva', 'segment', 'source', 'enquiry_stage', 'enquiry_status',
    'customer_type', 'district', 'address', 'email_address', 'remarks', 'phase', 'qty'
]


def calculate_qualified_status(lead: Dict) -> bool:
    """
    Determine if a lead is qualified based on field fill percentage.
    A lead is qualified if 50% or more of key fields are filled.
    """
    import pandas as pd
    
    filled_count = 0
    
    for field in QUALIFIED_FIELDS:
        value = lead.get(field)
        # Check for various empty/null conditions
        if value is None:
            continue
        if isinstance(value, str) and str(value).strip() == '':
            continue
        if isinstance(value, list) and len(value) == 0:
            continue
        # Check for pandas NaN
        try:
            if pd.isna(value):
                continue
        except (TypeError, ValueError):
            pass
        filled_count += 1
    
    fill_percentage = (filled_count / len(QUALIFIED_FIELDS)) * 100
    return fill_percentage >= 50


async def update_qualified_status_migration(db):
    """
    Run qualified status calculation on all existing leads.
    """
    logger.info("Starting qualified status migration...")
    
    try:
        # Get all non-deleted leads
        leads = await db.leads.find(
            {"deleted_at": {"$exists": False}},
            {"_id": 0}
        ).to_list(100000)
        
        logger.info(f"Calculating qualified status for {len(leads)} leads...")
        
        qualified_count = 0
        not_qualified_count = 0
        now = datetime.now(timezone.utc).isoformat()
        
        for lead in leads:
            # Skip if manually changed
            if lead.get('qualified_changed_by'):
                continue
            
            is_qualified = calculate_qualified_status(lead)
            current_status = lead.get('is_qualified')
            
            # Only update if status changed or not set
            if current_status != is_qualified:
                await db.leads.update_one(
                    {"lead_id": lead.get('lead_id')},
                    {"$set": {"is_qualified": is_qualified, "updated_at": now}}
                )
                
                if is_qualified:
                    qualified_count += 1
                else:
                    not_qualified_count += 1
        
        logger.info(f"Qualified status migration complete. Qualified: {qualified_count}, Not qualified: {not_qualified_count}")
        
        return {
            "qualified": qualified_count,
            "not_qualified": not_qualified_count,
            "total_processed": len(leads)
        }
        
    except Exception as e:
        logger.error(f"Error during qualified status migration: {e}")
        raise


async def run_chunk_based_duplicate_migration(db):
    """
    Run chunk-based duplicate detection and merging.
    
    Logic:
    - Group leads by phone number
    - Sort by enquiry_date
    - Find "closure" points (Closed-Won, Closed-Lost, etc.)
    - Merge all leads BEFORE a closure INTO that closed lead
    - Open leads at the end remain separate until closed
    
    Example: For leads [E1(Open), E2(Hot), E3(Won), E4(Open), E5(Lost), E6(Open)]
    - E1, E2 merge INTO E3 (first closure)
    - E4 merges INTO E5 (second closure)
    - E6 stays separate (no closure yet)
    """
    logger.info("Starting chunk-based duplicate detection migration...")
    
    try:
        # Get all leads that are not soft-deleted
        leads = await db.leads.find(
            {"deleted_at": {"$exists": False}},
            {"_id": 0}
        ).to_list(100000)
        
        logger.info(f"Processing {len(leads)} leads for chunk-based duplicate detection...")
        
        # Reset all duplicate flags and merged_enquiries for fresh detection
        await db.leads.update_many(
            {"deleted_at": {"$exists": False}},
            {
                "$set": {"is_duplicate": False, "original_lead_id": None},
                "$unset": {"merged_enquiries": ""}
            }
        )
        
        # Group leads by normalized phone
        phone_groups = duplicate_detector.find_duplicates_by_phone(leads)
        
        now = datetime.now(timezone.utc).isoformat()
        flagged_count = 0
        merged_count = 0
        
        for phone, group in phone_groups.items():
            if len(group) < 2:
                continue
            
            # Sort by enquiry_date ascending (oldest first)
            def get_date(lead):
                d = duplicate_detector.parse_date(lead.get('enquiry_date'))
                return d if d else datetime.max
            
            group.sort(key=get_date)
            
            # Process in chunks - each chunk ends with a CLOSED lead
            chunk = []
            
            for lead in group:
                stage = lead.get('enquiry_stage', '')
                is_closed = stage in CLOSED_STAGES
                
                if is_closed:
                    # This lead is the "closure" - merge all previous chunk leads into it
                    if chunk:
                        # Prepare merged_enquiries data
                        merged_enquiries = []
                        for dup_lead in chunk:
                            merged_enquiries.append({
                                "enquiry_no": dup_lead.get('enquiry_no'),
                                "enquiry_date": dup_lead.get('enquiry_date'),
                                "enquiry_stage": dup_lead.get('enquiry_stage'),
                                "enquiry_type": dup_lead.get('enquiry_type'),
                                "name": dup_lead.get('name'),
                                "kva": dup_lead.get('kva'),
                                "qty": dup_lead.get('qty'),
                                "remarks": dup_lead.get('remarks'),
                                "lead_id": dup_lead.get('lead_id')
                            })
                        
                        # Merge data from chunk leads into the closed lead
                        merged_data = {}
                        for dup_lead in chunk:
                            field_updates = duplicate_detector.merge_leads(lead, dup_lead)
                            for k, v in field_updates.items():
                                if k not in merged_data:
                                    merged_data[k] = v
                        
                        # Update the closed lead with merged enquiries
                        main_lead_id = lead.get('lead_id')
                        update_fields = {
                            "merged_enquiries": merged_enquiries,
                            "updated_at": now
                        }
                        update_fields.update(merged_data)
                        
                        await db.leads.update_one(
                            {"lead_id": main_lead_id},
                            {"$set": update_fields}
                        )
                        merged_count += 1
                        
                        # Flag chunk leads as duplicates
                        for dup_lead in chunk:
                            dup_id = dup_lead.get('lead_id')
                            await db.leads.update_one(
                                {"lead_id": dup_id},
                                {
                                    "$set": {
                                        "is_duplicate": True,
                                        "original_lead_id": main_lead_id,
                                        "duplicate_detected_at": now,
                                        "updated_at": now
                                    }
                                }
                            )
                            flagged_count += 1
                    
                    # Reset chunk for next closure
                    chunk = []
                else:
                    # This lead is OPEN - add to current chunk
                    chunk.append(lead)
            
            # Any remaining open leads in chunk stay as-is (not duplicates)
            # They're waiting for a future closure
        
        logger.info(f"Chunk-based migration complete. Flagged {flagged_count} duplicates, {merged_count} leads received merged data.")
        
        return {
            "duplicates_flagged": flagged_count,
            "leads_with_merged_data": merged_count,
            "total_processed": len(leads)
        }
        
    except Exception as e:
        logger.error(f"Error during chunk-based duplicate migration: {e}")
        raise

