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
| `redis` | redis:7-alpine | Session state + task queue + pub/sub |
| `dashboard` | ./dashboard | Next.js operator panel |

---

## 3. Project Structure

```
phonecall/
├── backend/
│   ├── app/
│   │   ├── voice/          # WebSocket gateway + Twilio webhooks
│   │   ├── agent/          # Orchestrator: conversation state + tool calling
│   │   ├── incidents/      # CRUD for incidents
│   │   ├── partners/       # Workshop search and ranking
│   │   ├── maps/           # Geocoding + route calculation
│   │   ├── calls/          # Outbound call management
│   │   ├── handoff/        # Human escalation
│   │   ├── notifications/  # Dashboard real-time WebSocket broadcaster
│   │   ├── auth/           # JWT issuance, middleware, operator model
│   │   └── db/             # SQLAlchemy models + Alembic migrations
│   ├── workers/            # ARQ task definitions
│   └── Dockerfile
├── dashboard/              # Next.js operator panel
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
  Twilio audio (mulaw 8kHz)  ->  resample to 24kHz + decode to PCM16  ->  OpenAI Realtime
  OpenAI audio (PCM16 24kHz) ->  resample to 8kHz + encode to mulaw   ->  Twilio
        |
OpenAI Realtime handles STT + LLM + TTS in real time
```

Each call is identified by Twilio's `call_sid`. A Redis session keyed by `call_sid` stores the live state of that call. Fifty concurrent drivers mean fifty independent async WebSocket pairs — no blocking between sessions.

**Audio conversion (`app/voice/audio.py`):**
Handles both format conversion (mulaw <-> PCM16) and sample rate resampling (8 kHz <-> 24 kHz). Use the `audioop` standard library for mulaw encoding/decoding and `scipy.signal.resample_poly` for resampling. This runs in the hot path on every audio chunk — keep it synchronous using pre-computed filter coefficients; avoid Python-level loops over samples.

**Twilio Media Streams event handling (`app/voice/gateway.py`):**

The gateway WebSocket handler must process the following Twilio event types:

| Event | Payload fields | Action |
|---|---|---|
| `connected` | `protocol`, `version` | Log connection, no action |
| `start` | `streamSid`, `callSid`, `customParameters` | Extract `call_sid`; create Redis `session:{call_sid}`; open OpenAI Realtime WebSocket; launch background `asyncio.Task` for pub/sub listener |
| `media` | `payload` (base64 mulaw) | Decode base64, convert mulaw→PCM16, resample 8kHz→24kHz, forward to OpenAI Realtime |
| `stop` | `callSid` | Close OpenAI Realtime WebSocket; delete `session:{call_sid}`; record `call_log` end time; update incident if still open |

The `call_sid` is extracted from the `start` event. All subsequent messages in the same WebSocket connection belong to that `call_sid`.

**OpenAI Realtime session configuration:**

| Parameter | Value |
|---|---|
| Model | `gpt-4o-realtime-preview` |
| Voice | `alloy` (default; configurable via env var `OPENAI_REALTIME_VOICE`) |
| `input_audio_format` | `pcm16` |
| `output_audio_format` | `pcm16` |
| `input_audio_sample_rate` | `24000` |
| `output_audio_sample_rate` | `24000` |
| `turn_detection` | `{ "type": "server_vad", "threshold": 0.5, "silence_duration_ms": 700 }` |
| `temperature` | `0.4` (low — agent must follow script closely) |
| `instructions` | System prompt from `agent/prompts.py` for current state and language |

The session is initialized immediately after the WebSocket to OpenAI is opened, before any audio is forwarded.

**Modules in `app/voice/`:**
- `router.py` — POST `/voice/inbound`, returns TwiML with `<Connect><Stream url="wss://server/voice/stream"/>`
- `gateway.py` — WebSocket handler `/voice/stream`, bridges Twilio to OpenAI Realtime, manages session lifecycle, runs pub/sub listener as background asyncio.Task
- `audio.py` — mulaw/PCM16 conversion and 8 kHz/24 kHz resampling

