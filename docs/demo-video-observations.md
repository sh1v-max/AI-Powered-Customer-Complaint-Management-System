# Demo Video Observations Log

Raw notes captured while watching the actual AIVOA demo video, screenshot by screenshot. This is a scratchpad — reconcile into `PROJECT_PLAN.md` once the full video has been reviewed. Don't treat this as final architecture yet.

---

### Observation 1 — Chat-driven form fill

- The right panel is branded **"AIVOA Copilot"** (not "AI Complaint Intake Assistant"), subtitle "Drop complaint files or paste text below." Footer: "Powered by LangGraph."
- The chat input at the bottom ("Type a message or paste a complaint...") is not just for Q&A after extraction — the user pastes the entire complaint narrative *as a chat message* (e.g. "Apollo Pharmacy reported discolored capsules in Amoxicillin Capsules 500 mg. Batch number AMX240602. Manufacturing date March 2026. Expiry date February 2028. Please log this complaint") and the copilot parses it directly from the conversational turn and fills the form.
- **Implication**: the chat interface is a unified intake channel — same LangGraph extraction pipeline must be triggered from (a) file drop, (b) pasted text box, AND (c) a plain chat message. Don't build the chat as a separate "ask questions about a saved complaint" feature only — it needs to double as the extraction trigger. Simplifies the frontend: one chat/input surface can likely handle all three cases rather than a separate paste-textarea + dropzone + chat.
- Assistant responds with a confirmation message after parsing: "Complaint parsed successfully. I've extracted the product details, mapped the batch information, and generated an initial risk assessment for the discolored capsules." — so a risk assessment step runs automatically as part of intake, not as a separate later action.

### Observation 2 — Status badge

- Badge reads **"Ready to Commit"** (green dot), not "Pending Triage" as shown in the assignment PDF's static screenshot. Suggests status values differ from what the assignment doc implies — likely something like `draft → ready_to_commit → committed/logged`, need to see more of the flow to confirm the full set.

### Observation 3 — Form field grouping differs from the PDF reference image

Actual demo sections seen so far:
1. **Origin & Customer Details** — Complaint Source, Customer Name
2. **Product & Batch Identification** — Product Name, Product Strength, Batch/Lot Number, Affected Quantity, Manufacturing Date, Expiry Date
3. **Facility & Material Impact** — (cut off in screenshot, not yet visible)

This differs from the PDF assignment's static screenshot which had: Origin & Customer Details / Product & Batch Identification / Complaint Details / Initial Assessment & Priority. Treat the PDF screenshot as a rough mock, and the actual demo video as the source of truth for field grouping — update the DB schema and form component sections once the rest of the video is captured.

### Observation 4 — "AI copilot risk assessment" is its own form section, not just a chat aside

A distinct card sits at the bottom of the form, below the regular editable fields, labeled **"AI copilot risk assessment"** (shield icon). It has its own sub-fields, all AI-generated (not user-typed):
- **Severity (Suggested)** — e.g. `Major`
- **Suggested Next Action** — e.g. `Route to QA Investigation & Issue Replacement`
- **Initial Risk Assessment** — free-text reasoning, e.g. `Potential moisture ingress or primary packaging seal failure leading to capsule discoloration. Req[uires...]` (cut off)

Below that card is a full-width primary button: **"Commit to QMS Ledger"** — this is almost certainly the actual "save complaint" action (confirms the "Ready to Commit" badge from Observation 2: the record sits in a draft/reviewable state until this button is pressed).

Instructor's framing (paraphrased): the AI should use its own reasoning — not just extracted facts — to populate this whole section: infer severity, propose a next action, and write an initial risk-assessment narrative, all grounded in the complaint details already extracted.

**Implications for the plan:**
- This is essentially my planned `classify_severity_priority` + `root_cause_and_capa` + `risk_classification` LangGraph nodes, but the UI treats their outputs as **one grouped "AI copilot risk assessment" card** rather than scattered form fields. Worth mirroring that grouping in the frontend: one `AIRiskAssessmentCard` component bound to a single `risk_assessment` object in state (`{severity_suggested, suggested_next_action, initial_risk_assessment}`), rather than spreading AI outputs across the same inputs as user-entered fields.
- These fields read as AI-suggested/advisory (separate visual treatment, purple/shield accent) rather than directly editable form inputs like the rest of the form — likely still editable/overridable by the QA reviewer before commit, but visually distinguished as "AI suggested."
- "Suggested Next Action" is a new concept not in my original node list — closest existing node is `root_cause_and_capa`; may want to rename/reshape that node's output to explicitly include a short actionable "next action" string (e.g. "Route to QA Investigation & Issue Replacement") separate from the longer CAPA narrative.
- Confirms a two-stage save flow: (1) AI intake fills the form + risk assessment automatically, (2) human clicks **"Commit to QMS Ledger"** to actually persist it — this is the real `POST /api/complaints` trigger, not the chat parsing step itself.

