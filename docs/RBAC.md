# Role-Based Access Control (RBAC)

## Roles

- admin
- manager
- agent

---

# 🔐 PERMISSION MATRIX

## LEADS

| Action              | Admin | Manager | Agent |
|--------------------|------|--------|------|
| Create Lead        | ✅   | ❌     | ❌   |
| View All Leads     | ✅   | ❌     | ❌   |
| View Assigned      | ✅   | ✅     | ✅   |
| Update Lead        | ✅   | ✅     | ✅   |
| Delete Lead        | ✅   | ❌     | ❌   |
| Assign Lead        | ✅   | ✅     | ❌   |
| Convert to Contact | ❌   | ❌     | ✅   |

---

## CONTACTS

| Action           | Admin | Manager | Agent |
|-----------------|------|--------|------|
| Create Contact  | ❌   | ❌     | ✅ (via Lead only) |
| View Contacts   | ✅   | ✅     | ✅ (assigned only) |
| Update Contact  | ✅   | ✅     | ✅ (assigned only) |
| Delete Contact  | ✅   | ❌     | ❌   |

---

## DEALS

| Action        | Admin | Manager | Agent |
|--------------|------|--------|------|
| Create Deal  | ❌   | ❌     | ✅   |
| View Deals   | ✅   | ✅     | ✅ (assigned only) |
| Update Deal  | ✅   | ✅     | ✅ (assigned only) |
| Delete Deal  | ✅   | ❌     | ❌   |

---

## COMMISSIONS

| Action            | Admin | Manager | Agent |
|------------------|------|--------|------|
| View Commission  | ✅   | ✅     | ✅ (own only) |
| Generate         | ✅   | ❌     | ❌   |

---

# 🧠 OWNERSHIP RULES (CRITICAL)

## Lead Ownership

- Each lead MUST have:
  - assigned_to (agent OR manager)

### Rules:
- Admin → can access ALL leads
- Manager → can access:
  - leads assigned to them
  - leads assigned to their agents
- Agent → can access ONLY:
  - leads assigned to them

---

## Contact Ownership

- Created from Lead
- Inherits assigned agent

---

## Deal Ownership

- Assigned to agent only

---

# 🚫 RESTRICTIONS

- Agent CANNOT:
  - Assign leads
  - View all leads
  - Delete anything

- Manager CANNOT:
  - Delete leads
  - Access other managers' data

- Admin ONLY:
  - Can delete
  - Can generate commission

---

# 🔁 STATUS CONTROL (WITH RBAC)

## Only Agent can:

new → contacted → qualified → converted

## Manager:
- Can monitor but NOT convert

## Admin:
- Can override (optional)

---

# 🔐 API LEVEL RULES

## Lead APIs

- POST /leads → admin only
- GET /leads:
  - admin → all
  - manager → team leads
  - agent → own leads

- PUT /leads/:id:
  - only owner OR admin

- POST /leads/:id/assign:
  - admin → assign to manager
  - manager → assign to agent

- POST /leads/:id/convert:
  - agent only

---

# 🧩 BACKEND IMPLEMENTATION STRATEGY

## Middleware 1: checkRole

Example:
- checkRole(['admin'])
- checkRole(['manager', 'admin'])

---

## Middleware 2: checkOwnership

- Validate assigned_to == user.id

---

## Middleware 3: checkManagerScope

- Manager can access:
  - own leads
  - leads of their agents

---

# ⚠️ COMMON MISTAKES (YOU MUST AVOID)

❌ Only checking role (WRONG)  
✅ Always check role + ownership  

❌ Allowing frontend to control access  
✅ Backend MUST enforce everything  

❌ No hierarchy  
✅ Manager → Agent hierarchy enforced  

---

# 🔥 FINAL RULE

👉 Every API must pass:

1. Role Check ✅  
2. Ownership Check ✅  
3. Flow Rule Check (FLOW.md) ✅  