---

## 5. Agent Orchestration

The orchestrator in `app/agent/` is the system's decision core. It maintains per-call state and controls what the agent says at each step.

**The agent follows a closed script.** OpenAI Realtime receives a system prompt tailored to the current incident state. The model does not converse freely — it follows the prompt and calls tools to interact with the system.

**Incident state machine — valid transitions:**

| From state | To state | Trigger |
|---|---|---|
| `NEW` | `DRIVER_IDENTIFIED` | Tool: `create_incident` succeeds |
| `NEW` | `ESCALATED_TO_HUMAN` | Tool: `escalate_to_human` |
| `DRIVER_IDENTIFIED` | `LOCATION_CONFIRMED` | Tool: `geocode_location` returns valid coordinates |
| `DRIVER_IDENTIFIED` | `LOCATION_UNCLEAR` | Tool: `geocode_location` fails or returns low-confidence result after 2 attempts |
| `DRIVER_IDENTIFIED` | `ESCALATED_TO_HUMAN` | Tool: `escalate_to_human` |
| `LOCATION_UNCLEAR` | `LOCATION_CONFIRMED` | Driver provides clearer location, `geocode_location` succeeds |
| `LOCATION_UNCLEAR` | `ESCALATED_TO_HUMAN` | Automatic if driver cannot clarify (2 more attempts from `LOCATION_UNCLEAR`) |
| `LOCATION_CONFIRMED` | `ISSUE_CONFIRMED` | Tool: `update_incident` with issue data |
| `LOCATION_CONFIRMED` | `HIGH_RISK` | Tool: `update_incident` with `risk_level=high` |
| `LOCATION_CONFIRMED` | `ESCALATED_TO_HUMAN` | Tool: `escalate_to_human` |
| `ISSUE_CONFIRMED` | `WORKSHOP_SEARCHING` | Tool: `find_workshops` called |
| `HIGH_RISK` | `ESCALATED_TO_HUMAN` | Automatic on `HIGH_RISK` entry |
| `WORKSHOP_SEARCHING` | `WORKSHOP_CONTACTING` | Tool: `initiate_workshop_call` enqueues task |
| `WORKSHOP_SEARCHING` | `WORKSHOP_NOT_FOUND` | `find_workshops` returns empty result |
| `WORKSHOP_SEARCHING` | `ESCALATED_TO_HUMAN` | Tool: `escalate_to_human` |
| `WORKSHOP_CONTACTING` | `ETA_CONFIRMED` | ARQ task publishes accepted result via pub/sub |
| `WORKSHOP_CONTACTING` | `WORKSHOP_REJECTED` | ARQ task publishes rejected result via pub/sub |
| `WORKSHOP_REJECTED` | `WORKSHOP_SEARCHING` | Automatic retry when `attempt < MAX_WORKSHOP_ATTEMPTS` |
| `WORKSHOP_REJECTED` | `ESCALATED_TO_HUMAN` | Automatic when `attempt >= MAX_WORKSHOP_ATTEMPTS` |
| `WORKSHOP_NOT_FOUND` | `ESCALATED_TO_HUMAN` | Automatic |
| `ETA_CONFIRMED` | `DRIVER_NOTIFIED` | Orchestrator delivers ETA message to driver via OpenAI session |
| `DRIVER_NOTIFIED` | `CLOSED` | Call ends normally (`stop` event from Twilio) |
| `ESCALATED_TO_HUMAN` | `CLOSED` | Operator closes the incident via dashboard |
| `LOCATION_UNCLEAR` is NOT terminal | — | Agent behavior in this state: inform the driver the location could not be confirmed, ask them to describe it differently (landmark, road name, km marker). This prompt is defined in `prompts.py` per language. The agent gives the driver 2 more attempts before triggering automatic escalation. |