### Observation 5 — Chat also handles targeted corrections to an already-filled form

After the initial parse, user sends a follow-up chat message: *"ah sorry the batch number is BMX240602 and affected quantity is 48 capcules"* (note: original extraction had read batch as `AMX240602`, user corrects to `BMX240602` — a plausible OCR/parse-confusion type correction, and a typo "capcules" in the user's own message that the copilot doesn't need to fix, just apply). Copilot responds: *"Got it. I have updated the Batch / Lot Number to 'BMX240602' and the Affected Quantity to '48 capcules' in the form."* — and (per the video) the actual form fields update live behind the chat panel.

**Implications for the plan:**
- The chat flow is not just "one-shot extract" + "read-only Q&A afterward" — it's a **multi-turn, stateful editing loop**. Every chat turn must: (a) know the current draft form state, (b) figure out whether the message is a correction/delta vs. a brand-new complaint vs. a question, (c) merge only the changed fields into state, (d) confirm back exactly what changed (not a full re-summary).
- This changes the LangGraph design: rather than a single one-shot `extract_fields` node that only runs once per document, need something like a **persistent per-draft state** (keyed by a draft/session id, not yet a saved `complaint_id`) that every chat turn reads and patches. Likely re-enter the same graph on each turn with `current_fields` as part of the input state, and have `extract_fields` behave as an *upsert* (merge deltas) rather than overwrite-from-scratch — an LLM call with a prompt like "here is the current form state as JSON, here is the new user message, return only the fields that should change."
- Confirmation message pattern is precise/itemized ("I have updated X to Y and Z to W"), not generic — worth mirroring that specificity in the prompt design so answers read as trustworthy/auditable, which matters a lot in a QMS/compliance context.
- Frontend: `chatSlice`/`extractionSlice` need to reconcile — a chat-driven field update should dispatch the same action that updates `complaintFormSlice` as a manual edit would, so the form and chat never disagree.

### Observation 6 — PDF attached directly in the chat input, extracted the same way

User attaches a PDF (`Fictional_Pharma_Customer_C...pdf`) via the paperclip icon on the same chat input used for text messages — confirms the chat input itself is a file-attachment surface, not just a text box (the separate dropzone from Observation 1 may just be a bigger/alternate entry point to the same channel). Copilot responds: *"PDF analysis complete. I've successfully extracted the Zenith Life Sciences complaint report (CC-2026-00154). The issue is foreign matter contamination in the Metformin API drum. Form populated on the left."*

New details this reveals:
- **Complaint reference number** is a real field: format looks like `CC-2026-00154` (prefix + year + zero-padded sequence). Need a `complaint_reference_number` column, likely auto-generated on intake (not user-entered) — open question below on exactly when/how it's assigned.
- Products aren't only FDF (capsules/tablets) — this sample is a raw **API** complaint: "Metformin API drum," i.e. the affected quantity/unit can be container-based (drum) rather than dosage-based (capsules). Form/schema should treat `quantity_affected` as free text with a unit, not a fixed enum, and product identification should stay generic enough to cover both API and FDF products (matches the assignment's "API & FDF Quality Assurance Module" subtitle).
- New complaint type example: **"foreign matter contamination"** (vs. earlier "discolored capsules") — confirms `complaint_type`/description is open-ended defect language, not a small fixed enum; good to have several distinct sample complaint types in the sample-data set.
- Confirmation-message pattern differs by intake type: a **full document extraction** gets a short narrative summary (complaint ref + customer + issue, as here and in Observation 1), while a **targeted correction** (Observation 5) gets an itemized "I updated X to Y" reply. Worth designing two distinct response templates/prompts for these two chat intents rather than one generic one.
- **Confirmed general, not one-off**: the correction capability from Observation 5 applies regardless of how the complaint was originally created — whether the form was filled from pasted text, a PDF upload, or an EML, the user must still be able to send a follow-up chat message at any point to correct/patch any field, and get it reflected live in the form. So the "read current draft state → detect correction vs new-intake vs question → merge deltas" chat behavior (Observation 5) is the general rule for every chat turn, independent of intake channel — not a special case only for the text-paste flow.

### Observation 7 — The assignment PDF's own reference screenshot gives the complete, unambiguous field list

Unlike the video screenshots (which cut off before showing all sections), the assignment document's static mock (page 3) shows the full form uninterrupted. Treat this as the authoritative field list — it resolves several open items below.

**Full section/field list from this mock:**
1. **Origin & Customer Details** — Complaint Source, Customer Name
2. **Product & Batch Identification** — Product Name, Product Strength/Grade, Batch/Lot Number, Manufacturing Date, Expiry Date, Quantity Affected (has a distinct unit suffix field, e.g. "kg" shown as its own small input next to the quantity)
3. **Complaint Details** — Complaint Type, Complaint Date, Detailed Complaint Description (multi-line)
4. **Initial Assessment & Priority** — Initial Severity (dropdown), Priority (dropdown)

