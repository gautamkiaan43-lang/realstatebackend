# API Specification

## Lead APIs

POST /leads
- Create new lead

GET /leads
- Get leads based on role

PUT /leads/:id
- Update lead status

POST /leads/:id/convert
- Convert lead to contact

---

## Contact APIs

GET /contacts
POST /contacts

---

## Deal APIs

POST /deals
GET /deals

---

## Assignment APIs

POST /leads/:id/assign
- Admin → Manager
- Manager → Agent
