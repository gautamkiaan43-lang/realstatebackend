# Backend Architecture

## Stack
- Node.js
- Express
- Prisma ORM
- MySQL

---

## Folder Structure

- controllers/
- routes/
- services/
- middleware/
- prisma/

---

## Rules

- Routes: only define endpoints
- Controllers: handle request/response
- Services: ALL business logic
- Prisma: only inside services

---

## RBAC Middleware

- checkRole(['admin'])
- checkRole(['manager'])
- checkRole(['agent'])

---

## Ownership Middleware

- validateOwnership(resourceId, userId)