Any transition not in this table is invalid and must be rejected by the orchestrator with a logged warning.

**Agent tools (OpenAI function calling):**

| Tool | Module called |
|---|---|
| `geocode_location(text)` | maps/ |
| `create_incident(data)` | incidents/ |
| `update_incident(id, data)` | incidents/ |
| `find_workshops(lat, lng, type)` | partners/ |
| `initiate_workshop_call(workshop_id, incident_id)` | calls/ (enqueues ARQ task) |
| `escalate_to_human(incident_id, reason)` | handoff/ |

Language detection happens automatically from the first transcribed words. The orchestrator sets the agent's response language accordingly with no IVR menu.

**Modules in `app/agent/`:**
- `orchestrator.py` — per-call state management and state transition validation
- `prompts.py` — system prompts per state and language (covers all states including `LOCATION_UNCLEAR`, `HIGH_RISK`, `WORKSHOP_CONTACTING` hold)
- `tools.py` — tool definitions for OpenAI + handlers that call internal services
- `session.py` — reads/writes call state in Redis

---

## 6. Data Layer

### PostgreSQL (SQLAlchemy async + Alembic)

**`operators`**
```
id              uuid primary key
email           varchar unique
hashed_password varchar
name            varchar
active          boolean default true
created_at      timestamp
```

**`incidents`**
```
id                              uuid primary key
created_at                      timestamp
updated_at                      timestamp
status                          varchar (enum: state machine values)
driver_phone                    varchar
driver_language                 varchar (ISO 639-1, e.g. 'pl', 'es', 'en')
driver_name                     varchar nullable
plate_number                    varchar nullable
truck_company                   varchar nullable
issue_type                      varchar nullable
issue_description               text nullable
risk_level                      varchar ('low', 'medium', 'high') default 'low'
location_text                   text nullable
lat                             float nullable
lng                             float nullable
assigned_workshop_id            uuid FK -> workshops nullable
eta_minutes                     int nullable
escalation_required             boolean default false
escalation_reason               text nullable
abrupt_end                      boolean default false  -- Twilio disconnect without stop event
driver_disconnected_mid_contact boolean default false  -- driver hung up during ARQ workshop task
claimed_by_operator_id          uuid FK -> operators nullable
claimed_at                      timestamp nullable
```

**`workshops`**
```
id              uuid primary key
name            varchar
phone           varchar
country         varchar (ISO 3166-1 alpha-2)
language_codes  varchar[] (e.g. ['pl', 'en'])
services        varchar[] (e.g. ['tyre', 'engine', 'towing'])
lat             float
lng             float
active          boolean default true
priority_score  int default 0
created_at      timestamp
```

**`call_logs`**
```
id              uuid primary key
incident_id     uuid FK -> incidents
call_type       varchar ('driver', 'workshop', 'operator')
attempt_number  int (1-based; for workshop calls, which attempt this was)
twilio_call_sid varchar
started_at      timestamp
ended_at        timestamp nullable
transcript      text nullable
structured_result jsonb nullable
success         boolean nullable
escalation_reason text nullable
```

`structured_result` schema by `call_type`:
- `driver`: `{ "language_detected": "pl", "data_collected": { "plate": "...", "issue": "...", ... } }`
- `workshop`: `{ "accepted": true, "eta_minutes": 35, "notes": "..." }`
- `operator`: `{ "resolution": "..." }`

### Redis (ephemeral)

```
session:{call_sid}              -> live driver call state (TTL: 2h)
                                   { incident_id, state, language, turn_count,
                                     last_activity, workshop_attempts }

session:workshop:{call_sid}     -> live workshop call state (TTL: 30min)
                                   { incident_id, workshop_id, attempt_number }

lock:{incident_id}              -> mutex for concurrent event protection (TTL: 30s)

events:all                      -> Redis pub/sub channel for ALL incident events
                                   (single channel, wildcard-safe for broadcaster)
```

