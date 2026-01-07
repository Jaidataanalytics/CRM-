"""
Duplicate Lead Detection Utility
Identifies duplicate leads based on fuzzy matching of phone_number + employee_name + corporate_name
"""
from rapidfuzz import fuzz
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class DuplicateDetector:
    """
    Detects duplicate leads using fuzzy matching.
    
    Criteria for duplicates:
    - Same phone_number (exact match after normalization)
    - Similar employee_name (fuzzy match >= threshold)
    - Similar corporate_name (fuzzy match >= threshold)
    
    Logic:
    - The NEWEST lead (by created_at) is considered the "original"
    - All older matching leads are flagged as "duplicates"
    """
    
    def __init__(self, name_threshold: int = 80):
        """
        Initialize duplicate detector.
        
        Args:
            name_threshold: Minimum fuzzy match score (0-100) for name fields
        """
        self.name_threshold = name_threshold
    
    def normalize_phone(self, phone: str) -> str:
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
    
    def normalize_name(self, name: str) -> str:
        """Normalize name for fuzzy comparison"""
        if not name:
            return ""
        # Lowercase, strip, remove extra spaces
        normalized = ' '.join(str(name).lower().strip().split())
        return normalized
    
    def is_name_match(self, name1: str, name2: str) -> bool:
        """Check if two names match using fuzzy matching"""
        n1 = self.normalize_name(name1)
        n2 = self.normalize_name(name2)
        
        if not n1 or not n2:
            # If either name is empty, consider it a match (don't disqualify)
            return True
        
        # Use token_sort_ratio for better handling of name order differences
        score = fuzz.token_sort_ratio(n1, n2)
        return score >= self.name_threshold
    
    def find_duplicates_for_lead(
        self, 
        lead: Dict, 
        all_leads: List[Dict]
    ) -> List[Dict]:
        """
        Find all leads that are potential duplicates of the given lead.
        
        Returns list of leads that match the duplicate criteria.
        """
        phone = self.normalize_phone(lead.get('phone_number'))
        employee_name = lead.get('employee_name', '')
        corporate_name = lead.get('corporate_name', '')
        lead_id = lead.get('lead_id')
        
        if not phone:
            # Can't find duplicates without phone number
            return []
        
        duplicates = []
        
        for other in all_leads:
            if other.get('lead_id') == lead_id:
                continue  # Skip self
            
            # Check phone number match (exact after normalization)
            other_phone = self.normalize_phone(other.get('phone_number'))
            if phone != other_phone:
                continue
            
            # Check employee_name match (fuzzy)
            if not self.is_name_match(employee_name, other.get('employee_name', '')):
                continue
            
            # Check corporate_name match (fuzzy)
            if not self.is_name_match(corporate_name, other.get('corporate_name', '')):
                continue
            
            # All criteria matched - this is a duplicate
            duplicates.append(other)
        
        return duplicates
    
    def detect_and_flag_duplicates(
        self, 
        leads: List[Dict]
    ) -> Tuple[List[Dict], Dict[str, str]]:
        """
        Detect duplicates across all leads and determine which should be flagged.
        
        Returns:
            - List of leads that should be flagged as duplicates
            - Dict mapping duplicate lead_id -> original lead_id
        """
        if not leads:
            return [], {}
        
        # Group leads by normalized phone number for efficiency
        phone_groups: Dict[str, List[Dict]] = {}
        
        for lead in leads:
            phone = self.normalize_phone(lead.get('phone_number'))
            if phone:
                if phone not in phone_groups:
                    phone_groups[phone] = []
                phone_groups[phone].append(lead)
        
        duplicates_to_flag = []
        duplicate_mapping = {}  # duplicate_id -> original_id
        
        for phone, group in phone_groups.items():
            if len(group) < 2:
                continue
            
            # Find clusters of duplicates within this phone group
            processed = set()
            
            for lead in group:
                if lead.get('lead_id') in processed:
                    continue
                
                # Find all duplicates for this lead
                matches = [lead]
                for other in group:
                    if other.get('lead_id') in processed:
                        continue
                    if other.get('lead_id') == lead.get('lead_id'):
                        continue
                    
                    # Check name criteria
                    if self.is_name_match(lead.get('employee_name', ''), other.get('employee_name', '')):
                        if self.is_name_match(lead.get('corporate_name', ''), other.get('corporate_name', '')):
                            matches.append(other)
                
                if len(matches) > 1:
                    # Sort by created_at descending - newest first
                    def get_created_at(lead_item):
                        created = lead_item.get('created_at')
                        if isinstance(created, datetime):
                            return created
                        if isinstance(created, str):
                            try:
                                # Try parsing ISO format
                                return datetime.fromisoformat(created.replace('Z', '+00:00'))
                            except ValueError:
                                pass
                        return datetime.min
                    
                    matches.sort(key=get_created_at, reverse=True)
                    
                    # The newest (first) is the original
                    original = matches[0]
                    original_id = original.get('lead_id')
                    
                    # All others are duplicates
                    for dup in matches[1:]:
                        dup_id = dup.get('lead_id')
                        if dup_id and dup_id not in processed:
                            duplicates_to_flag.append(dup)
                            duplicate_mapping[dup_id] = original_id
                            processed.add(dup_id)
                    
                    processed.add(original_id)
        
        return duplicates_to_flag, duplicate_mapping


# Singleton instance
duplicate_detector = DuplicateDetector(name_threshold=80)


async def run_duplicate_detection_migration(db):
    """
    Run duplicate detection on all existing leads and flag duplicates.
    This is designed to run once on startup or on-demand.
    """
    logger.info("Starting duplicate detection migration...")
    
    try:
        # Get all leads that are not already flagged as duplicates
        leads = await db.leads.find(
            {
                "deleted_at": {"$exists": False},
                "$or": [
                    {"is_duplicate": {"$exists": False}},
                    {"is_duplicate": False}
                ]
            },
            {"_id": 0}
        ).to_list(100000)
        
        logger.info(f"Checking {len(leads)} leads for duplicates...")
        
        # Detect duplicates
        duplicates_to_flag, duplicate_mapping = duplicate_detector.detect_and_flag_duplicates(leads)
        
        if not duplicates_to_flag:
            logger.info("No duplicates found.")
            return {"duplicates_flagged": 0, "total_checked": len(leads)}
        
        logger.info(f"Found {len(duplicates_to_flag)} duplicate leads to flag.")
        
        # Flag duplicates in database
        flagged_count = 0
        now = datetime.now(timezone.utc).isoformat()
        
        for dup in duplicates_to_flag:
            dup_id = dup.get('lead_id')
            original_id = duplicate_mapping.get(dup_id)
            
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
        
        logger.info(f"Duplicate detection complete. Flagged {flagged_count} leads as duplicates.")
        
        return {
            "duplicates_flagged": flagged_count,
            "total_checked": len(leads)
        }
        
    except Exception as e:
        logger.error(f"Error during duplicate detection: {e}")
        raise
