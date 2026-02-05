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
│   │   ├── entity_profile.py    # Enhanced entity analytics
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
        │   ├── EntityProfile.js  # Enhanced entity profiles
        │   └── CompareForecasts.js # Saved forecast details view
        ├── context/
        │   └── FilterContext.js  # Global filters including maxLeadAge
        └── components/
            └── filters/
                └── FilterBar.js  # Filter bar with lead age slider (searchable)
```

## What's Been Implemented (as of Jan 2026)

### Unified File Upload System - NEW (Jan 29, 2026)
- [x] **Single Upload Button** - Replaced 4 separate upload buttons with one "Upload File" button
- [x] **Auto-Template Detection** - Automatically detects template type (LEAD, LOST, SO, REMARK) based on column names
- [x] **Download Template Modal** - Single button opens modal with 4 template options, each with sample data
- [x] **New Backend Logic** (`/app/backend/routes/upload_v2.py`):
  - **Lead Upload**: Match by enquiry_no → Update fields. If no match, check phone+KVA: CLOSED = new lead, OPEN + same KVA = merge, different KVA = new lead
  - **Lost Upload**: Match by enquiry_no → Check status. OPEN = close as lost, WON = skip, already LOST = keep. Phone match: OPEN + same KVA = merge & close, different KVA = new lost lead
  - **SO Upload**: Match by enquiry_no → OPEN = close as won, WON no SO = add SO info, different SO = new lead. Phone match: same KVA = close as won, different = new lead
  - **Remark Upload**: Match by enquiry_no only → Update follow-up info, add to followup_history
- [x] **Column Mappings**: Win Reason → competitor, Win Remarks → lost_reason, Lost Remarks → lost_remarks
- [x] **Duplicate Handling**: Skip duplicate rows in same file, keep one with more data/recent date
- [x] **KVA Comparison**: Exact match only, blank = different (don't merge)
- [x] **File Overwrites**: Incoming values overwrite existing (if not empty), empty values don't overwrite

### Dual-Tender System (MLT vs DG) - NEW (Jan 29, 2026)
- [x] **MLT/DG Toggle** - UI toggle to switch between MLT and DG tender types
- [x] **Two-Step Tender Creation** - Step 1: Upload PDF for extraction, Step 2: Review and confirm data
- [x] **PDF Upload Fixed** (Jan 30, 2026) - Updated emergentintegrations API usage from deprecated `FileContent` to `FileContentWithMimeType` with `gemini-2.5-flash` model
- [x] **DG-Specific Fields** - Added 12 new fields for DG tenders:
  - `address`, `state_name`, `output_capacity_rating`, `control_panel`, `installation`
  - `is_eligible`, `eligibility_reason`, `l1_price`, `mm_price`, `winning_brand`
  - `participation_by_mm`, `win_by`, `remark`
- [x] **Last Updated Tracking** - `updated_at` and `updated_by` stored and displayed
- [x] **Conditional Table Columns** - Different columns for MLT vs DG:
  - MLT: Bid Number, Department, End Date, Est. Value, Our Bid, Status, Winner, Last Updated
  - DG: Bid Number, Department, State, KVA Rating, Qty, Eligible, Status, Winner Brand, Last Updated
- [x] **Conditional Detail Sheet** - Shows DG-specific fields in Details and Result tabs
- [x] **TenderUser Role** - Restricted user role with access only to Tenders page

### Win Count Standardization (NEW - Jan 21, 2026)
- [x] Standardized all won queries across KPI, Dispatch, Comparison pages
- [x] All pages now use `["Closed-Won", "Order Booked"]` for won stages
- [x] Added `has_so_record`, `is_transferred`, `is_deleted` filters consistently
- [x] Changed dispatch.py from `eo_po_date` to `enquiry_date` for consistency
- [x] Created `/app/WIN_COUNT_ANALYSIS.md` documenting the differences

### Quotation Removal (NEW - Jan 21, 2026)
- [x] Removed Quotation page from navigation and routes
- [x] Removed Quotations Sent and Call to Quotation Rate KPI cards from Dashboard
- [x] Removed from Charts.js metric options
- [x] Removed from insights.py metric enum

### Entity Profile Enhancements (NEW - Jan 21, 2026)
- [x] Created `/api/entity/enhanced-analytics/{entity_type}/{entity_id}` endpoint
- [x] Mini Summary Builder (monthly/quarterly/yearly with FY logic)
- [x] Market Share calculations (company, state, district, dealer)
- [x] KVA breakdown with individual values
- [x] YoY comparison with percentage changes
- [x] Rank/Position among peers
- [x] Pipeline health (Hot/Warm/Cold distribution)
- [x] Lead age distribution (0-30, 31-60, 61-90, 90+ days)
- [x] Top segments performance
- [x] Dimension breakdown (segment, employee, dealer, source, kva, district)
- [x] Updated EntityProfile.js frontend with all new sections

### Searchable Dropdowns (Jan 21, 2026)
- [x] Created reusable `SearchableSelect` component at `/app/frontend/src/components/ui/searchable-select.jsx`
- [x] Implemented in FilterBar.js - State, Dealer, Employee, Segment dropdowns now searchable
- [x] Implemented in Leads.js - Dealer and Employee fields in edit form and transfer modal

### Lead Age Analysis Fix (NEW - Jan 21, 2026)
- [x] Fixed dynamic calculation of `lead_age` in `/app/backend/routes/insights.py`
- [x] Lead age now calculated in real-time using MongoDB's `$dateDiff` instead of relying on a stored field
- [x] Age buckets (0-30d, 31-60d, 61-90d, 90+d) working correctly

### Excel Export to All Pages (NEW - Jan 21, 2026)
- [x] Created reusable `ExportButton` component at `/app/frontend/src/components/ui/export-button.jsx`
- [x] Created export utility functions at `/app/frontend/src/utils/exportUtils.js`
- [x] Added `xlsx`, `file-saver`, and `html2canvas` dependencies for Excel and image export
- [x] **Dashboard**: Added "Export KPIs" button - exports KPI summary to Excel
- [x] **Dispatch**: Added "Export to Excel" button - exports dispatch orders
- [x] **Transferred Leads**: Added "Export to Excel" button - exports transferred leads data
- [x] **Comparison**: Added "Export Data" button - exports market comparison data
- [x] **Data Management**: Added "Export Duplicates" button - exports duplicate leads
- [x] **Forecast**: Added conditional "Export Forecast" button (appears after generation)
- [x] **Entity Profile**: Added "Export" button with data and chart export options
- [x] **Manage Leads**: Already had Excel export (verified working)
- [x] **Insights Summary Builder**: Already had Excel export (verified working)

### Bug Fixes (Jan 21, 2026)
- [x] **Insights page zero data** - Fixed syntax error in `insights.py` (double curly brace `{{` → `{`)
- [x] **Admin page error** - Removed orphan `loadLogs` useEffect, fixed UserManagement to handle array response, removed redundant users API call from loadData
- [x] **Comparison win count discrepancy** - Removed `has_so_record: True` filter from `market_potential.py` to match entity profile counts (140 vs 128 issue)
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

## Recent Bug Fixes (Feb 2026)

### UnboundLocalError Fix (Feb 5, 2026)
- [x] Fixed critical `UnboundLocalError` in `/app/backend/routes/forecast_enhanced.py`
- [x] Error: "cannot access local variable 'total_historical_leads' where it is not associated with a value"
- [x] **Root Cause**: Variables `total_historical_leads` and `total_historical_closures` were calculated inside a conditional `else:` block but used outside of it
- [x] **Fix**: Moved the variable calculations immediately after `monthly_data` is fetched, before any conditional branches
- [x] **Tested**: Backend endpoint `/api/forecast-enhanced/comprehensive-forecast` now returns valid forecasts

### Save Projection Feature (Feb 5, 2026)
- [x] Added "Save Projection" button to AI Forecast view (`AIForecastView.jsx`)
- [x] Saves all comprehensive forecast data including:
  - Organization-level forecasts (totals, chart_data, historical_summary)
  - Full dealer_forecasts array with by_kva and by_district breakdowns
  - Model metrics and selection details
  - Generation parameters (months_ahead, years_back, force_model)
  - View settings (tree/table mode, expanded dealers state)
  - User notes
- [x] Updated backend `/api/forecast-enhanced/save-enhanced` endpoint to handle new data structure
- [x] Backend tested successfully - projections saved with full data

### Month-wise Breakdown Feature (Feb 5, 2026)
- [x] Added Month Selector for summary cards (shows per-month leads/closures)
- [x] Implemented Nested Month Expansion in Tree View:
  - Dealer → Month → KVA/District hierarchy
  - Each month shows its own KVA and District breakdown
  - Combined totals section at dealer level
- [x] Updated Saved Projections view to display:
  - Notes (if any)
  - Organization-level totals with model info
  - Monthly forecast table
  - Dealer breakdown summary
- [x] Backend already returns month-wise data:
  - `dealer_forecasts[].months[]` with `by_kva` and `by_district` arrays per month
  - `organization_forecast.months[]` for summary card selection

## Prioritized Backlog

### P0 - Critical
None currently

### P1 - High Priority
1. **Refactor Tenders.js** - File has grown to 1900+ lines, needs component extraction
2. **Refactor Leads.js** - File is over 3000 lines, needs component extraction
3. **Funnel Analysis** - Conversion rates: Enquiry → Quotation → Won
4. **Manual 'Qualified' Toggle** - UI to set lead's `is_qualified` status
5. **Financial Year Standardization** - Full audit of all YoY calculations to use Indian FY (Apr 1 - Mar 31)

### P2 - Medium Priority
1. **Continue Refactor** - Admin.js (3154 lines) still needs component extraction
2. **Lead Velocity & ROI Analysis** - How fast leads move through stages
3. **Dashboard customization** - User-configurable widgets

## Export Components Structure
```
/app/frontend/src/
├── utils/
│   └── exportUtils.js          # Export utility functions (exportToExcel, exportChartAsImage, etc.)
└── components/
    └── ui/
        └── export-button.jsx   # Reusable ExportButton with Excel and image export options
```

## Refactored Components Structure
```
/app/frontend/src/components/
├── insights/           # 878 lines extracted
│   ├── SummaryBuilder.jsx (366 lines)
│   ├── TopPerformers.jsx (162 lines)
│   ├── TemperatureAnalysis.jsx (177 lines)
│   ├── LeadAgeAnalysis.jsx (169 lines)
│   └── index.js
├── admin/             # 420 lines extracted
│   ├── UserManagement.jsx (275 lines)
│   ├── ActivityLogs.jsx (143 lines)
│   └── index.js
└── leads/             # 238 lines extracted
    ├── LeadDetailPanel.jsx (238 lines)
    └── index.js
```

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
- Admin: `admin` / `admin123`
- TenderUser: `tender@example.com` / `password`

## Known Issues
- Frontend build folder may disappear - fix: `yarn build && sudo supervisorctl restart frontend`

## Tender System Data Model

### Tender Document Fields:
```javascript
{
  // Core Fields
  tender_type: "mlt" | "dg",
  bid_number: "GEM/2025/B/1234567",
  dated: "2025-01-29",
  bid_end_date: "2025-02-15 14:00:00",
  bid_opening_date: "2025-02-15 15:00:00",
  department_name: "Ministry of Health...",
  total_quantity: 100,
  status: "pending" | "participated" | "won" | "lost" | "not_participated" | "cancelled",
  
  // MLT-Specific Fields
  estimated_value: 1500000,
  our_bid_amount: 1400000,
  emd_amount: 50000,
  beneficiary: "...",
  consignees: [{name, address, quantity, delivery_days}],
  item_specifications: "...",
  delivery_period: 60,
  warranty_period: "2 years",
  payment_terms: "...",
  winner_name: "...",
  winner_amount: 1350000,
  
  // DG-Specific Fields
  address: "...",
  state_name: "Rajasthan",
  output_capacity_rating: "5 KVA / Single Phase",
  control_panel: "...",
  installation: "yes" | "no",
  is_eligible: true,
  eligibility_reason: "...",
  l1_price: 250000,
  mm_price: 280000,
  winning_brand: "Kirloskar",
  participation_by_mm: "yes" | "no",
  win_by: "Mahindra",
  remark: "...",
  
  // Metadata
  created_at: "2025-01-29T10:00:00Z",
  updated_at: "2025-01-29T12:00:00Z",
  created_by: "admin@example.com",
  updated_by: "admin@example.com",
  
  // Documents & Timeline
  documents: [{_id, name, type, url, uploaded_at, uploaded_by}],
  timeline: [{action, date, user, details}],
  competitors: [{name, bid_amount, rank}]
}
```

### DG Tender Import/Export - 25 Column GEM Tracker Template (Jan 31, 2026)
- [x] **Import Endpoint**: `POST /api/tenders/import-dg-tenders` - Imports from user's GEM Tracker Excel format
- [x] **Export Configuration**: Frontend ExportButton generates Excel matching GEM Tracker template
- [x] **25 Columns Supported**:
  1. S- No- (auto-generated)
  2. BID Ref- → bid_number
  3. BID Date/Entry Date → dated
  4. Due Date → bid_end_date
  5. Month → month
  6. Cat I'd → category_id
  7. Department Name /Segment → department_name
  8. Department Name/ Address → department_address
  9. State → state_name
  10. Region → region
  11. Rating → output_capacity_rating
  12. Panel → panel_type
  13. ITC Yes/No → itc_applicable (boolean)
  14. Eligibility Y/N → is_eligible (boolean)
  15. Reson for Not Eligibility → ineligibility_reason
  16. Bid Qty → total_quantity
  17. Participation by MM Yes / No → mm_participated (boolean)
  18. M&M Participated Firm Name → mm_firm_name
  19. Status → status
  20. Order Qty → order_quantity
  21. L1 Price (Rs-) → l1_price
  22. MM Price → mm_price
  23. Winning Brand → winning_brand
  24. Win By → win_by
  25. Remark → remark

### Lead Upload Fix - Underscore Column Names (Feb 2, 2026)
- [x] **Bug Fix**: Lead upload now correctly handles underscore-separated column names (e.g., `enquiry_no`, `enquiry_stage`, `phone_number`)
- [x] **Updated Mappings**: Added underscore variants to `LEAD_UPLOAD_MAPPING` for columns exported from the system
- [x] **Columns Fixed**: `enquiry_no`, `enquiry_date`, `customer_type`, `corporate_name`, `phone_number`, `email_address`, `enquiry_status`, `enquiry_type`, `enquiry_stage`, `eo_po_date`, `last_followup_date`, `enquiry_closure_date`, `source_from`, `no_of_followups`, `sub_segment`, `dg_ownership`, `created_by`, `finance_required`, `employee_code`, `employee_name`, `employee_status`

### Monthly Forecast Enhancement (Feb 4, 2026)
- [x] **New API**: `GET /api/forecast-enhanced/monthly-forecast` - Returns monthly breakdown instead of combined totals
- [x] **Current Month Prediction**: Set `include_current_month=true` to exclude current month's actual data and predict it
- [x] **Monthly Breakdown**: Shows dealer/KVA/district breakdown for EACH month separately
- [x] **New UI Tab**: "Monthly" tab added as first tab in Enhanced Forecast section
- [x] **Chart Data**: Monthly bar charts showing totals and dealer comparisons across months

### Forecast & Compare Pages Merged (Feb 4, 2026)
- [x] **Unified Interface**: Compare functionality now integrated into Forecast page as a "Compare" tab
- [x] **Tab Structure**: Forecast | Advanced | Compare | Saved | Backtest | Factors
- [x] **Sidebar Cleanup**: Removed separate "Compare Forecasts" link (redirects to /forecast)
- [x] **CompareTab Component**: New component at `/app/frontend/src/components/forecast/CompareTab.jsx`
- [x] **Features Preserved**: All comparison features (accuracy charts, monthly breakdown, insights) maintained

### Manual Duplicate Detection (Feb 4, 2026)
- [x] **Disabled Automatic Detection**: Removed duplicate detection from server startup
- [x] **Manual Trigger**: Added "Run Detection" button in Data Management > Duplicate Leads tab
- [x] **Written Confirmation**: Requires typing "RUN DUPLICATE DETECTION" to proceed
- [x] **Detailed Report**: Shows summary with leads scanned, duplicates found, merge count, duplicate rate
- [x] **API Endpoints**:
  - `POST /api/admin/run-duplicate-detection` - Trigger manual detection
  - `GET /api/admin/duplicate-detection-status` - Get last run status

### AI-Powered Comprehensive Forecast (Feb 4, 2026)
- [x] **Multi-Model AI Forecasting**: Tests multiple ML models (ARIMA, XGBoost, Random Forest, etc.) and auto-selects the best
- [x] **Model Performance Metrics**: Displays R², MAPE, MAE accuracy metrics for each tested model
- [x] **Auto-Selection with Override**: System auto-selects best model, users can manually override
- [x] **User-Configurable Training Data**: Default 3 years, user can select 1-5 years of historical data
- [x] **Multi-Level Forecasts**:
  - Organization-level totals (leads, closures)
  - Dealer-level breakdown by KVA and district
  - Full hierarchy: Org → Dealer → KVA / District
- [x] **Consistency Validation**: Uses proportional scaling to ensure dealer totals match org totals
- [x] **Dual View Modes**: 
  - Tree View: Collapsible hierarchy for drill-down
  - Table View: Filterable flat view with all dealers
- [x] **Model Selection Performance**:
  - Leads Model: Weighted Moving Average (88.2% accuracy)
  - Closures Model: Exponential Smoothing (96.1% accuracy)
- [x] **Frontend Components**:
  - `/app/frontend/src/components/forecast/AIForecastView.jsx` - New comprehensive AI forecast component
  - `/app/frontend/src/pages/Forecast.js` - Added "AI Forecast" as primary tab
- [x] **Backend Endpoint**:
  - `POST /api/forecast-enhanced/comprehensive-forecast`
  - Parameters: months_ahead, years_back, include_current_month, force_model
- [x] **Available Models**: Simple Moving Average, Weighted Moving Average, Exponential Smoothing, Seasonal (Same-Month), Linear Trend, ARIMA, Random Forest, Gradient Boosting, XGBoost, Ensemble (Hybrid)

---
*Last Updated: Feb 4, 2026*
*Latest Feature: AI-Powered Comprehensive Forecast with Multi-Model Selection*