All incident event publishing uses the single `events:all` channel. The `broadcaster.py` subscribes once to `events:all` using a single persistent connection and fans out to all connected dashboard WebSocket clients. The `gateway.py` pub/sub listener also subscribes to `events:all` and filters by `incident_id` to only react to events for its own call.

Event payload schema (all event types):
```json
{
  "event_type": "incident_status_changed | escalation_required | workshop_result | ...",
  "incident_id": "uuid",
  "new_status": "STATE_NAME",
  "data": {},
  "timestamp": "ISO8601"
}
```

---

## 7. Outbound Workshop Calls

When location and issue are confirmed, the orchestrator calls the `initiate_workshop_call` tool, which enqueues an ARQ background task. The driver enters a hold state while the worker runs.

**Driver hold mechanism during workshop contact:**
When the incident transitions to `WORKSHOP_CONTACTING`, the orchestrator sends a `session.update` event to the OpenAI Realtime session, changing the system prompt to the hold prompt for the driver's language (e.g., "Please hold, we are contacting a workshop for you. I will update you shortly."). The orchestrator also sets a flag in the Redis session (`hold_mode: true`) so that `tools.py` suppresses all tool calls until the hold is lifted. OpenAI will repeat the hold message periodically in response to driver speech.

Simultaneously, the `gateway.py` WebSocket handler's background pub/sub listener `asyncio.Task` (already running since the `start` event) receives workshop result events from `events:all` and, when the matching `incident_id` and `event_type: workshop_result` arrives, injects the result into the orchestrator and lifts hold mode.

**Workshop call WebSocket endpoint:**
The outbound workshop call uses a separate TwiML endpoint. `/voice/workshop-inbound` (POST) responds with:
```xml
<Response>
  <Connect>
    <Stream url="wss://server/voice/workshop-stream"/>
  </Connect>
</Response>
```
The WebSocket handler at `/voice/workshop-stream` in `app/calls/router.py` manages the workshop audio bridge, using the same `audio.py` conversion and a separate OpenAI Realtime session configured with the workshop agent prompts.

Workshop call Redis session: `session:workshop:{call_sid}` (TTL: 30 min) stores `{ incident_id, workshop_id, attempt_number }`. This is created when the workshop WebSocket `start` event arrives, and deleted on `stop`.

**Workshop contact flow:**

```
ARQ task: contact_workshop_task(workshop_id, incident_id, driver_call_sid, attempt)
  |
[Check] Does session:{driver_call_sid} exist in Redis?
  No  -> set incident.driver_disconnected_mid_contact=true, status=CLOSED, stop
  Yes -> continue
  |
Twilio REST API: create outbound call to workshop phone
  url: /voice/workshop-inbound
  |
Workshop WebSocket /voice/workshop-stream opens
  |
Workshop agent (in workshop's local language, from workshops.language_codes):
  "Hello, calling from roadside assistance.
   Truck broken down at [location]. Can you attend?"
  |
Workshop responds:
  Case A — Accepted:  extract { accepted:true, eta_minutes, notes }
  Case B — Rejected:  extract { accepted:false, notes }
  Case C — No answer (timeout): treat as rejected, notes="no_answer"
  Case D — Voicemail/IVR detected (agent hears recorded greeting or DTMF menu):
           agent says nothing further; task treats as no_answer and retries
  Case E — Unrecognized language: agent cannot extract structured response;
           treat as no_answer after WORKSHOP_ANSWER_TIMEOUT_SECONDS
  |
Publish to Redis pub/sub events:all:
  { event_type:"workshop_result", incident_id, accepted, eta_minutes, attempt, timestamp }
Updates incident in PostgreSQL
```

Voicemail/IVR detection: the workshop agent system prompt instructs it to detect non-human responses (repetitive recordings, DTMF prompts, silence followed by beep) and immediately flag them by calling a `signal_voicemail()` tool that returns control to the ARQ task.

