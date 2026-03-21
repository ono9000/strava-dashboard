# PhoneCall — Roadside Assistance Voice Agent: Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Stack:** FastAPI + PostgreSQL + Redis + ARQ + Twilio Media Streams + OpenAI Realtime + Next.js

---

## 1. Overview

A production-grade roadside assistance system for truck drivers. When a driver calls a Twilio number, an AI voice agent collects incident data, locates the nearest available workshop, contacts it via an outbound AI call, confirms ETA, and notifies the driver. Human operators can monitor all active incidents in real time and take over any call that requires escalation.

**Key constraints:**
- Multiple concurrent driver calls supported from day one
- Multilingual: agent auto-detects language and responds accordingly (Spanish, English, Polish, and other European languages)
- Twilio and Google Maps API keys not yet provisioned — architecture isolates these integrations behind service modules so they can be plugged in without structural changes
- Deployment target undecided — Docker Compose on any VPS or cloud instance

---

## 2. Architecture

**Pattern:** Modular monolith + async background workers (Option C)

FastAPI handles all HTTP and WebSocket traffic. ARQ (async Redis Queue) runs background tasks in a separate worker process using the same codebase. This allows concurrent driver WebSocket sessions to remain non-blocking while heavy operations (outbound calls, notifications) run in the background.

**Docker Compose services:**

| Service | Image | Purpose |
|---|---|---|
| `backend` | ./backend | FastAPI (uvicorn) |
| `worker` | ./backend (same image) | ARQ worker |
| `db` | postgres:16 | Persistent data |
| `redis` | redis:7-alpine | Session state + task queue |
| `dashboard` | ./dashboard | Next.js operator panel |

---

## 3. Project Structure

```
phonecall/
├── backend/
│   ├── app/
│   │   ├── voice/        # WebSocket gateway + Twilio webhooks
│   │   ├── agent/        # Orchestrator: conversation state + tool calling
│   │   ├── incidents/    # CRUD for incidents
│   │   ├── partners/     # Workshop search and ranking
│   │   ├── maps/         # Geocoding + route calculation
│   │   ├── calls/        # Outbound call management
│   │   ├── handoff/      # Human escalation
│   │   └── db/           # SQLAlchemy models + Alembic migrations
│   ├── workers/          # ARQ task definitions
│   └── Dockerfile
├── dashboard/            # Next.js operator panel
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 4. Voice Pipeline

When a driver calls the Twilio number:

```
Driver calls Twilio number
        |
Twilio POST /voice/inbound  ->  FastAPI returns TwiML (<Connect><Stream>)
        |
Twilio opens WebSocket  ->  ws://server/voice/stream
        |
FastAPI opens WebSocket  ->  wss://api.openai.com/v1/realtime
        |
FastAPI bridges audio bidirectionally:
  Twilio audio (mulaw 8kHz)  ->  converted  ->  OpenAI Realtime
  OpenAI audio (pcm 24kHz)   ->  converted  ->  Twilio
        |
OpenAI Realtime handles STT + LLM + TTS in real time
```

Each call is identified by Twilio's `call_sid`. A Redis session keyed by `call_sid` stores the live state of that call. Fifty concurrent drivers mean fifty independent async WebSocket pairs — no blocking between sessions.

**Modules in `app/voice/`:**
- `router.py` — POST `/voice/inbound`, returns TwiML with `<Connect><Stream>`
- `gateway.py` — WebSocket handler `/voice/stream`, bridges Twilio to OpenAI Realtime
- `audio.py` — audio format conversion (mulaw <-> pcm16)

---

## 5. Agent Orchestration

The orchestrator in `app/agent/` is the system's decision core. It maintains per-call state and controls what the agent says at each step.

**The agent follows a closed script.** OpenAI Realtime receives a system prompt tailored to the current incident state. The model does not converse freely — it follows the prompt and calls tools to interact with the system.

**Incident state machine:**

```
NEW
  -> DRIVER_IDENTIFIED
  -> LOCATION_CONFIRMED
  -> ISSUE_CONFIRMED
  -> WORKSHOP_SEARCHING
  -> WORKSHOP_CONTACTING
  -> ETA_CONFIRMED
  -> DRIVER_NOTIFIED
  -> CLOSED

Error branches:
  -> ESCALATED_TO_HUMAN
  -> WORKSHOP_NOT_FOUND
  -> WORKSHOP_REJECTED
  -> LOCATION_UNCLEAR
  -> HIGH_RISK
```

**Agent tools (OpenAI function calling):**

| Tool | Module |
|---|---|
| `geocode_location(text)` | maps/ |
| `create_incident(data)` | incidents/ |
| `update_incident(id, data)` | incidents/ |
| `find_workshops(lat, lng, type)` | partners/ |
| `initiate_workshop_call(workshop_id, incident_id)` | calls/ (ARQ task) |
| `escalate_to_human(incident_id, reason)` | handoff/ |

Language detection happens automatically from the first transcribed words. The orchestrator sets the agent's response language accordingly with no IVR menu.

**Modules in `app/agent/`:**
- `orchestrator.py` — per-call state management and state transition validation
- `prompts.py` — system prompts per state and language
- `tools.py` — tool definitions for OpenAI + handlers that call internal services
- `session.py` — reads/writes call state in Redis

---

## 6. Data Layer

### PostgreSQL (SQLAlchemy async + Alembic)

**`incidents`**
```
id, created_at, updated_at, status
driver_phone, driver_language, driver_name
plate_number, truck_company
issue_type, issue_description, risk_level
location_text, lat, lng
assigned_workshop_id (FK -> workshops)
eta_minutes, escalation_required, escalation_reason
```

**`workshops`**
```
id, name, phone, country, language_codes (array)
services (array), lat, lng
active, priority_score, created_at
```

**`call_logs`**
```
id, incident_id (FK), role (driver/workshop/operator)
twilio_call_sid, started_at, ended_at
transcript (text), structured_result (jsonb)
success, escalation_reason
```

### Redis (ephemeral)

```
session:{call_sid}    -> full live call state (TTL: 2h)
                         {incident_id, state, language, turn_count, last_activity}
