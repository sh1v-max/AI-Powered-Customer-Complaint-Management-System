# AI-Powered Customer Complaint Management System — Build Plan

Assessment: AIVOA Round 1 Full Stack Developer
Domain: Pharmaceutical manufacturing (API/FDF) Quality Management System (QMS) — Customer Complaint module

This plan has been reconciled against the actual AIVOA demo video (see `docs/demo-video-observations.md` for raw notes) — the real product behaves somewhat differently from the assignment PDF's static screenshot, and this doc reflects the video as source of truth. A few fields/sections beyond what was screenshotted are still assumptions — flagged where relevant.

---

## 1. What we're building (recap)

A "AIVOA Copilot" chat panel next to a complaint form. The chat is a **single, stateful, multi-turn intake channel** — not a one-shot upload box:

1. User pastes complaint text, pastes an EML/email body, or attaches a PDF/DOCX (via a paperclip icon on the same chat input) — the copilot extracts fields and fills the form live, plus generates an AI risk assessment (severity, suggested next action, risk narrative) in a distinct card at the bottom of the form.
2. User can send **follow-up chat messages at any point** to correct specific fields ("actually the batch number is X") — the copilot patches only those fields and confirms exactly what changed, regardless of how the complaint was originally created.
3. User can also just ask questions about the complaint in the same chat.
4. Once the form reads "Ready to Commit," the user reviews/edits and clicks **"Commit to QMS Ledger"** — this is the actual save action, distinct from and later than the AI parsing.
5. (Bonus) Deeper AI analysis: duplicate detection, more detailed CAPA/root-cause reporting, summary for a dashboard/list view.

Mandatory stack: React + Redux, FastAPI, LangGraph, Groq (`gemma2-9b-it` primary, `llama-3.3-70b-versatile` for heavier reasoning), Postgres/MySQL, Google Inter font.

---

## 2. Domain primer (read this before coding)

- **API** = Active Pharmaceutical Ingredient (the raw drug substance, e.g. bulk Metformin in a drum). **FDF** = Finished Dosage Form (the actual tablet/capsule sold to patients). Complaints can be about either — quantity/unit fields must stay free text ("48 capsules", "1 drum") rather than a fixed enum, and product identification must stay generic enough to cover raw material and finished product alike.
- **QMS** = the set of processes (SOPs, deviations, CAPA, complaints, audits) a pharma manufacturer runs to stay compliant with GMP.
- **Customer Complaint module**: when a customer/pharmacy/patient reports a problem with a batch (discoloration, contamination, broken tablets, missing labeling, adverse reaction), QA logs it, assesses severity/risk, investigates root cause, checks for duplicates/trends, and records a CAPA if needed. This is what the form + copilot are digitizing.
- Complaints get a **reference number** on commit, format observed: `CC-2026-00154` (prefix + year + zero-padded sequence).

You don't need to become a QA expert — just enough to make the field list and AI reasoning (severity/risk/CAPA) sound plausible and internally consistent.

---

## 3. Final folder structure (already scaffolded)

```
AI-Powered-Customer-Complaint-Management-System/
├── PROJECT_PLAN.md          <- this file
├── README.md                <- write last, for submission
├── docs/
│   ├── demo-video-observations.md   <- raw notes, reconciled into this plan
│   ├── architecture.md
│   ├── langgraph-design.md
│   └── api-spec.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/             # config.py (env vars), settings
│   │   ├── api/               # routers: drafts.py, complaints.py
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── db/                # session.py, base.py
│   │   ├── agents/            # LangGraph graph + nodes
│   │   ├── services/          # groq_client.py, document_parser.py
│   │   └── utils/
│   ├── alembic/                # DB migrations
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/        # ComplaintForm, AIRiskAssessmentCard, CopilotPanel, ChatMessage, StatusBadge
│   │   ├── features/          # redux slices: draftSlice, complaintsListSlice
│   │   ├── store/             # store.js
│   │   ├── api/                # axios instance / RTK Query api slice
│   │   ├── pages/              # ComplaintLogPage, ComplaintListPage
│   │   ├── styles/
│   │   └── App.jsx
│   ├── public/
│   ├── package.json
│   └── .env.example
├── sample-data/
│   ├── pdfs/       # fake complaint PDFs you author for the demo
│   ├── emails/     # .eml samples
│   └── images/     # scanned complaint images (optional, no real OCR needed)
└── .gitignore
```