**Retry logic:** if a workshop rejects or the task treats the call as rejected (no answer, voicemail, unrecognized language), the worker increments `attempt` and enqueues a new `contact_workshop_task` for the next workshop from `find_workshops`. After `MAX_WORKSHOP_ATTEMPTS` rejections, the task escalates to human instead.

**Modules in `app/calls/`:**
- `router.py` — webhook `/voice/workshop-inbound` + WebSocket `/voice/workshop-stream`
- `outbound.py` — launches outbound call via Twilio REST API
- `workshop_agent.py` — prompts, tools, and OpenAI session config for workshop conversation

**Modules in `workers/`:**
- `tasks.py` — `contact_workshop_task`, `callback_driver_task`, `send_sms_task`, `cleanup_stale_sessions_task`
- `settings.py` — ARQ worker configuration including cron schedules

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

**Real-time updates:**
The backend exposes a dashboard WebSocket endpoint at `/notifications/live`. Operators connect after login with a JWT token passed as a query parameter: `ws://server/notifications/live?token={jwt}`. The backend validates the JWT on connection and rejects unauthenticated clients.

`app/notifications/broadcaster.py` maintains a single persistent Redis pub/sub subscription to `events:all` using `SUBSCRIBE events:all`. On each received event, it fans out the raw JSON payload to all currently connected operator WebSocket clients. The subscription is established once at application startup (via FastAPI `lifespan`) and never recreated per-client — new operator WebSocket connections simply register themselves in an in-memory set managed by `broadcaster.py`.

**`app/notifications/`:**
- `router.py` — WebSocket endpoint `/notifications/live` with JWT auth on connect
- `broadcaster.py` — singleton pub/sub subscriber; in-memory client registry; fan-out on event

---

## 9. Authentication

**`app/auth/`:**
- `models.py` — `Operator` table defined in Section 6 (`db/models.py` also contains it)
- `jwt.py` — issue and validate JWT tokens; payload: `{ sub: operator_id, email, exp }`
- `middleware.py` — FastAPI dependency for protected REST endpoints (`Authorization: Bearer {token}`)
- `router.py` — `POST /auth/login` validates credentials and returns JWT

**Dashboard <-> backend auth:**
- REST API: `Authorization: Bearer {jwt}` header on every request
- WebSocket (`/notifications/live`): `?token={jwt}` query parameter on connect (browsers cannot set headers on WS upgrade)
- Twilio webhooks: authenticated via Twilio request signature validation (`X-Twilio-Signature` header) — separate from operator JWT, handled in `app/voice/router.py`

---

## 10. Human Escalation and Call Takeover

**Automatic escalation triggers:**
- Location unclear after 2 additional attempts from `LOCATION_UNCLEAR` state
- High risk level (accident, immediate danger)
- No workshop accepts after `MAX_WORKSHOP_ATTEMPTS` attempts
- Model flags low confidence in extracted data via `escalate_to_human` tool
- OpenAI Realtime connection failure

**Escalation flow:**
```
agent tool: escalate_to_human(incident_id, reason)
  |
incident.status -> ESCALATED_TO_HUMAN
incident.escalation_reason saved to PostgreSQL
  |
Publishes to events:all: { event_type:"escalation_required", incident_id, reason, timestamp }
All connected dashboard operators receive real-time alert
  |
Agent tells driver (in driver's language): "Connecting you with an operator now."
  |
[Call transfer sequence]:
  1. Orchestrator sends session.update to close the OpenAI Realtime session gracefully
  2. Backend calls Twilio REST API to redirect the live call:
     POST /2010-04-01/Accounts/{SID}/Calls/{call_sid}
     Body: Url={BASE_URL}/voice/transfer, Method=POST
  3. GET /voice/transfer returns TwiML:
     <Response><Dial>{OPERATOR_TRANSFER_TARGET}</Dial></Response>
     where OPERATOR_TRANSFER_TARGET is a phone number or SIP URI from env var
  4. Redis session:{call_sid} deleted; call_log end time recorded
```

