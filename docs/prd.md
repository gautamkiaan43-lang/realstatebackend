# Project: Real Estate CRM System (Antigravity)

## Overview
A multi-role CRM system to manage Lead → Contact → Deal → Commission lifecycle.

---

## Roles

### Admin
- Full system access
- Assign leads to managers
- View all deals

### Manager
- Manage assigned leads
- Assign leads to agents
- Monitor agent performance

### Agent
- Work on assigned leads
- Convert leads to contacts
- Manage deals

---

## Core Modules

- Lead Management
- Contact Management
- Deal Management
- Commission Tracking

---

## Lead Status Flow

new → contacted → qualified → converted → lost

---

## Business Logic

- Lead must have an owner (manager or agent)
- Only owner can update lead
- Lead → Contact conversion creates new contact
- Converted lead cannot be edited

- Manager can assign leads to agents
- Agent can only access assigned leads

- Contact is permanent entity
- Deal can only be created from Contact