Buttons: **Reset Form**, **Save Complaint**. Status badge here reads **"Pending Triage"** (yellow).

Right panel in this mock is branded **"AI Complaint Intake Assistant"** with a **BETA** tag (sparkle icon, not the video's flask/"AIVOA Copilot" branding) — simpler than the video's unified copilot:
- Drag & drop zone, **OR** a separate **"Paste Complaint Text / Email"** button
- Helper text: *"Supported formats: PDF, DOCX, TXT, EML. Max file size: 10MB"*
- **Extraction progress bar with a live percentage** (shown at 10%) plus status line: *"Analyzing document content and extracting key details... Please wait, this may take a few moments."*
- Assistant message: *"Upload a complaint document or paste text above. I will automatically extract the details and populate the form for you."*
- Chat input: *"Ask me anything about this complaint..."*
- Disclaimer footer: *"AI responses may contain errors. Please verify information."*

**Reconciling this with the video (which is functionally authoritative per the assignment's own "UI doesn't need to match the screenshot exactly, but the demonstrated functionality should be implemented" rule):**
- **Section 3 naming resolved (practically)**: the video's "Facility & Material Impact" is most plausibly a relabeled/expanded version of this mock's "Complaint Details" section (same position, section index 3) rather than an entirely separate additional section — adopt this mock's concrete fields (Complaint Type, Complaint Date, Detailed Complaint Description) as the schema baseline for section 3, keep the `fields` column flexible (jsonb) in case the real instructor build added facility-specific fields (e.g. manufacturing site, storage conditions) on top.
- **Quantity Affected has a real unit sub-field** in this mock (separate "kg" input), which is a more structured design than the pure free-text string implied by the video's chat replies ("Affected Quantity to '48 capcules'"). Resolve by storing it as **two sub-values**: `quantity_affected_amount` (number) + `quantity_affected_unit` (free text, e.g. "kg", "capsules", "drum") — gives the structured-mock's UI shape while still letting the chat parse a natural-language amount+unit out of free text and fill both.
- **Severity enum hint**: the AI risk-assessment card in the video showed a suggested severity value of `"Major"` (Observation 4) — pharma/GMP risk classifications conventionally use **Minor / Major / Critical**, not Low/Medium/High/Critical. Adopt `Minor | Major | Critical` for both `initial_severity` (the dropdown on the form) and the AI-suggested severity, so the user-editable dropdown and the AI suggestion use the same enum.
- **UX details worth keeping regardless of which chat design wins**: the supported-formats/max-size helper text, a real percentage-driven extraction progress bar with a status line, and the "AI responses may contain errors, please verify" disclaimer — good, cheap trust-building details for a compliance tool, worth including even though the actual copilot panel design follows the video's unified-chat approach rather than this mock's separate drag-drop/paste-button layout.

---

## Open questions
- ~~What is section 3 "Facility & Material Impact" and what sections come after it?~~ → **Resolved by Observation 7**: adopt the mock's "Complaint Details" fields (Complaint Type, Complaint Date, Detailed Complaint Description) as the baseline; video's relabeling is cosmetic/expanded, not a new section.
- ~~Does the "initial risk assessment" mentioned in the copilot's confirmation message happen automatically on every intake, or only on request?~~ → Treated as automatic per Observation 4/6 (generated as part of every successful extraction/correction that leaves the draft complete-enough).
- ~~Is there a separate "Save/Commit" action distinct from the chat parsing?~~ → **Resolved by Observation 4**: yes, "Commit to QMS Ledger" is the save action, distinct from AI parsing/risk-assessment generation.
- What are the full list of status values (state machine)? Still only have two data points: "Pending Triage" (this mock) and "Ready to Commit" (video) — treating these as two different points in the draft-stage lifecycle (`pending_triage → ... → ready_to_commit`), not contradictory. Post-commit lifecycle values still unconfirmed — assumed `logged/in_review/closed` as a reasonable QMS convention.
- ~~Can the QA reviewer edit/override the AI-suggested severity, next action, and risk assessment text before committing?~~ → **Answered by user (2026-07-24)**: yes, editable. The AI Risk Assessment card fields (severity, next action, risk narrative) must be rendered as normal editable inputs pre-filled with the AI's suggestion, not read-only text — the user can overwrite any of them before hitting "Commit to QMS Ledger."
- Does "Suggested Next Action" come from a fixed enum or free-text LLM output? → **User confirmed this is never shown/mentioned in the source material** (assignment doc or video) — no evidence either way. Design decision: treat it as **free-text LLM output** (a short actionable phrase like "Route to QA Investigation & Issue Replacement"), since nothing constrains it to an enum and free text is simpler to generate and still editable by the reviewer per the point above. Revisit only if graders/interviewers expect a fixed routing taxonomy.