**Dashboard operator claim:**
`POST /api/v1/incidents/{id}/claim` (JWT protected). Sets `incidents.claimed_by_operator_id` and `incidents.claimed_at` in PostgreSQL. Returns 409 if already claimed by another operator. This is persisted — a backend restart does not lose claim state. When an incident is claimed, the backend publishes an `incident_claimed` event to `events:all` so other operators' dashboards remove the escalation alert.

**Modules in `app/handoff/`:**
- `service.py` — escalation logic: update state, send session.update to OpenAI, trigger Twilio redirect, publish event
- `router.py` — `POST /api/v1/incidents/{id}/claim`, `POST /voice/transfer` (TwiML for transfer)

---

## 11. Error Handling

| Error | Behavior |
|---|---|
| OpenAI Realtime drops during driver call | Orchestrator detects WebSocket close event; calls `escalate_to_human` automatically |
| Twilio WebSocket `stop` event received | Redis session deleted; incident `CLOSED` with `abrupt_end=true` |
| Twilio WebSocket cut without `stop` event | Redis TTL expires in 2h; `cleanup_stale_sessions_task` runs every 15min, finds incidents in non-terminal states with no active Redis session, marks them `CLOSED` with `abrupt_end=true` |
| PostgreSQL unavailable | ARQ retries task up to 3 times with exponential backoff (1s, 4s, 16s) |
| Workshop no answer within `WORKSHOP_ANSWER_TIMEOUT_SECONDS` | Worker treats as rejected, retries next workshop |
| Workshop voicemail or IVR detected | Workshop agent calls `signal_voicemail()` tool; ARQ task treats as no_answer |
| Workshop speaks unrecognized language | Agent cannot extract structured result after timeout; treated as no_answer |
| Driver disconnects during ARQ workshop contact task | Task checks `session:{driver_call_sid}` in Redis; if missing, sets `driver_disconnected_mid_contact=true`, marks incident `CLOSED`, stops task |
| Max workshop attempts reached | ARQ task publishes escalation event and calls `POST /api/v1/incidents/{id}/escalate` |

**Stale session cleanup (`workers/tasks.py` — `cleanup_stale_sessions_task`):**
Scheduled ARQ cron task running every 15 minutes. Queries PostgreSQL for incidents with non-terminal status (`NOT IN ('CLOSED', 'ESCALATED_TO_HUMAN')`) where `updated_at < now() - interval '2 hours'`. For each found, checks if `session:{any_call_sid}` exists in Redis (call_sid from associated `call_logs`). If no Redis session exists, marks incident `CLOSED` with `abrupt_end=true`.

---

## 12. Environment Variables

```
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/phonecall
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=
OPENAI_REALTIME_VOICE=alloy          # alloy | echo | shimmer | verse | etc.

# Twilio (add when available)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Google Maps (add when available)
GOOGLE_MAPS_API_KEY=

# Dashboard auth
JWT_SECRET=
JWT_EXPIRE_MINUTES=480

# Operator call transfer
OPERATOR_TRANSFER_TARGET=           # SIP URI or E.164 phone number

# Base URL (for Twilio webhook callbacks)
BASE_URL=https://your-domain.com

# Config
MAX_WORKSHOP_ATTEMPTS=3
WORKSHOP_ANSWER_TIMEOUT_SECONDS=45
STALE_SESSION_CLEANUP_INTERVAL_MINUTES=15
```

---

## 13. Development Setup

1. Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY` and database credentials
2. Run `docker compose up` to start all services
3. Run Alembic migrations: `docker compose exec backend alembic upgrade head`
4. Use **ngrok** to expose port 8000 publicly for Twilio webhooks during local development: `ngrok http 8000`
5. Set `BASE_URL` in `.env` to the ngrok HTTPS URL
6. Configure the ngrok URL as the webhook in Twilio console when keys are provisioned

**Production:** same `docker-compose.yml` on any VPS or cloud instance, environment variables updated for production values.
