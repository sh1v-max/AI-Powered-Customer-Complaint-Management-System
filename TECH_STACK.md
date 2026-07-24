# Tech Stack & Skills Map

What we're using, and exactly which part of the system each piece belongs to. Cross-reference with `PROJECT_PLAN.md` for the full architecture — this doc just answers "what tool/skill builds this specific piece."

---

## 1. Frontend

| Tech | Used for | Where |
|---|---|---|
| **React** (via Vite) | UI components, two-panel layout | `frontend/src/components/`, `frontend/src/pages/` |
| **Redux Toolkit** (`@reduxjs/toolkit`) | Global state: draft fields, risk assessment, chat messages, committed complaints list | `frontend/src/features/draftSlice.js`, `complaintsListSlice.js` |
| **react-redux** | Connects components to the Redux store (`useSelector`/`useDispatch`) | throughout `components/` |
| **Axios** (or RTK Query) | HTTP calls to the FastAPI backend | `frontend/src/api/` |
| **react-dropzone** | Drag-and-drop + click-to-browse file attachment inside the copilot chat input | `CopilotPanel` component |
| **@fontsource/inter** | Google Inter font, mandated by the assignment | imported once in `App.jsx` / global CSS |
| **CSS (plain or CSS Modules)** | Styling to resemble the reference UI (sectioned form, purple/shield-accented AI card) | `frontend/src/styles/` |

**Skills this demonstrates**: component composition, controlled forms, normalized global state (one `draftSlice` as the single source of truth so form and chat can't disagree), async thunks for API calls, conditional rendering driven by request/response state (extraction progress, missing-field hints).

---

## 2. Backend

| Tech | Used for | Where |
|---|---|---|
| **Python 3.11+** | Language | `backend/` |
| **FastAPI** | REST API framework — routers, request validation, async endpoints | `backend/app/api/`, `backend/app/main.py` |
| **Uvicorn** | ASGI server to run FastAPI locally/in prod | run command, `Dockerfile` if containerized |
| **Pydantic** | Request/response schema validation (`DraftFields`, `RiskAssessment`, `Complaint`) | `backend/app/schemas/` |
| **SQLAlchemy** | ORM — Python classes mapped to `drafts`, `documents`, `chat_messages`, `complaints`, `ai_analysis` tables | `backend/app/models/` |
| **Alembic** | Database migrations (versioned schema changes) | `backend/alembic/` |
| **python-multipart** | Parses multipart form data so FastAPI can accept file uploads/attachments | wired into the `/chat` endpoint that accepts an optional file |
| **python-dotenv** | Loads `GROQ_API_KEY` / `DATABASE_URL` from `.env` into config | `backend/app/core/config.py` |

**Skills this demonstrates**: REST API design (resource-oriented routes for drafts vs. complaints, matching the draft→commit lifecycle), ORM modeling with foreign keys across `drafts`/`documents`/`chat_messages`/`complaints`, request validation at the API boundary, environment-based config/secrets handling.

---

## 3. Document parsing (turns an upload into text the LLM can read)

| Tech | Used for | Where |
|---|---|---|
| **pypdf** or **pdfplumber** | Extracts text from PDF complaint reports | `backend/app/services/document_parser.py` |
| **python-docx** | Extracts text from DOCX complaint reports | same file |
| **mailparser** (or Python's stdlib `email` module) | Extracts body/headers from `.eml` complaint emails | same file |
| plain file read | TXT files | same file |

**Skills this demonstrates**: format-dispatch parsing (route by file extension/MIME type to the right extractor), treating "document → text" as an isolated, independently testable service rather than baking parsing logic into the AI graph.

---

## 4. AI orchestration — the core of the assessment

| Tech | Used for | Where |
|---|---|---|
| **LangGraph** | The actual agent framework — builds the `StateGraph` that routes every chat turn through intent classification → extraction/correction/Q&A → completeness check → risk assessment → duplicate check → reply composition | `backend/app/agents/graph.py`, `agents/nodes.py`, `agents/state.py` |
| **langchain-groq** (`ChatGroq`) | Python client wrapper for calling Groq-hosted models from LangGraph nodes | `backend/app/services/groq_client.py` |
| **Groq API — `openai/gpt-oss-20b`** | Fast/cheap model for structured tasks: intent classification, field extraction, correction-diff parsing | called from `classify_intent`, `extract_fields`, `apply_correction` nodes |
| **Groq API — `openai/gpt-oss-120b`** | Heavier-reasoning model for the AI risk assessment narrative (severity/next-action/root-cause style reasoning) | called from `generate_risk_assessment` node |

> **Model substitution note**: the assignment doc names `gemma2-9b-it` and `llama-3.3-70b-versatile`. As of 2026-07-24, Groq has already shut down `gemma2-9b-it` (Oct 8, 2025) and is retiring `llama-3.3-70b-versatile` on Aug 16, 2026 — too close to this build's timeline to depend on. Using Groq's own recommended replacements instead (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`), which sit at the same free-tier rate limits with no credit card required. Called out explicitly in the README as a dated engineering decision, not an unexplained deviation from the spec.

**Skills this demonstrates** (the ones to be ready to explain in the interview):
- **Stateful multi-turn agent design** — every chat turn re-enters the graph carrying the current draft state, not a stateless one-shot call.
- **Conditional graph routing** — branching on `intent` (new_extraction / correction / question) rather than a single linear prompt chain.
- **Structured output extraction** — prompting an LLM to return strict JSON matching a schema, with parse-and-retry handling.
- **Model selection by task shape** — cheap/fast model for classification and extraction, heavier model for open-ended reasoning.
- **Prompt design for auditability** — itemized "I updated X to Y" replies vs. narrative summaries, deliberately different templates by intent, because vague responses undermine trust in a compliance tool.

---

## 5. Database

| Tech | Used for | Where |
|---|---|---|
| **PostgreSQL** (Neon or Supabase free tier, or local via Docker) | Persistent storage for drafts, documents, chat history, and the committed complaints ledger | connection via `DATABASE_URL` in `backend/app/db/session.py` |
| **JSONB columns** | Flexible storage for `drafts.fields` and `drafts.risk_assessment` — lets the chat patch partial state without rigid column-per-field migrations mid-project | `drafts` table |

**Skills this demonstrates**: relational modeling for a real workflow (draft → commit lifecycle, with `documents`/`chat_messages` foreign-keyed to `draft_id`), pragmatic use of JSONB for genuinely variable/evolving data instead of over-normalizing everything upfront.

---

## 6. Dev tooling & delivery

| Tech | Used for | Where |
|---|---|---|
| **Git / GitHub** | Version control, the actual submission artifact | this repo |
| **Vite** | Frontend dev server + build tool | `frontend/` |
| **venv** | Python dependency isolation | `backend/.venv` |
| **Postman / curl** | Manual API testing during backend development | ad hoc, not committed |
| **Screen recording tool** (OBS, Loom, etc.) | 10–15 min demo video required for submission | n/a |

---

## Summary — one line per layer

- **See it, click it**: React + Redux Toolkit + Vite
- **Talk to it**: FastAPI + Pydantic
- **Remember it**: PostgreSQL + SQLAlchemy + Alembic
- **Read the document**: pypdf/python-docx/mailparser
- **Think about it**: LangGraph + Groq (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`)
- **Ship it**: Git/GitHub + a demo video
