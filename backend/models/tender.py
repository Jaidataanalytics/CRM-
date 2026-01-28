"""
Tender Pydantic Models for validation and serialization
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ConsigneeModel(BaseModel):
    """Consignee/Reporting Officer model"""
    name: str = ""
    address: str = ""
    quantity: int = 0
    delivery_days: int = 0


class CompetitorBidModel(BaseModel):
    """Competitor bid information for a specific tender"""
    name: str
    bid_amount: float = 0
    rank: int = 0


class TimelineEventModel(BaseModel):
    """Timeline event for tender history"""
    action: str
    date: str
    user: str
    details: str = ""


class DocumentModel(BaseModel):
    """Document attached to a tender"""
    _id: Optional[str] = None
    name: str = "Document"
    type: str = "other"  # bid_doc, technical_spec, boq, our_quotation, result_letter, other
    url: str = ""
    uploaded_at: Optional[str] = None
    uploaded_by: Optional[str] = None


class TenderBase(BaseModel):
    """Base tender model with all fields"""
    # Extracted fields from PDF
    bid_number: str = ""
    dated: str = ""  # YYYY-MM-DD
    bid_end_date: str = ""  # YYYY-MM-DD HH:MM:SS
    bid_opening_date: str = ""  # YYYY-MM-DD HH:MM:SS
    department_name: str = ""
    total_quantity: int = 0
    estimated_value: float = 0
    beneficiary: str = ""
    consignees: List[ConsigneeModel] = []
    emd_amount: float = 0
    item_specifications: str = ""
    product_category: str = ""
    delivery_period: int = 0  # in days
    warranty_period: str = ""
    payment_terms: str = ""
    
    # Manual/editable fields
    status: str = "pending"  # pending, participated, won, lost, not_participated, cancelled
    our_bid_amount: float = 0
    assigned_employee: str = ""
    notes: str = ""
    
    # Winner/Result fields
    winner_name: str = ""
    winner_amount: float = 0
    result_date: str = ""
    loss_reason: str = ""
    
    # Competitors for this tender
    competitors: List[CompetitorBidModel] = []


class TenderCreate(TenderBase):
    """Model for creating a new tender"""
    pass


class TenderUpdate(BaseModel):
    """Model for updating a tender - all fields optional"""
    bid_number: Optional[str] = None
    dated: Optional[str] = None
    bid_end_date: Optional[str] = None
    bid_opening_date: Optional[str] = None
    department_name: Optional[str] = None
    total_quantity: Optional[int] = None
    estimated_value: Optional[float] = None
    beneficiary: Optional[str] = None
    consignees: Optional[List[ConsigneeModel]] = None
    emd_amount: Optional[float] = None
    item_specifications: Optional[str] = None
    product_category: Optional[str] = None
    delivery_period: Optional[int] = None
    warranty_period: Optional[str] = None
    payment_terms: Optional[str] = None
    status: Optional[str] = None
    our_bid_amount: Optional[float] = None
    assigned_employee: Optional[str] = None
    notes: Optional[str] = None
    winner_name: Optional[str] = None
    winner_amount: Optional[float] = None
    result_date: Optional[str] = None
    loss_reason: Optional[str] = None
    competitors: Optional[List[CompetitorBidModel]] = None


class TenderResponse(TenderBase):
    """Response model for a tender"""
    _id: str
    documents: List[DocumentModel] = []
    timeline: List[TimelineEventModel] = []
    created_at: str
    updated_at: str
    created_by: str


# Competitor Master List Models
class CompetitorMaster(BaseModel):
    """Master competitor entry"""
    name: str
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    notes: str = ""
    is_active: bool = True


class CompetitorMasterCreate(CompetitorMaster):
    """Model for creating a competitor"""
    pass


class CompetitorMasterUpdate(BaseModel):
    """Model for updating a competitor"""
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CompetitorMasterResponse(CompetitorMaster):
    """Response model for a competitor"""
    _id: str
    created_at: str
    updated_at: str