---

## 4. Database schema

Use Postgres (recommend a free managed instance — Neon or Supabase — so you're not fighting local Postgres install; MySQL works too if you prefer).

**`drafts`** — the working state of a complaint being built up over a chat session, before it's committed
| column | type | notes |
|---|---|---|
| id | UUID PK | this is the `draft_id` the frontend holds for the whole session |
| fields | jsonb | current form field values, patched turn by turn (complaint_source, customer_name, product_name, product_strength_grade, batch_lot_number, manufacturing_date, expiry_date, quantity_affected, complaint_type, complaint_date, description, and whatever `facility_material_impact` section fields — see open items) |
| missing_fields | jsonb | list of required-but-empty field names |
| risk_assessment | jsonb | `{severity_suggested, suggested_next_action, initial_risk_assessment}` — the "AI copilot risk assessment" card contents |
| status | text | `pending_triage \| extracting \| needs_info \| ready_to_commit \| committed` |
| created_at / updated_at | timestamp | |

`fields` jsonb keys (final, from the assignment's own reference screenshot — see `docs/demo-video-observations.md` Observation 7): `complaint_source, customer_name, product_name, product_strength_grade, batch_lot_number, manufacturing_date, expiry_date, quantity_affected_amount, quantity_affected_unit, complaint_type, complaint_date, description, initial_severity`. `initial_severity` and the risk assessment's `severity_suggested` both use the enum `Minor | Major | Critical` (matches the "Major" value seen in the AI card).

**`documents`**
| column | type | notes |
|---|---|---|
| id | PK | |
| draft_id | FK, nullable | attachments happen during drafting, before a complaint exists |
| complaint_id | FK, nullable | set once the draft is committed, for traceability |
| filename | text | |
| file_type | text | pdf/docx/txt/eml |
| raw_text | text | parsed text, feeds the LLM and chat context |
| uploaded_at | timestamp | |

**`chat_messages`**
| column | type | notes |
|---|---|---|
| id | PK | |
| draft_id | FK | messages are tied to the draft session (persists across commit via the draft's eventual complaint link) |
| role | text | user / assistant |
| content | text | |
| created_at | timestamp | |

**`complaints`** — the permanent QMS ledger record, created only on "Commit to QMS Ledger"
| column | type | notes |
|---|---|---|
| id | UUID / serial PK | |
| complaint_reference_number | text, unique | generated on commit, e.g. `CC-2026-00154` |
| draft_id | FK | traceability back to the originating draft/chat session |
| complaint_source | text | |
| customer_name | text | |
| product_name | text | |
| product_strength_grade | text | |
| batch_lot_number | text | indexed — used for duplicate detection |
| manufacturing_date | date | |
| expiry_date | date | |
| quantity_affected_amount | numeric | e.g. `48` |
| quantity_affected_unit | text | e.g. "capsules", "kg", "drum" |
| complaint_type | text | free text, e.g. "foreign matter contamination", "discolored capsules" |
| complaint_date | date | |
| description | text | |
| severity | text | `Minor \| Major \| Critical` — starts as the AI suggestion, editable by reviewer before commit, stays editable after |
| suggested_next_action | text | free-text LLM phrase, editable by reviewer — no fixed routing enum found anywhere in the assignment materials |
| initial_risk_assessment | text | free-text narrative, editable by reviewer |
| status | text | post-commit QMS lifecycle: `logged \| in_review \| closed` (separate state machine from the draft's intake status) |
| created_at / updated_at | timestamp | |

**`ai_analysis`** (bonus, on-demand deeper analysis beyond the always-generated risk assessment card)
| column | type | notes |
|---|---|---|
| id | PK | |
| complaint_id | FK | |
| analysis_type | text | duplicate / capa_detail / root_cause_detail / summary |
| result_json | jsonb | |
| created_at | timestamp | |

Field list is now finalized against the assignment's own reference screenshot (Observation 7) — the video's "Facility & Material Impact" label for this same section-3 position is treated as cosmetic/instructor-renamed, not a distinct extra section. `fields` stays a flexible jsonb blob anyway, so extending it later is low-cost if the interviewer expects more.

---

## 5. Backend API surface

The core idea: **one endpoint drives the whole chat/intake/correction loop**, because that's what the demo shows — a single chat surface handles new extraction, corrections, and Q&A.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/drafts` | Create a new empty draft when the user opens a fresh "Log Customer Complaint" session → returns `draft_id` |
| POST | `/api/drafts/{draft_id}/chat` | **The unified endpoint.** Accepts `{ message?: str, attachment?: file }`. Runs the LangGraph draft graph (classifies intent → extracts/patches/answers → regenerates risk assessment if fields changed) → returns `{ assistant_message, fields, missing_fields, risk_assessment, status }`. Persists the turn to `chat_messages` and patches the `drafts` row. |
| GET | `/api/drafts/{draft_id}` | Fetch current draft state (for page reload/resume) |
| POST | `/api/drafts/{draft_id}/commit` | **"Commit to QMS Ledger."** Validates required fields, generates `complaint_reference_number`, creates the `complaints` row, marks draft `committed` |
| GET | `/api/complaints` | List committed complaints (dashboard) |
| GET | `/api/complaints/{id}` | Get one committed complaint + its documents + chat history |
| PUT | `/api/complaints/{id}` | Manual edit after commit |
| POST | `/api/complaints/{id}/analyze` | Bonus: on-demand deeper analysis (duplicate check across the ledger, expanded CAPA/root-cause report, summary) |

Pydantic schemas: a `DraftFields` model mirroring the jsonb `fields` shape, reused by both the draft chat response and the commit payload.

---

## 6. LangGraph design (the part they'll grill you on in interview)

This is the piece that changed most from the original plan once the demo showed multi-turn correction + mixed intake channels: it's not "extract once," it's **"route by intent, every turn."**

### State schema (TypedDict)
```python
class DraftState(TypedDict):
    draft_id: str
    current_fields: dict            # form state going into this turn
    chat_history: list[dict]        # prior turns, for intent + context
    user_message: str | None        # this turn's typed text, if any
    attachment_text: str | None     # parsed text from an attached file, if any
    intent: str                     # "new_extraction" | "correction" | "question" | "unclear"
    updated_fields: dict            # form state after this turn
    missing_fields: list[str]
    is_complete: bool
    risk_assessment: dict           # {severity_suggested, suggested_next_action, initial_risk_assessment}
    duplicates: list[dict]
    assistant_reply: str
```

### Graph nodes
1. **`parse_attachment`** (conditional, only if a file was attached) — PDF/DOCX/TXT/EML → text, same parsers as before (`pypdf`/`pdfplumber`, `python-docx`, `mailparser`).
2. **`classify_intent`** — decide `new_extraction` / `correction` / `question`. Cheap heuristic first: if `current_fields` is empty or an attachment is present → `new_extraction`; otherwise ask `gemma2-9b-it` to classify the message against the current field snapshot. Keep this fast and cheap — it runs on every single turn.
3. **Conditional routing on `intent`**:
   - `new_extraction` → **`extract_fields`**: strict JSON-schema extraction prompt over `attachment_text` or `user_message` → overwrite `updated_fields`.
   - `correction` → **`apply_correction`**: prompt = "here is the current form state as JSON, here is the new user message, return ONLY the fields that should change as JSON" → merge (patch, don't overwrite) into `updated_fields`. This is what handled "ah sorry the batch number is BMX240602 and affected quantity is 48 capcules."
   - `question` → **`answer_question`**: light RAG — concatenate `current_fields` + any attached doc text + `chat_history`, ask Groq, `updated_fields` stays unchanged.
4. **`completeness_check`** — after `new_extraction`/`correction` only: required fields non-empty → `missing_fields`, `is_complete`.
5. **`generate_risk_assessment`** — runs when fields changed and enough info exists: single LLM call (or fan-out of severity + root-cause/CAPA + risk-tag sub-prompts merged into one result) using `llama-3.3-70b-versatile` for the reasoning-heavy narrative → populates the grouped `risk_assessment` object shown in the UI's "AI copilot risk assessment" card. This is the natural home for what was originally three separate bonus nodes (severity classification, root ccause/CAPA, risk classification) — the demo UI treats them as one grouped, AI-suggested unit, so the graph should too.
6. **`duplicate_check`** — query Postgres for existing **committed complaints** with matching `batch_lot_number` or `product_name` + overlapping dates (drafts aren't in the ledger yet, so this only makes sense against `complaints`, not other drafts).
7. **`compose_reply`** — builds `assistant_reply` with a template chosen by intent: **narrative summary** for `new_extraction` ("I've extracted the Zenith Life Sciences complaint report (CC-2026-00154)... Form populated on the left."), **itemized diff** for `correction` ("I have updated the Batch/Lot Number to 'X' and the Affected Quantity to 'Y' in the form."), **direct answer** for `question`. Precise, auditable phrasing matters here — this is a compliance tool, vague AI responses undermine trust.
8. **END** — return `{updated_fields, missing_fields, is_complete, risk_assessment, duplicates, assistant_reply}` to FastAPI, which patches the `drafts` row and returns the same payload to the frontend.

### Commit flow (separate, simpler path)
`POST /api/drafts/{draft_id}/commit` is plain FastAPI logic, not a graph: validate `is_complete`, generate `complaint_reference_number` (`CC-{year}-{next_seq}`), copy `fields` + `risk_assessment` into a new `complaints` row, mark draft `committed`. No LLM call needed here — all the AI work already happened during the chat turns.

---

## 7. Frontend design

Two-column layout:

- **Left panel — `ComplaintForm`**: sectioned form — (1) Origin & Customer Details: Complaint Source, Customer Name; (2) Product & Batch Identification: Product Name, Product Strength/Grade, Batch/Lot Number, Manufacturing Date, Expiry Date, Quantity Affected as **two sub-fields** (amount + unit, e.g. `48` + `capsules`); (3) Complaint Details: Complaint Type, Complaint Date, Detailed Complaint Description; (4) Initial Assessment & Priority: Initial Severity (`Minor | Major | Critical` dropdown), Priority (dropdown). Status badge driven by `draft.status` (`Pending Triage / Extracting... / Needs Info / Ready to Commit`). Below the form, a visually distinct **`AIRiskAssessmentCard`** (shield icon, purple accent) showing Severity (Suggested, same `Minor|Major|Critical` enum), Suggested Next Action (free-text LLM phrase — no evidence of a fixed routing enum anywhere in the assignment materials), Initial Risk Assessment narrative — **all three are normal editable inputs pre-filled with the AI's suggestion**, not read-only display text; the reviewer can overwrite any of them before committing. Full-width **"Commit to QMS Ledger"** primary button below it, disabled until `is_complete`.
- **Right panel — `CopilotPanel`** ("AIVOA Copilot", flask icon, "Powered by LangGraph" footer): a single chat feed + one input that accepts typed text, pasted long text, and file attachments (paperclip icon) — this one surface is the entire intake/correction/Q&A channel. No separate dropzone or textarea-toggle UI; a drag-and-drop-over-the-panel affordance can just funnel into the same attachment handler.

**Redux slices**:
- `draftSlice` — `{ draftId, fields, missingFields, riskAssessment, status, chatMessages, sending }`. Every chat turn dispatches one thunk that calls `POST /api/drafts/{draft_id}/chat` and replaces `fields`/`riskAssessment`/`status` wholesale from the response — this keeps the form and chat from ever disagreeing, since the backend is the single source of truth for merges (never merge deltas in the frontend).
- `complaintsListSlice` (or RTK Query) — committed complaints for a simple dashboard/list page, useful for showing duplicate detection working across real records.

Use **Redux Toolkit** (not legacy Redux). Optionally RTK Query for the API layer. Set `Inter` via `@fontsource/inter` or a Google Fonts link.

---

## 8. Build phases (do them in this order)

### Phase 0 — Setup (0.5 day)
- [x] Folder skeleton created.
- [x] Demo video reconciled into this plan.
- [ ] `git init`, create GitHub repo, first commit.
- [ ] Sign up for Groq API key (console.groq.com) — store in `backend/.env`, never commit.
- [ ] Provision Postgres (Neon/Supabase free tier or local via Docker).
- [ ] Backend: `python -m venv .venv`, install `fastapi uvicorn sqlalchemy alembic psycopg2-binary langgraph langchain-groq python-multipart pypdf python-docx mailparser python-dotenv pydantic`.
- [ ] Frontend: `npm create vite@latest frontend -- --template react`, install `@reduxjs/toolkit react-redux axios react-dropzone @fontsource/inter`.

### Phase 1 — Backend foundation (0.5–1 day)
- [ ] SQLAlchemy models: `drafts`, `documents`, `chat_messages`, `complaints`, `ai_analysis`.
- [ ] Alembic migration, apply to DB.
- [ ] Pydantic schemas: `DraftFields`, `RiskAssessment`, `Complaint`.
- [ ] `POST /api/drafts` (create empty draft), `GET /api/drafts/{id}`.
- [ ] Complaint CRUD routers: `GET/PUT /api/complaints`, `GET /api/complaints/{id}`.

### Phase 2 — LangGraph draft/chat pipeline (2–2.5 days, the core — grew from the original estimate once multi-turn correction + intent routing entered scope)
- [ ] `services/groq_client.py` — wrapper around `langchain_groq.ChatGroq` for both models.
- [ ] `services/document_parser.py` — PDF/DOCX/TXT/EML → text.
- [ ] `agents/state.py` — `DraftState` TypedDict.
- [ ] `agents/nodes.py` — implement nodes one at a time, unit-test each against sample text before wiring the graph: `classify_intent` → `extract_fields` / `apply_correction` / `answer_question` → `completeness_check` → `generate_risk_assessment` → `duplicate_check` → `compose_reply`.
- [ ] `agents/graph.py` — `StateGraph` with conditional edges on `intent`.
- [ ] `POST /api/drafts/{draft_id}/chat` endpoint invoking the graph, patching the `drafts` row, persisting `chat_messages`.
- [ ] Test the full loop manually: paste a complaint → check extraction → send a correction message → check it patches instead of overwriting → ask a question → check it doesn't touch the fields.

### Phase 3 — Frontend foundation (1–1.5 days)
- [ ] Vite + Redux Toolkit store wiring, `draftSlice`.
- [ ] `ComplaintForm` component with the 3 (or more) sections, controlled inputs bound to `draftSlice.fields`.
- [ ] `AIRiskAssessmentCard` component, visually distinct styling.
- [ ] `CopilotPanel` shell: chat feed, single input with text + paperclip attachment, status badge.
- [ ] Apply Inter font + styling to resemble the real demo UI (not just the PDF mock).

### Phase 4 — Integration: chat-driven intake, correction, commit (1–1.5 days)
- [ ] Wire `CopilotPanel` input (text + attachment) to `POST /api/drafts/{draft_id}/chat`.
- [ ] On response, replace `draftSlice.fields`/`riskAssessment`/`status` wholesale (never merge client-side).
- [ ] Render `assistant_message` in the chat feed.
- [ ] Surface `missing_fields` as inline hints on the form.
- [ ] Wire "Commit to QMS Ledger" → `POST /api/drafts/{draft_id}/commit`, disabled until `is_complete`.

### Phase 5 — Bonus AI features + sample data (1 day)
- [ ] Author 4–5 realistic fake complaint documents (PDF/EML/TXT) in `sample-data/` covering: a complete FDF complaint, an API/raw-material complaint, one with missing fields, and a pair that should trigger duplicate detection.
- [ ] Wire `POST /api/complaints/{id}/analyze` for on-demand deeper duplicate/CAPA/summary detail beyond the always-on risk assessment card.
- [ ] Simple list/dashboard page (`GET /api/complaints`) showing committed complaints with their reference numbers.

### Phase 6 — Polish & docs (0.5 day)
- [ ] Error states (bad file type, LLM failure, empty commit attempt, malformed correction).
- [ ] `README.md`: setup instructions, env vars, architecture overview, screenshots.
- [ ] `docs/architecture.md`, `docs/langgraph-design.md` (largely reuse this plan).

### Phase 7 — Demo video & submission (0.5 day)
- [ ] Record 10–15 min video: AI tools walkthrough → frontend workflow (new intake, correction, commit) → code/architecture → LangGraph graph explanation (intent routing being the key idea) → key design decisions.
- [ ] Push to GitHub, submit via the Google Form with repo link + video link.

**Total estimate: ~6–8 focused full days** (revised up from the original 5–7 once the real multi-turn/intent-routed chat design replaced the simpler one-shot-extraction assumption), realistically 1.5–2.5 weeks part-time. Phase 2 is still where time slips — the intent classification + correction-merge logic is genuinely the hardest part to get reliable.

---

## 9. Key design decisions to be ready to explain in the interview

- **Intent-routed chat, not one-shot extraction**: every chat turn re-enters the same graph with the current draft state, and a `classify_intent` node decides whether to run full extraction, a targeted correction merge, or a Q&A answer. This is the single biggest departure from a naive "upload → extract → done" design, and it's what the actual product does (confirmed by the demo showing a correction message patch just the batch number and quantity without re-parsing anything else).
- **Two separate state machines**: draft-stage status (`extracting/needs_info/ready_to_commit`) versus post-commit QMS lifecycle status (`logged/in_review/closed`) on the `complaints` table. Conflating these would make "Ready to Commit" and a real QMS workflow status collide.
- **Grouped AI risk assessment as one LLM output, not three bonus features bolted on separately**: severity, suggested next action, and risk narrative are generated together and shown as one visually distinct card, matching how the UI actually presents them — rather than my first draft's plan of scattering severity/CAPA/risk-tag across separate sections.
- **Backend is the single source of truth for field merges** — the frontend never diffs/merges corrections itself; it always replaces its local state with whatever the `/chat` endpoint returns. Keeps form and chat from ever disagreeing.
- Why `gemma2-9b-it` for extraction/intent-classification (fast/cheap, structured JSON tasks) vs `llama-3.3-70b-versatile` for the risk-assessment narrative (needs more reasoning depth).
- Why no vector DB/embeddings for chat — a single draft/complaint's context is small enough to pass directly.
- Duplicate detection kept to batch-number/product/date matching against committed complaints, not embedding similarity — deliberate scope cut, documented as "would extend with embeddings given more time."
- The AI-suggested severity/next-action/risk-narrative fields are always editable, never read-only — the QA reviewer has final say before commit, which matters for a compliance tool where an unreviewable AI verdict would be a red flag in an interview.
- `Suggested Next Action` is deliberately free-text LLM output rather than a fixed routing enum — no evidence anywhere in the assignment materials constrains it to a taxonomy, and free text stays simple while remaining fully editable.

---

## 10. Env vars checklist

**backend/.env**
```
GROQ_API_KEY=
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

**frontend/.env**
```
VITE_API_BASE_URL=http://localhost:8000
```
