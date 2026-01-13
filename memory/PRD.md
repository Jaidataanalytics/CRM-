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

## Completed Work

### Session 6 - Jan 13, 2026 (COMPLETED)
1. ✅ **"Old Enquiries Closed" KPI**:
   - New KPI card on Dashboard showing leads won in selected date range but with `enquiry_date` from before the range
   - Displays both Qty and Lead count (e.g., "78 Qty (75 Leads)")
   - Helps track sales closing from older pipeline leads
   - Backend: `/api/kpis` now returns `old_enquiries_closed` and `old_enquiries_closed_qty`
   - Frontend: New KPI card with History icon in purple color

2. ✅ **Phone-Based Duplicate Detection & Merge for Enquiry Upload**:
   - Updated `/api/upload/leads` endpoint to use phone number as PRIMARY identifier
   - Uses `DuplicateDetector.merge_leads()` for intelligent data merging
   - Merge rules: empty fields filled from incoming data, text fields concatenated, lists combined
   - Preserves original `enquiry_no`, stores duplicates in `duplicate_enquiry_nos` array
   - Auto-calculates `is_qualified` status on merge
   - Fallback to `enquiry_no` matching if phone doesn't match

3. ✅ **Lost Leads Upload with Merge Logic**:
   - Updated `/api/upload/lost-leads` to use the same phone-based merge pattern
   - Merges data from incoming records before updating to Lost status
   - Tracks merged fields for reporting
   - Calculates `is_qualified` status for new and merged leads

4. ✅ **Upload Merge Summary Modal (Enhancement)**:
   - New modal showing detailed merge summary after uploads
   - Displays: Row, Name, Phone, Match By (phone/enquiry_no), Fields Merged
   - Shows created vs merged counts
   - Works for both Enquiry and Lost Leads uploads
   - Provides visibility into data consolidation during uploads

5. ✅ **Closure Analysis - Competitor & Lost Reason Charts**:
   - Fixed TypeError in closure analysis endpoint
   - Added new competitor_analysis and lost_reason_analysis to API response
   - Frontend: Pie charts for "Lost to Competitors" and "Lost Reasons"
   - Summary cards show: Total Lost, With Lost Data (16.1%), Closure Answers, Pending, Completion Rate
   - Data from uploads: Kirloskar (66), Eicher (37), Pricing (94), Brand Image (45), etc.

6. ✅ **Data Management Page with Merge History Tab**:
   - Renamed "Duplicate Leads" page to "Data Management"
   - Added tabs: "Duplicate Leads (2560)" and "Merge History (1474)"
   - Merge History shows consolidated leads from multiple uploads
   - Summary: 1,474 consolidated leads, 2,659 alt. enquiry numbers, 2.8 avg sources per lead
   - Table shows: Enquiry No, Name, Phone, Stage, Alternative Enquiry Nos, Sources count
   - Backend: New `/api/leads/merge-history` and `/api/leads/merge-history/summary` endpoints

7. ✅ **Dispatch Page Verified**: Showing SO data correctly (570 Total Won, 2 Pending, 536 Dispatched)

8. ✅ **File Upload Testing**: Successfully tested with real data files:
   - Enquiry Dump: 4785 rows → 1463 created, 3322 merged
   - Lost Dump: 698 rows → 23 updated to Lost, 654 already Lost, 21 Won preserved

9. ✅ All features tested and verified

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
- **Map Quotation data to dedicated page (P1)**: Create or enhance Quotation tracking page with data from SO uploads
- **Verify and enhance per-dimension analytics (P1)**: Ensure all analytics pages work with new data model

## Future/Backlog Tasks
- Manual 'Qualified' Toggle (P2)
- Detailed audit logs (P2)
- Refactor Forecast.js into smaller components (P2)
- Refactor `upload.py` and `Leads.js` (growing too large)

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
