# Sharda Leads Dashboard - Product Requirements Document

## Original Problem Statement
Build a comprehensive leads management dashboard for tracking sales leads, forecasting, and analytics with features for:
- Lead management with deduplication
- Sales forecasting with KVA breakdown
- Multi-dimensional analytics (Segment, Source, KVA, Closure)
- Market potential comparison
- Year-over-Year analysis
- Transfer leads to dealers workflow

## User Personas
- **Admin**: Full access to all features, data management, cleanup tools
- **Manager**: Access to forecasts, analytics, lead management
- **Sales Staff**: Basic lead viewing and updates

## Core Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── kpis.py              # Dashboard KPIs with KVA breakdown
│   │   ├── insights.py          # All analytics endpoints (Segment, Source, KVA, Temperature, Lead Age)
│   │   ├── market_potential.py  # Comparison page data
│   │   ├── forecast.py          # Forecasting with complete data saving
│   │   └── leads.py             # Lead management + transfer + duplicate analytics
│   └── server.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.js      # KVA breakdown cards (LKVA/MKVA/HKVA)
        │   ├── Insights.js       # All analysis tabs + Summary Builder
        │   ├── Comparison.js     # Market potential analysis
        │   ├── Leads.js          # Lead management + Transfer Modal
        │   ├── TransferredLeads.js # Transferred leads tracking + analytics
        │   ├── DuplicateLeads.js # Data quality + Analytics tab
        │   └── CompareForecasts.js # Saved forecast details view
        ├── context/
        │   └── FilterContext.js  # Global filters including maxLeadAge
        └── components/
            └── filters/
                └── FilterBar.js  # Filter bar with lead age slider
```

## What's Been Implemented (as of Jan 2026)

### Searchable Dropdowns (NEW - Jan 21, 2026)
- [x] Created reusable `SearchableSelect` component at `/app/frontend/src/components/ui/searchable-select.jsx`
- [x] Implemented in FilterBar.js - State, Dealer, Employee, Segment dropdowns now searchable
- [x] Implemented in Leads.js - Dealer and Employee fields in edit form and transfer modal

### Lead Age Analysis Fix (NEW - Jan 21, 2026)
- [x] Fixed dynamic calculation of `lead_age` in `/app/backend/routes/insights.py`
- [x] Lead age now calculated in real-time using MongoDB's `$dateDiff` instead of relying on a stored field
- [x] Age buckets (0-30d, 31-60d, 61-90d, 90+d) working correctly

### Transfer to Dealer Feature
- [x] Transfer Modal with Target Dealer, Original Generator, Notes
- [x] Transferred Leads Page with summary cards and analytics
- [x] By Employee / By Dealer breakdown tabs
- [x] Auto-linking when dealer re-uploads matching lead
- [x] Exclusion from all KPIs (no count duplication)
- [x] Visual indicator (↔ icon) on transferred leads
- [x] Bulk transfer support
- [x] Undo transfer functionality

### Dashboard
- [x] KPI cards with LKVA/MKVA/HKVA breakdown
- [x] Hot/Warm/Cold leads summary
- [x] Quick actions and recent activity

### Insights Page
- [x] Top Performers tab
- [x] Segment Analysis with YoY toggle
- [x] Closure Analysis with YoY toggle
- [x] Source Analysis with YoY toggle
- [x] KVA Analysis with YoY toggle
- [x] **Hot/Warm/Cold Analysis** - Temperature distribution by dimension
- [x] **Lead Age Analysis** - Average lead age by dimension
- [x] Summary Builder with KVA dimension + Financial Year format
- [x] Multi-level drill-down (Category → Dealer → District → Employee)

### Comparison Page
- [x] Market potential data upload via Excel
- [x] Comparison by District, Dealer, State, KVA Range
- [x] Uses actual `district` field (not `location`)
- [x] Indian Financial Year date logic

### Global Filters
- [x] Date range (Indian FY default)
- [x] State, Dealer, Employee, Segment
- [x] KVA Min/Max
- [x] **Max Lead Age slider** - Filter out leads older than X days

### Forecasting
- [x] Adaptive seasonal forecasting model
- [x] KVA, Dealer, Segment breakdowns
- [x] Backtest functionality
- [x] **Complete forecast saving** - Saves all breakdowns, notes, summary
- [x] **Saved forecast details view** - View breakdown on Compare Forecasts page

### Data Management
- [x] Duplicate leads detection
- [x] Merge history
- [x] Order time punch detection
- [x] Won without SO detection
- [x] **Analytics tab** - Duplicates/merges by dimension
- [x] Clickable leads in merge history

## Transfer to Dealer - Data Model

### Transferred Lead Fields:
```javascript
{
  is_transferred: true,               // Flag for exclusion
  enquiry_status: "Transferred",      // New status
  transferred_to_dealer_name: "...",  // Target dealer
  transferred_by_employee: "...",     // Original generator
  transfer_notes: "...",              // Optional notes
  transferred_at: "2026-01-21T...",   // Transfer timestamp
  transferred_by_user: "admin",       // Who performed transfer
  linked_dealer_lead_id: "...",       // When dealer uploads (auto-linked)
  linked_at: "..."                    // Link timestamp
}
```

### Dealer's Re-uploaded Lead Fields:
```javascript
{
  is_transferred_lead: true,          // Indicator flag
  original_transfer_id: "...",        // Link to original
  original_generated_by: "...",       // Who generated original
  original_enquiry_no: "..."          // Original enquiry reference
}
```

## Prioritized Backlog

### P0 - Critical
None currently

### P1 - High Priority
1. **Funnel Analysis** - Conversion rates: Enquiry → Quotation → Won
2. **Manual 'Qualified' Toggle** - UI to set lead's `is_qualified` status
3. **Complete searchable dropdowns** - Apply SearchableSelect to remaining large dropdowns in Insights.js and Admin.js (currently done for FilterBar.js and key Leads.js fields)

### P2 - Medium Priority
1. **Refactor Large Components** - Break down Insights.js (~2500 lines), Admin.js (~3000 lines), Leads.js (~3000 lines)
2. **Lead Velocity & ROI Analysis** - How fast leads move through stages
3. **Dashboard customization** - User-configurable widgets
4. **Export to Excel** - All pages

### P3 - Low Priority
1. **Verify Per-Dimension Forecast Accuracy**
2. **Detailed Audit Logs**

## Key Technical Notes

### Financial Year Logic
- Indian FY: April 1 - March 31
- Quarterly: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
- Format: "FY2025-26" for yearly, "2025-26-Q1" for quarterly

### Hot/Warm/Cold Classification
- Based on `enquiry_type` field (not `enquiry_stage`)
- Hot, Warm, Cold values from lead data

### Transfer Exclusion
- All KPIs and insights queries include:
```javascript
"$or": [
  {"is_transferred": {"$exists": False}},
  {"is_transferred": False},
  {"is_transferred": None}
]
```

### MongoDB Considerations
- Always exclude `_id` from responses or convert to string
- Use `deleted_at: {"$exists": False}` for soft-deleted leads
- Use `is_duplicate: False` filter where applicable

## Credentials for Testing
- Username: `admin`
- Password: `admin123`

## Known Issues
- Frontend build folder may disappear - fix: `yarn build && sudo supervisorctl restart frontend`
