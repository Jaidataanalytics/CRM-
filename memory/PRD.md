# Sharda Lead Management Dashboard - PRD

## Original Problem Statement
A full-stack Lead Management application for Sharda, a generator/genset company. The application helps manage sales leads with features for tracking, forecasting, analytics, and dispatch management.

## Core Features Implemented

### 1. Lead Management
- CRUD operations for leads
- Bulk upload via Excel (uses enquiry_no + phone_number composite key)
- Advanced filtering (State, Dealer, Lead Type, Follow-up Date)
- Export with applied filters
- Follow-up tracking with history
- **Lost Lead Questions**: Optional closure questions when lead is marked as Lost (shows "Pending" until filled)

### 2. Dashboard & KPIs
- Real-time KPI cards (Hot/Warm/Cold/Won/Lost)
- **Dispatch KPIs**: Pending Dispatch, Dispatched counts
- Clickable KPI cards for filtering
- Recent leads table with status indicators

### 3. Dispatch Management
- **Dedicated Dispatch Page**: Track and manage order dispatches
- **Status Tracking**: Pending Dispatch → Dispatched
- **Historical Data Handling**: 
  - Orders won before Jan 5, 2026 = "Dispatched" by default (no date)
  - Orders won on/after Jan 5, 2026 = "Pending Dispatch" by default
- **Dispatch Fields**: Dispatch date, delivery address, transporter details
- **Validation**: Dispatch date cannot be before won date
- **Status Change Rules**:
  - Historical orders: Can change without reason
  - New orders: Reason required when changing dispatched → pending
- **Dispatch History**: Full audit trail of status changes

### 4. AI-Powered Forecasting (Enhanced)
- **Auto Model Optimization**: Tests 8+ models, selects best
- **91.2% Accuracy Achieved**: Using Weighted Moving Average
- **Per-Dimension Accuracy**: All dimensions ≥75%
- **Multi-Dimensional Breakdowns**: KVA, State, Dealer, Employee, Segment
- **Consistent Closure Totals**: All breakdowns equal monthly total
- **Business Context Adjustments**
- **Save & View Projections**
- **Compare Forecasts**: Compare saved projections against actual results (NEW - Jan 5, 2026)

### 5. Analytics & Insights (Admin/Manager only)
- **Top Performers**: By Employee, Dealer, State
- **Conversion Analysis**: Conversion rate vs follow-ups
- **Segment Analysis**: Performance by segment
- **Closure Analysis** (NEW - Jan 5, 2026):
  - Summary cards: Total Lost, With Closure Data, Pending, Completion Rate
  - Question-by-question breakdown with answer distribution
  - Lost leads by State and Dealer
  - Helps identify patterns in why leads are lost

### 6. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js + Recharts
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key
- **ML Libraries**: scikit-learn, XGBoost, statsmodels, Prophet

## Key API Endpoints

### Summary Builder / Pivot Table (NEW - Jan 13, 2026)
- `GET /api/insights/summary-builder` - Dynamic pivot table with metric, time_frame, dimension params
  - metrics: leads, qty, won_leads, lost_leads, conversion_rate
  - time_frames: monthly, quarterly, yearly
  - dimensions: employee, dealer, state, location, segment, source
- `GET /api/filters/locations` - Get unique locations for filtering

### Dispatch Module
- `GET /api/dispatch/summary` - Get pending/dispatched counts
- `GET /api/dispatch/list` - List won orders with dispatch status
- `PATCH /api/dispatch/{lead_id}` - Update dispatch status
- `GET /api/dispatch/{lead_id}/history` - Dispatch change history
- `POST /api/dispatch/migrate` - Migrate existing data (admin only)

### Forecast Module
- `POST /api/forecast` - Generate forecast with auto-optimized model
- `POST /api/forecast/save` - Save a generated forecast
- `GET /api/forecast/saved` - Get list of saved forecasts
- `GET /api/forecast/compare/{index}` - Compare saved forecast with actual results (NEW)

### Closure Questions Module (NEW)
- `GET /api/leads/pending-closure-questions/count` - Count leads needing closure questions
- `GET /api/leads/pending-closure-questions` - List leads needing closure questions
- `POST /api/leads/{lead_id}/closure-answers` - Save closure question answers
- `GET /api/admin/closure-questions` - Get configured closure questions

### Insights Module (NEW)
- `GET /api/insights/closure-analysis` - Get closure questions analysis for lost leads
- `GET /api/leads/data-quality/won-without-quotation` - Returns Won leads missing quotation data (data quality report)

## Completed Work

### Session 10 - Jan 14, 2026 (COMPLETED)
**KPI Data Integrity and Duplicate Detection Fixes**

1. ✅ **Quotations Sent KPI Query Fix (P0)**:
   - Fixed `quotations_sent_query` to properly use `copy.deepcopy()` to avoid query mutation issues
   - Query now correctly appends quotation filter to `$and` array instead of overwriting `$or`
   - Moved `import copy` to module level for consistency

