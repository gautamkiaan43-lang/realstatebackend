# Database Design

## users
- id
- name
- email
- role (admin, manager, agent)

---

## leads
- id
- name
- email
- phone
- status
- source
- assigned_to (user_id)
- created_by

---

## contacts
- id
- name
- email
- phone
- created_from_lead_id

---

## deals
- id
- contact_id
- value
- status
- assigned_to

---

## commissions
- id
- deal_id
- agent_id
- amount

---

## Rules

- Use snake_case
- Foreign keys must be enforced
- No duplicate contact from same lead
