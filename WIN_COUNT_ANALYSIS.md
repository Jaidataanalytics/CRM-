# Win Count Discrepancy Analysis

## Summary of Findings

There are **3 major differences** in how "Win Count" is calculated across the KPI Page, Dispatch Page, and Comparison Page:

---

## 1. KPI Page Win Count (`/api/kpis`)

**Query Logic (kpis.py lines 109-150, 226-230):**

```python
won_base_query = {
    "is_deleted": {"$ne": True},
    "has_so_record": True,                    # ⚠️ REQUIRES has_so_record=True
    "$and": [
        {"$or": [
            {"is_transferred": {"$exists": False}},
            {"is_transferred": False},
            {"is_transferred": None}
        ]}                                     # ⚠️ EXCLUDES transferred leads
    ],
    "enquiry_date": {"$gte": start_date, "$lte": end_date}  # Uses enquiry_date
}

# THEN applies metric_settings config if exists:
if won_config and won_config.get("field_name"):
    won_metric_query[won_config["field_name"]] = {"$in": won_config["field_values"]}
won_metric_query["deleted_at"] = {"$exists": False}
```

**Filters Applied:**
- ✅ `has_so_record: True` (only verified SO leads)
- ✅ `is_transferred != True` (excludes transferred)
- ✅ `is_deleted != True`
- ✅ `deleted_at` doesn't exist
- ✅ `enquiry_date` within range
- ✅ metric_settings config (if defined)

---

## 2. Dispatch Page Win Count (`/api/dispatch/summary`)

**Query Logic (dispatch.py lines 49-79):**

```python
base_query = {
    "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},  # ⚠️ Uses enquiry_stage
    "deleted_at": {"$exists": False},
    "eo_po_date": {"$gte": start_date, "$lte": end_date}       # ⚠️ Uses eo_po_date NOT enquiry_date
}
```

**Filters Applied:**
- ✅ `enquiry_stage` in ["Closed-Won", "Order Booked"]
- ✅ `deleted_at` doesn't exist
- ✅ `eo_po_date` within range (PO/order date)
- ❌ NO `has_so_record` filter
- ❌ NO `is_transferred` filter
- ❌ NO `is_deleted` filter
- ❌ NO metric_settings config

---

## 3. Comparison Page Win Count (`/api/market-potential/comparison`)

**Query Logic (market_potential.py lines 429-440):**

```python
base_query = {
    "deleted_at": {"$exists": False},
    "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},  # Uses enquiry_stage
    "has_so_record": True,                                      # ⚠️ REQUIRES has_so_record=True
    "enquiry_date": {"$gte": start_date, "$lte": end_date}      # Uses enquiry_date
}
```

**Filters Applied:**
- ✅ `enquiry_stage` in ["Closed-Won", "Order Booked"]
- ✅ `has_so_record: True`
- ✅ `deleted_at` doesn't exist
- ✅ `enquiry_date` within range
- ❌ NO `is_transferred` filter
- ❌ NO `is_deleted` filter
- ❌ NO metric_settings config

---

## Key Differences Table

| Filter/Criteria | KPI Page | Dispatch Page | Comparison Page |
|----------------|----------|---------------|-----------------|
| **Date Field** | `enquiry_date` | `eo_po_date` ⚠️ | `enquiry_date` |
| **has_so_record: True** | ✅ Yes | ❌ No | ✅ Yes |
| **Excludes is_transferred** | ✅ Yes | ❌ No | ❌ No |
| **Excludes is_deleted** | ✅ Yes | ❌ No | ❌ No |
| **Uses metric_settings** | ✅ Yes | ❌ No | ❌ No |
| **enquiry_stage filter** | Via metric_settings | Direct | Direct |

---

## Root Causes of Discrepancy

### Cause 1: Different Date Fields
- **KPI & Comparison** use `enquiry_date` (when lead was created/enquired)
- **Dispatch** uses `eo_po_date` (when order was placed/won)
- A lead enquired in January but won in March will appear in different date ranges

### Cause 2: has_so_record Filter
- **KPI & Comparison** require `has_so_record: True` (verified SO leads only)
- **Dispatch** counts ALL leads with "Closed-Won" or "Order Booked" stage
- Leads without SO verification are counted in Dispatch but not in KPI

### Cause 3: is_transferred Exclusion
- **KPI** excludes transferred leads (to avoid double-counting)
- **Dispatch & Comparison** include transferred leads
- Transferred leads inflate Dispatch & Comparison counts

### Cause 4: metric_settings Config
- **KPI** uses configurable metric_settings for won_leads definition
- Other pages use hardcoded `enquiry_stage` values
- If metric_settings defines different criteria, counts will differ

---

## Recommended Fixes

### Option A: Standardize All Queries (Recommended)
Make all three pages use identical query logic:

```python
STANDARD_WON_QUERY = {
    "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
    "has_so_record": True,
    "deleted_at": {"$exists": False},
    "is_deleted": {"$ne": True},
    "$or": [
        {"is_transferred": {"$exists": False}},
        {"is_transferred": False},
        {"is_transferred": None}
    ]
}
```

### Option B: Fix Dispatch Page Date Field
Change dispatch.py to use `enquiry_date` instead of `eo_po_date`:

```python
# Line 64 in dispatch.py - change from:
base_query["eo_po_date"] = {"$gte": start_date, "$lte": end_date}

# To:
base_query["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
```

### Option C: Add Missing Filters to Dispatch & Comparison

**dispatch.py:**
```python
base_query = {
    "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
    "deleted_at": {"$exists": False},
    "has_so_record": True,  # ADD THIS
    "is_deleted": {"$ne": True},  # ADD THIS
    "$or": [  # ADD THIS
        {"is_transferred": {"$exists": False}},
        {"is_transferred": False}
    ]
}
```

**market_potential.py:**
```python
base_query = {
    "deleted_at": {"$exists": False},
    "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
    "has_so_record": True,
    "is_deleted": {"$ne": True},  # ADD THIS
    "$or": [  # ADD THIS
        {"is_transferred": {"$exists": False}},
        {"is_transferred": False}
    ]
}
```

---

## Files to Modify

1. `/app/backend/routes/dispatch.py` - Lines 49-64
2. `/app/backend/routes/market_potential.py` - Lines 429-441
3. Optionally: Create shared utility function for consistent won query