lock:{incident_id}    -> mutex for concurrent event protection (TTL: 30s)
```

Redis holds only what the orchestrator needs in real time. All final state is persisted to PostgreSQL.

---

## 7. Outbound Workshop Calls

When location and issue are confirmed, the orchestrator calls the `initiate_workshop_call` tool, which enqueues an ARQ background task. The driver hears a hold message while the worker runs.

**Workshop contact flow:**

```
ARQ task: contact_workshop_task
  |
Twilio opens outbound call to workshop phone
  |
Twilio POST /voice/workshop-inbound
  |
FastAPI returns TwiML -> second WebSocket bridge -> OpenAI Realtime
  |
Workshop agent (in workshop's local language):
  "Hello, calling from roadside assistance.
   Truck broken down at [location]. Can you attend?"
  |
Extracts structured response:
  { accepted: bool, eta_minutes: int, notes: str }
  |
Updates incident in PostgreSQL
Publishes event to Redis: session:{driver_call_sid}
  |
Orchestrator detects event -> notifies driver
```

**Retry logic:** if a workshop rejects or does not answer within 45 seconds, the worker moves to the next workshop in the ranking. Maximum 3 attempts before escalating to a human operator. The retry limit is configurable via environment variable.

**Modules in `app/calls/`:**
- `router.py` — webhook `/voice/workshop-inbound`
- `outbound.py` — launches outbound call via Twilio API
- `workshop_agent.py` — prompts and tools for the workshop conversation

**Modules in `workers/`:**
- `tasks.py` — `contact_workshop_task`, `callback_driver_task`, `send_sms_task`
- `settings.py` — ARQ worker configuration

---

## 8. Operator Dashboard (Next.js)

**Stack:** Next.js 14 (App Router), Tailwind CSS, Leaflet maps, NextAuth (credentials), JWT for backend API auth.

**Views:**

| Route | Content |
|---|---|
| `/dashboard` | Live map of active incidents + metrics (active calls, avg resolution time) |
| `/incidents` | Full incident list with filters (status, country, date) |
| `/incidents/:id` | Incident detail: driver data, map, live transcript via WebSocket, workshop history, escalate/take-call buttons |
| `/workshops` | Workshop CRUD: add, edit, activate/deactivate, filter by country/service |
| `/call-logs` | Full call history with transcripts and structured results |

The backend emits WebSocket events when incident state changes. The dashboard subscribes to these events for real-time updates without polling.

---

## 9. Human Escalation

**Automatic escalation triggers:**
- Location unclear after 2 attempts
- High risk level (accident, immediate danger)
- No workshop accepts after 3 attempts
- Model flags low confidence in extracted data
- OpenAI Realtime connection failure

**Escalation flow:**
```
agent tool: escalate_to_human(incident_id, reason)
  |
incident.status -> ESCALATED_TO_HUMAN
escalation_reason saved to PostgreSQL
  |
Dashboard shows real-time alert to operators
  |
Agent tells driver: "Connecting you with an operator now."
  |
Twilio transfers call to operator queue (phone number or SIP)
```

**Modules in `app/handoff/`:**
- `service.py` — escalation logic, state update, dashboard WebSocket notification
- `router.py` — endpoint for operator to claim an incident from the dashboard

---

## 10. Error Handling

| Error | Behavior |
|---|---|
| OpenAI Realtime drops | Agent informs driver, escalates to human |
| Twilio WebSocket cut | Redis session expires in 2h, incident marked CLOSED with `abrupt_end` flag |
| PostgreSQL unavailable | ARQ retries task up to 3 times with exponential backoff |
| Workshop no answer (45s) | Worker advances to next workshop in ranking |

---

## 11. Environment Variables

```
# Database
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=

# Twilio (add when available)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Google Maps (add when available)
GOOGLE_MAPS_API_KEY=

# Dashboard auth
JWT_SECRET=
OPERATOR_DEFAULT_EMAIL=
OPERATOR_DEFAULT_PASSWORD=

# Config
MAX_WORKSHOP_ATTEMPTS=3
WORKSHOP_ANSWER_TIMEOUT_SECONDS=45
```

---

## 12. Development Setup

1. Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY` and database credentials
2. Run `docker compose up` to start all services
3. Run Alembic migrations: `docker compose exec backend alembic upgrade head`
4. Use **ngrok** to expose port 8000 publicly for Twilio webhooks during local development

Production deployment: same `docker-compose.yml` on any VPS or cloud instance, environment variables updated for production values.