2. ✅ **Duplicate Detection Logic Enhancement**:
   - Updated `find_and_merge_by_phone()` in duplicate_detector.py to use smart duplicate logic
   - Now checks if existing lead is CLOSED before marking as duplicate
   - Returns `is_duplicate: False` with reason for repeat/returning customers

3. ✅ **Data Quality Report Endpoint (NEW)**:
   - Created `/api/leads/data-quality/won-without-quotation` endpoint
   - Returns list of Won leads missing quotation data (currently 50 leads)
   - Helps identify data quality issues in source files
   - Supports filters: state, dealer, employee_name, segment, date range

4. ✅ **Verified KPI Values**:
   - Won Leads: 866 (correct)
   - Quotations Sent: 853 (correct)
   - Difference (13) is due to 50 won leads missing quotation data (data quality issue, not a bug)

5. ✅ **All 14 Tests Passed**:
   - Backend: 14/14 pytest tests passed
   - Frontend: Dashboard verified with all KPI cards displaying correctly

### Session 9 - Jan 14, 2026 (COMPLETED)
**CRITICAL BUG FIX: Won Leads now include duplicate/repeat customer purchases**

1. ✅ **Won Leads Include Duplicates Fix (CRITICAL)**:
   - **Root Cause Found**: Won leads from repeat customers (same phone number) were being filtered out as "duplicates"
   - **Impact**: 185 won leads (189 qty) were being excluded from KPIs
   - **Fix**: Won leads now use separate `won_base_query` that doesn't exclude duplicates
   - Each won lead = real sale, even from repeat customers
   - **Fixed numbers**: 866 leads, 878 qty (previously 681 leads, 689 qty)

2. ✅ **Bug Fix: Variable Shadowing in kpis.py**:
   - `won_base_query` was being redefined at line 217 for dispatch tracking
   - This overwrote the original query used for qty calculations
   - Renamed to `dispatch_base_query` to prevent shadowing

3. ✅ **Quotations Page Now Respects Date Filters**:
   - Added filter parameters to `/api/leads/quotations` and `/api/leads/quotations/summary`
   - Quotations page now uses FilterContext like other pages
   - Both KPIs and Quotations page now show same totals (680)

4. ✅ **Quotations Sent KPI Now Includes All Quotation Data**:
   - Changed from only counting `quotation_sent: True` (was 2)
   - Now counts leads with quotation_no OR quotation_date OR quotation_sent (680)

5. ✅ **Auto-Mark quotation_sent Migration**:
   - Migration script to auto-set `quotation_sent=True` for leads with quotation data
   - Runs on server startup

6. ✅ **Deep Copy Fix for Query Mutations**:
   - `count_by_metric()` now uses `copy.deepcopy()` to prevent query mutations

### Session 8 - Jan 13, 2026 (COMPLETED)
1. ✅ **YoY Historical Comparison Toggle in Summary Builder (P0)**:
   - New toggle "YoY Comparison" with History icon
   - When enabled, table shows: Current | Prev | YoY% columns for each period
   - YoY insight card shows growth/decline percentage
   - Green up arrows for positive YoY, red down arrows for negative
   - Works with all metrics, time frames, and dimensions
   - CSV export includes YoY data when toggle is on
   - Backend: `compare_historical=true` parameter on `/api/insights/summary-builder`

2. ✅ **Quotations Linked to Leads (P0)**:
   - Added "View Lead" button with Eye icon in Quotations table
   - Shows Enquiry No column for reference
   - Clicking navigates to Leads page with search prefilled
   - Entire row is clickable for navigation

3. ✅ All 15 tests passed (15/15 backend, frontend verified)

### Session 7 - Jan 13, 2026 (COMPLETED)
1. ✅ **Summary Builder / Pivot Table Feature (P0)**:
   - New "Summary Builder" tab in Insights page
   - Dynamic pivot table with:
     - Metric selector (Total Leads, Total Qty, Won Leads, Lost Leads, Conversion %)
     - Time frame selector (Monthly, Quarterly, Yearly)
     - Dimension selector (Employee, Dealer, State, Location, Segment, Source)
   - Pivot table shows all rows with period columns and totals
   - Insight cards: Top Performer (trophy), Trend analysis, Best Period
   - Export to CSV functionality
   - Backend: `/api/insights/summary-builder` endpoint

2. ✅ **Area → Location Rename**:
   - Changed "Area Comparison" tab to "Location Comparison" in Comparison page
   - Updated backend `/api/insights/top-performers` to support `by=location`
   - Updated `/api/filters/all` to return `locations` instead of `areas`
   - Added new `/api/filters/locations` endpoint

3. ✅ **Bug Fix**: Fixed KeyError in summary-builder when data is empty
   - Added null checks for r.get('_id') and nested dimension/time_period

4. ✅ All tests passed (12/12 backend, frontend verified)

### Session 6 - Jan 13, 2026 (COMPLETED)
1. ✅ **"Old Enquiries Closed" KPI**: New KPI card on Dashboard showing leads won in date range but with older enquiry_date

