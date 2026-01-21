"""
Fuzzy Matching Utility for Data Normalization
Handles aggressive matching for fields like Status, Dealer, State, Employee, Segment
"""
from rapidfuzz import fuzz, process
from typing import Dict, List, Optional, Tuple
import re


class FuzzyMatcher:
    """
    Aggressive fuzzy matching for normalizing field values.
    Handles case differences, punctuation, spacing, and typos.
    """
    
    # Standard values for common fields (canonical forms)
    STANDARD_STATUSES = [
        "Prospecting", "Qualified", "Negotiation", "Closed-Won", "Closed-Lost",
        "Closed-Faulty", "Closed-Dropped", "Order Booked", "Hot", "Warm", "Cold",
        "Follow-up", "Lost", "Won", "Pending", "New", "Open"
    ]
    
    # Direct mappings for case variations of statuses
    STATUS_MAPPINGS = {
        "open": "Open",
        "OPEN": "Open",
        "faulty": "Closed-Faulty",
        "FAULTY": "Closed-Faulty",
        "Faulty": "Closed-Faulty",
        "lost": "Closed-Lost",
        "LOST": "Closed-Lost",
        "Lost": "Closed-Lost",
        "won": "Closed-Won",
        "WON": "Closed-Won",
        "Won": "Closed-Won",
        "prospecting": "Prospecting",
        "PROSPECTING": "Prospecting",
        "qualified": "Qualified",
        "QUALIFIED": "Qualified",
        "negotiation": "Negotiation",
        "NEGOTIATION": "Negotiation",
        "hot": "Hot",
        "HOT": "Hot",
        "warm": "Warm",
        "WARM": "Warm",
        "cold": "Cold",
        "COLD": "Cold",
        "order booked": "Order Booked",
        "ORDER BOOKED": "Order Booked",
        "closed-won": "Closed-Won",
        "CLOSED-WON": "Closed-Won",
        "closed-lost": "Closed-Lost",
        "CLOSED-LOST": "Closed-Lost",
        "closed-faulty": "Closed-Faulty",
        "CLOSED-FAULTY": "Closed-Faulty",
        "closed-dropped": "Closed-Dropped",
        "CLOSED-DROPPED": "Closed-Dropped",
    }
    
    def __init__(self, threshold: int = 75):
        """
        Initialize with matching threshold.
        threshold: Minimum similarity score (0-100) to consider a match
        """
        self.threshold = threshold
        self.cache = {}  # Cache for performance
        
    def normalize_string(self, value: str) -> str:
        """
        Basic normalization: lowercase, strip, normalize spaces and punctuation
        """
        if not value or not isinstance(value, str):
            return ""
        
        # Convert to lowercase and strip
        normalized = value.lower().strip()
        
        # Normalize multiple spaces to single space
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove extra punctuation but keep meaningful ones
        # Keep periods in abbreviations like "J.B."
        normalized = re.sub(r'[,;:!?\'\"]+', '', normalized)
        
        return normalized
    
    def create_search_key(self, value: str) -> str:
        """
        Create a simplified search key for faster matching.
        Removes all special chars and spaces for comparison.
        """
        if not value:
            return ""
        return re.sub(r'[^a-z0-9]', '', value.lower())
    
    def find_best_match(self, value: str, candidates: List[str], min_score: int = None) -> Tuple[Optional[str], int]:
        """
        Find the best matching candidate for a given value.
        Returns (matched_value, score) or (None, 0) if no match found.
        """
        if not value or not candidates:
            return None, 0
        
        min_score = min_score or self.threshold
        normalized_value = self.normalize_string(value)
        
        # Check cache first
        cache_key = f"{normalized_value}:{','.join(sorted(candidates)[:10])}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Quick exact match check (case-insensitive)
        for candidate in candidates:
            if self.normalize_string(candidate) == normalized_value:
                result = (candidate, 100)
                self.cache[cache_key] = result
                return result
        
        # Search key match (ignoring all special chars)
        value_key = self.create_search_key(value)
        for candidate in candidates:
            if self.create_search_key(candidate) == value_key:
                result = (candidate, 95)
                self.cache[cache_key] = result
                return result
        
        # Fuzzy match using rapidfuzz
        best_match = process.extractOne(
            normalized_value,
            [self.normalize_string(c) for c in candidates],
            scorer=fuzz.WRatio,
            score_cutoff=min_score
        )
        
        if best_match:
            # Find original candidate
            matched_normalized = best_match[0]
            for candidate in candidates:
                if self.normalize_string(candidate) == matched_normalized:
                    result = (candidate, int(best_match[1]))
                    self.cache[cache_key] = result
                    return result
        
        return None, 0
    
    def normalize_status(self, value: str) -> str:
        """Normalize status/enquiry_stage field"""
        if not value:
            return value
        
        # First check direct mappings (case variations)
        if value in self.STATUS_MAPPINGS:
            return self.STATUS_MAPPINGS[value]
        
        # Check case-insensitive match against standard statuses
        value_lower = value.lower().strip()
        for std in self.STANDARD_STATUSES:
            if std.lower() == value_lower:
                return std
            
        # Try fuzzy match
        match, score = self.find_best_match(value, self.STANDARD_STATUSES, min_score=70)
        if match:
            return match
        
        # If no standard match, return title-cased version
        return value.strip().title()
    
    def normalize_field_value(self, value: str, existing_values: List[str], field_name: str = "") -> str:
        """
        Normalize a field value against existing values in the database.
        Returns the best matching existing value, or the cleaned input if no match.
        """
        if not value or not isinstance(value, str):
            return value
        
        value = value.strip()
        if not value:
            return value
        
        # For status fields, use standard values
        if field_name.lower() in ['status', 'enquiry_stage', 'stage']:
            normalized = self.normalize_status(value)
            if normalized != value:
                return normalized
        
        # Try to match against existing values
        if existing_values:
            match, score = self.find_best_match(value, existing_values)
            if match and score >= self.threshold:
                return match
        
        # No match found - return cleaned version
        # Title case for names, preserve original for others
        if field_name.lower() in ['dealer', 'employee', 'employee_name', 'state', 'segment']:
            # Smart title case that preserves abbreviations
            return self.smart_title_case(value)
        
        return value
    
    def smart_title_case(self, value: str) -> str:
        """
        Title case that handles abbreviations better.
        E.g., "j.b. enterprises" -> "J.B. Enterprises"
        """
        if not value:
            return value
        
        words = value.split()
        result = []
        
        for word in words:
            # Check if it's an abbreviation (has periods or all caps short word)
            if '.' in word:
                # Capitalize each letter before a period
                parts = word.split('.')
                result.append('.'.join(p.upper() if len(p) <= 2 else p.capitalize() for p in parts))
            elif len(word) <= 3 and word.upper() == word:
                # Keep short all-caps words (like "LLC", "PVT")
                result.append(word.upper())
            else:
                result.append(word.capitalize())
        
        return ' '.join(result)
    
    def get_similar_values(self, value: str, candidates: List[str], top_n: int = 5) -> List[Tuple[str, int]]:
        """
        Get top N similar values from candidates.
        Returns list of (value, score) tuples.
        """
        if not value or not candidates:
            return []
        
        normalized_value = self.normalize_string(value)
        
        results = process.extract(
            normalized_value,
            [self.normalize_string(c) for c in candidates],
            scorer=fuzz.WRatio,
            limit=top_n
        )
        
        # Map back to original values
        output = []
        for match_normalized, score, _ in results:
            for candidate in candidates:
                if self.normalize_string(candidate) == match_normalized:
                    output.append((candidate, int(score)))
                    break
        
        return output


