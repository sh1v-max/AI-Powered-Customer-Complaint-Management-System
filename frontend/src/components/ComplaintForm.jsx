import { useSelector } from "react-redux";

const STATUS_LABELS = {
  pending_triage: "Pending Triage",
  extracting: "Extracting...",
  needs_info: "Needs Info",
  ready_to_commit: "Ready to Commit",
  committed: "Committed",
};

export default function ComplaintForm() {
  const { fields, status, riskAssessment } = useSelector((state) => state.draft);

  return (
    <section className="complaint-form">
      <header className="complaint-form__header">
        <div>
          <h1>Log Customer Complaint</h1>
          <p className="complaint-form__subtitle">API & FDF Quality Assurance Module</p>
        </div>
        <span className={`status-badge status-badge--${status}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </header>

      <fieldset>
        <legend>1. Origin & Customer Details</legend>
        <label>
          Complaint Source
          <input value={fields.complaint_source ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Customer Name
          <input value={fields.customer_name ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
      </fieldset>

      <fieldset>
        <legend>2. Product & Batch Identification</legend>
        <label>
          Product Name
          <input value={fields.product_name ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Product Strength/Grade
          <input value={fields.product_strength_grade ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Batch/Lot Number
          <input value={fields.batch_lot_number ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Manufacturing Date
          <input value={fields.manufacturing_date ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Expiry Date
          <input value={fields.expiry_date ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Quantity Affected
          <input value={fields.quantity_affected_amount ?? ""} readOnly placeholder="Amount" />
          <input value={fields.quantity_affected_unit ?? ""} readOnly placeholder="Unit" />
        </label>
      </fieldset>

      <fieldset>
        <legend>3. Complaint Details</legend>
        <label>
          Complaint Type
          <input value={fields.complaint_type ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Complaint Date
          <input value={fields.complaint_date ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Detailed Complaint Description
          <textarea value={fields.description ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
      </fieldset>

      <fieldset>
        <legend>4. Initial Assessment & Priority</legend>
        <label>
          Initial Severity
          <select value={fields.initial_severity ?? ""} disabled>
            <option value="">Awaiting AI extraction...</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
            <option value="Critical">Critical</option>
          </select>
        </label>
      </fieldset>

      <div className="ai-risk-assessment-card">
        <h2>AI copilot risk assessment</h2>
        <label>
          Severity (Suggested)
          <input value={riskAssessment.severitySuggested ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Suggested Next Action
          <input value={riskAssessment.suggestedNextAction ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
        <label>
          Initial Risk Assessment
          <textarea value={riskAssessment.initialRiskAssessment ?? ""} readOnly placeholder="Awaiting AI extraction..." />
        </label>
      </div>

      <button type="button" className="commit-button" disabled>
        Commit to QMS Ledger
      </button>
    </section>
  );
}
