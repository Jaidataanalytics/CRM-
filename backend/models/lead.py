from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone, date
import uuid


class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    lead_id: str = Field(default_factory=lambda: f"lead_{uuid.uuid4().hex[:12]}")
    
    # Location fields
    zone: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None
    office: Optional[str] = None
    dealer: Optional[str] = None
    branch: Optional[str] = None
    location: Optional[str] = None
    
    # Employee fields
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    employee_status: Optional[str] = None
    
    # Enquiry fields
    enquiry_no: Optional[str] = None
    enquiry_date: Optional[str] = None
    
    # Customer fields
    customer_type: Optional[str] = None
    corporate_name: Optional[str] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    pincode: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None
    
    # Product fields
    kva: Optional[float] = None
    phase: Optional[str] = None
    qty: Optional[int] = None
    remarks: Optional[str] = None
    
    # Status fields
    enquiry_status: Optional[str] = None  # Open, Closed
    enquiry_type: Optional[str] = None    # Hot, Cold, Warm
    enquiry_stage: Optional[str] = None   # Prospecting, Closed-Won, Closed-Lost
    
    # Date fields
    eo_po_date: Optional[str] = None
    planned_followup_date: Optional[str] = None
    last_followup_date: Optional[str] = None
    enquiry_closure_date: Optional[str] = None
    
    # Source fields
    source: Optional[str] = None
    source_from: Optional[str] = None
    events: Optional[str] = None
    no_of_followups: Optional[int] = None
    
    # Segment fields
    segment: Optional[str] = None
    sub_segment: Optional[str] = None
    dg_ownership: Optional[str] = None
    
    # Other fields
    created_by: Optional[str] = None
    pan_no: Optional[str] = None
    finance_required: Optional[str] = None
    finance_company: Optional[str] = None
    referred_by: Optional[str] = None
    
    # System fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadCreate(BaseModel):
    zone: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None
    office: Optional[str] = None
    dealer: Optional[str] = None
    branch: Optional[str] = None
    location: Optional[str] = None
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    employee_status: Optional[str] = None
    enquiry_no: Optional[str] = None
    enquiry_date: Optional[str] = None
    customer_type: Optional[str] = None
    corporate_name: Optional[str] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    pincode: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None
    kva: Optional[float] = None
    phase: Optional[str] = None
    qty: Optional[int] = None
    remarks: Optional[str] = None
    enquiry_status: Optional[str] = None
    enquiry_type: Optional[str] = None
    enquiry_stage: Optional[str] = None
    eo_po_date: Optional[str] = None
    planned_followup_date: Optional[str] = None
    last_followup_date: Optional[str] = None
    enquiry_closure_date: Optional[str] = None
    source: Optional[str] = None
    source_from: Optional[str] = None
    events: Optional[str] = None
    no_of_followups: Optional[int] = None
    segment: Optional[str] = None
    sub_segment: Optional[str] = None
    dg_ownership: Optional[str] = None
    created_by: Optional[str] = None
    pan_no: Optional[str] = None
    finance_required: Optional[str] = None
    finance_company: Optional[str] = None
    referred_by: Optional[str] = None


class LeadUpdate(BaseModel):
    zone: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None
    office: Optional[str] = None
    dealer: Optional[str] = None
    branch: Optional[str] = None
    location: Optional[str] = None
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    employee_status: Optional[str] = None
    enquiry_no: Optional[str] = None
    enquiry_date: Optional[str] = None
    customer_type: Optional[str] = None
    corporate_name: Optional[str] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    pincode: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None
    kva: Optional[float] = None
    phase: Optional[str] = None
    qty: Optional[int] = None
    remarks: Optional[str] = None
    enquiry_status: Optional[str] = None
    enquiry_type: Optional[str] = None
    enquiry_stage: Optional[str] = None
    eo_po_date: Optional[str] = None
    planned_followup_date: Optional[str] = None
    last_followup_date: Optional[str] = None
    enquiry_closure_date: Optional[str] = None
    source: Optional[str] = None
    source_from: Optional[str] = None
    events: Optional[str] = None
    no_of_followups: Optional[int] = None
    segment: Optional[str] = None
    sub_segment: Optional[str] = None
    dg_ownership: Optional[str] = None
    pan_no: Optional[str] = None
    finance_required: Optional[str] = None
    finance_company: Optional[str] = None
    referred_by: Optional[str] = None


class LeadResponse(BaseModel):
    lead_id: str
    zone: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None
    dealer: Optional[str] = None
    employee_name: Optional[str] = None
    enquiry_no: Optional[str] = None
    enquiry_date: Optional[str] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    kva: Optional[float] = None
    enquiry_status: Optional[str] = None
    enquiry_type: Optional[str] = None
    enquiry_stage: Optional[str] = None
    segment: Optional[str] = None
    created_at: datetime