# Singleton instance for use across the application
fuzzy_matcher = FuzzyMatcher(threshold=75)


def normalize_lead_data(lead_data: Dict, existing_values: Dict[str, List[str]]) -> Dict:
    """
    Normalize lead data by fuzzy matching against existing database values.
    This helps consolidate similar values (e.g., "Jharkhand" vs "jharkhand").
    
    NOTE: employee_name is NOT fuzzy matched to preserve original values.
    
    Args:
        lead_data: Dictionary of lead fields
        existing_values: Dict mapping field names to lists of existing values
                        e.g., {"dealer": ["J.B. Enterprises", "ABC Corp"], ...}
    
    Returns:
        Normalized lead data dictionary
    """
    if not lead_data:
        return lead_data
    
    normalized = lead_data.copy()
    
    # Fields to normalize with fuzzy matching
    # IMPORTANT: employee_name is excluded to prevent unwanted name changes
    fields_to_normalize = [
        ('dealer', 'dealer'),
        ('state', 'state'),
        ('segment', 'segment'),
        ('enquiry_stage', 'enquiry_stage'),
        ('status', 'enquiry_stage'),
    ]
    
    for field_key, existing_key in fields_to_normalize:
        if field_key in normalized and normalized[field_key]:
            existing = existing_values.get(existing_key, [])
            normalized[field_key] = fuzzy_matcher.normalize_field_value(
                normalized[field_key],
                existing,
                field_key
            )
    
    # For employee_name, only do exact match or smart title case - NO fuzzy matching
    if 'employee_name' in normalized and normalized['employee_name']:
        emp_name = normalized['employee_name'].strip()
        existing_employees = existing_values.get('employee_name', [])
        
        # Check for exact match (case-insensitive)
        matched = False
        for existing_emp in existing_employees:
            if existing_emp and existing_emp.lower() == emp_name.lower():
                normalized['employee_name'] = existing_emp
                matched = True
                break
        
        # If no exact match, just use smart title case
        if not matched:
            normalized['employee_name'] = fuzzy_matcher.smart_title_case(emp_name)
    
    return normalized
