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
        │   ├── Comparison.js     # Market potential analysis + Checkbox filtering
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

## What's Been Implemented

### Checkbox Filtering on Comparison Page (Feb 11, 2026) - NEW
- [x] **Filter Button**: Shows "X of Y selected" count next to Compare by dropdown
- [x] **Selection Popover**: Clickable popover with checkboxes for each item (district, dealer, source, etc.)
- [x] **All/None Buttons**: Quick select all or deselect all items
- [x] **Item Sales Count**: Each item shows its current sales count in the popover
- [x] **Dynamic Filtering**: Chart, summary totals, and table all update based on selection
- [x] **Table Checkboxes**: Inline checkboxes in each table row + select-all in header
- [x] **Dimmed Rows**: Unchecked rows appear at 40% opacity
- [x] **Auto-Select on Switch**: Changing Compare by auto-selects all items in new dimension
- [x] **Summary Indicator**: Shows "(X of Y selected)" in summary title when filtering active
- [x] **Tested**: 18/18 tests passed via testing agent

### Mobile & Tablet Responsive Design (Feb 11, 2026) - NEW
- [x] **Responsive Sidebar**: Desktop sidebar hidden below 1024px, replaced with hamburger menu + Sheet drawer
- [x] **Hamburger Menu**: Visible on mobile/tablet, opens full navigation drawer from left side
- [x] **Auto-Close on Navigate**: Mobile sidebar closes automatically when user clicks a nav link
- [x] **Responsive Grids**: Dashboard KPIs (2-col mobile, 4-col desktop), FilterBar (1-col mobile, 6-col desktop)
- [x] **Compact Filter Bar**: Smaller date buttons, compact spacing on mobile
- [x] **Scrollable Tables**: Comparison table horizontally scrollable on mobile
- [x] **Responsive Headers**: Page headers stack vertically on mobile, horizontal on desktop
- [x] **Responsive Padding**: Content area uses smaller padding on mobile (p-3 vs p-6)
- [x] **SidebarContext**: Shared state between Header (hamburger button) and Sidebar (drawer)
- [x] **Tested**: 17/17 tests passed via testing agent across 390px, 768px, and 1920px viewports

### Source and Segment Market Potential (Feb 7, 2026)
- [x] Added source/segment comparison endpoints and management UI
- [x] Extended comparison to support compare_by=source and compare_by=segment

### Admin Page Bug Fixes & Data Maintenance Tools (Feb 11, 2026)
- [x] Fixed Activity Logs, User Management, Recent Uploads
- [x] Added Data Maintenance section with date format fix tool
- [x] Changed demo credentials to admin/admin

### Bug Fixes (Feb 2026)
- [x] Fixed Conversion Rate % formula (Won / Total Leads)
- [x] Fixed Open Enquiry metric in Summary Builder
- [x] Fixed lead export to respect all active filters
- [x] Removed "Made by Emergent" tag
- [x] Fixed data corruption from uploads (date parsing)
- [x] Backend startup optimizations for 520 error

### Previous Features (summarized)
- Unified File Upload System, Dual-Tender System (MLT/DG)
- Win Count Standardization, Entity Profile Enhancements
- Searchable Dropdowns, Lead Age Analysis Fix, Excel Export
- Transfer to Dealer Feature, Forecasting (AI-powered)
- Targets Management System, Manual Duplicate Detection

## Prioritized Backlog

### P0 - Critical
- **520 Deployment Error**: USER VERIFICATION PENDING (startup optimizations applied)

### P1 - High Priority
1. **Analytics Discrepancy**: Summary Builder vs Entity Page show different totals - NOT STARTED
2. **Refactor Tenders.js** - 1900+ lines, needs component extraction
3. **Refactor Leads.js** - 3000+ lines, needs component extraction
4. **Refactor Admin.js** - 2000+ lines, needs component extraction

### P2 - Medium Priority
1. Funnel Analysis visualization
2. Manual 'Qualified' Toggle on lead detail view
3. Financial Year Standardization audit
4. Lead Velocity & ROI Analysis
5. Dashboard customization (user-configurable widgets)

### P3 - Low Priority
1. Detailed Audit Logs
2. Verify Per-Dimension Forecast Accuracy

## Key Technical Notes

### Financial Year Logic
- Indian FY: April 1 - March 31
- Quarterly: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar

### Credentials for Testing
- Admin: `admin` / `admin`

### MongoDB Considerations
- Always exclude `_id` from responses or convert to string
- Use `deleted_at: {"$exists": False}` for soft-deleted leads

---
*Last Updated: Feb 11, 2026*
*Latest Feature: Checkbox Filtering on Comparison Page*