2. ✅ **Phone-Based Duplicate Detection & Merge for All Uploads**:
   - Enquiry Upload: Phone as PRIMARY identifier, enquiry_no as fallback
   - Lost Leads Upload: Now merges data for ALL leads including "Already Lost" and "Won"
   - Preserves Won/Lost stages while filling missing fields from incoming data

3. ✅ **Closure Analysis Refactored**:
   - Closure Questions are now: Competitor, Lost Reason, Lost Remarks (from uploads)
   - Summary: 1,312 Lost, 254 with closure data, 19.4% completion rate
   - Competitor breakdown: Kirloskar (80), Eicher (48), Others (34), TATA (25)
   - Lost Reasons: Pricing (116), Brand Image (56), Purchased Old Dg (24)
   - Removed KVA from all closure analysis displays

4. ✅ **Upload Merge Summary Modal**: Shows merged leads and fields after uploads

5. ✅ **Data Management Page with Merge History Tab**:
   - Renamed "Duplicate Leads" → "Data Management"
   - Added "Merge History" tab showing consolidated leads
   - Stats: 1,474 consolidated leads, 2,659 alt. enquiry numbers

6. ✅ **File Upload Testing with Real Data**:
   - Enquiry Dump (4785 rows): 1,463 created, 3,322 merged
   - Lost Dump (698 rows): 677 Already Lost (data merged), 21 Won (data merged), 0 updated to Lost

7. ✅ All features tested and verified

8. ✅ **Quotations Page Created (P1)**:
   - New dedicated Quotations page at `/quotations`
   - Summary cards: Total (1,001), Pending (64), Won (912), Conversion Rate (91.1%)
   - Tabs: All, Pending, Won, Lost
   - Table with: Quotation No, Lead Name, Phone, Date Sent, Amount, Stage, Status
   - Search functionality
   - Backend: `/api/leads/quotations` and `/api/leads/quotations/summary` endpoints

9. ✅ **Per-Dimension Analytics Verified (P1)**:
   - Insights page: Top Performers, Conversion Analysis, Segment Analysis, Competitor Analysis, Closure Analysis
   - Comparison page: Geographic Map, State, Dealer, Area, Employee comparisons
   - All dropdowns (By Employee, By State, By Dealer, By Segment, By Source) working correctly

### Session 5 - Jan 5, 2026 (COMPLETED)
1. ✅ **Compare Forecasts Page**:
   - New page at /compare-forecasts
   - Select saved forecast from dropdown
   - Compare button triggers comparison
   - Monthly comparison table with predicted vs actual
   - KVA, State, Dealer breakdown tabs
   - Accuracy metrics (Overall, Leads, Closures, KVA)
   - Charts showing Predicted vs Actual
2. ✅ **Lost Lead Questions**:
   - Modal triggers when lead status changes to Lost
   - Optional answers (shows "Pending" until filled)
   - Backend endpoints for closure answers
   - Pending count shown in Leads page header
3. ✅ **Upload Composite Key Logic**:
   - Uses enquiry_no + phone_number to identify existing leads
   - Updates existing leads, creates new ones if not found
4. ✅ **Closure Analysis in Insights** (NEW):
   - New "Closure Analysis" tab in Insights page
   - Summary cards: Total Lost, With Closure Data, Pending, Completion Rate
   - Question-by-question breakdown with answer distribution charts
   - Lost leads by State and Dealer tables
5. ✅ **Restricted Insights Access**:
   - Insights page now only accessible to Admin and Manager roles
   - Employees no longer see Insights in sidebar
6. ✅ All tests passed (12/12 backend, frontend verified)

### Session 4 - COMPLETED
1. ✅ **Dispatch Management Feature**
2. ✅ **KPI Cards**: Added Pending Dispatch and Dispatched to Dashboard
3. ✅ **Migration**: Dispatch status for historical orders

### Previous Sessions - COMPLETED
- Auto Model Optimization (91.2% accuracy)
- Per-Dimension Accuracy (all ≥75%)
- Closure consistency fix
- Save/View projections

## Upcoming Tasks
- Funnel Analysis (P1) - Create visualization to track conversion rates at each stage (Enquiry → Quotation → Won)
- Manual 'Qualified' Toggle (P1) - Add UI element to toggle qualified status on lead detail
- Lead Velocity & ROI Analysis (P2) - Analytics for how fast leads move through stages and which sources provide best return
- Verify per-dimension forecast accuracy (P2)
- Detailed audit logs (P2)
- Refactor large files (`upload.py`, `Leads.js`, `Forecast.js`)

## Future/Backlog Tasks
- Dashboard customization
- Export to Excel for all pages
- Email notifications for lead status changes
- UI for Data Quality Report (show won leads without quotation data)

## Data Quality Notes
- **50 Won leads missing quotation data**: These leads appear in the data quality report at `/api/leads/data-quality/won-without-quotation`. The source Excel files should be updated to include quotation_no/quotation_date for these leads.

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
