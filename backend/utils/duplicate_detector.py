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
        stage = lead.get('enquiry_stage', '').strip()
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
        Detect duplicates across all leads based on phone number.
        
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
            
            # Sort by enquiry_date ascending - OLDEST first (becomes original)
            def get_enquiry_date(lead_item):
                date = self.parse_date(lead_item.get('enquiry_date'))
                return date if date else datetime.max
            
            group.sort(key=get_enquiry_date)
            
            # The oldest (first) is the original
            original = group[0]
            original_id = original.get('lead_id')
            
            # All others are duplicates
            for dup in group[1:]:
                dup_id = dup.get('lead_id')
                if dup_id and dup_id != original_id:
                    duplicates_to_flag.append(dup)
                    duplicate_mapping[dup_id] = original_id
        
        return duplicates_to_flag, duplicate_mapping


# Singleton instance
duplicate_detector = DuplicateDetector()


async def run_duplicate_detection_migration(db):
    """
    Run duplicate detection on all existing leads and flag duplicates.
    Also merges data from duplicates into original leads.
    """
    logger.info("Starting duplicate detection migration (phone-based)...")
    
    try:
        # Get all leads that are not soft-deleted
        leads = await db.leads.find(
            {"deleted_at": {"$exists": False}},
            {"_id": 0}
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
    Find existing lead by phone number and merge incoming data.
    
    Returns the merged lead if found, None if no match.
    """
    normalized_phone = duplicate_detector.normalize_phone(phone)
    if not normalized_phone:
        return None
    
    # Find existing leads with this phone (non-deleted, non-duplicate)
    existing = await db.leads.find_one({
        "$or": [
            {"phone_number": normalized_phone},
            {"phone_number": {"$regex": f"{normalized_phone}$"}}
        ],
        "deleted_at": {"$exists": False},
        "$or": [
            {"is_duplicate": {"$exists": False}},
            {"is_duplicate": False}
        ]
    }, {"_id": 0})
    
    if not existing:
        return None
    
    # Merge data
    merge_updates = duplicate_detector.merge_leads(existing, incoming_lead)
    
    return {
        "existing_lead": existing,
        "merge_updates": merge_updates
    }


async def find_by_enquiry_no(db, enquiry_no: str) -> Optional[Dict]:
    """Find existing lead by enquiry number."""
    if not enquiry_no:
        return None
    
    existing = await db.leads.find_one({
        "enquiry_no": enquiry_no.strip(),
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
        if isinstance(value, str) and value.strip() == '':
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
