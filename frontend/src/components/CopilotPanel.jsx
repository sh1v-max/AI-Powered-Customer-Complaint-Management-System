import { useState } from "react";
import { useSelector } from "react-redux";

export default function CopilotPanel() {
  const { chatMessages, sending } = useSelector((state) => state.draft);
  const [draftMessage, setDraftMessage] = useState("");

  return (
    <aside className="copilot-panel">
      <header className="copilot-panel__header">
        <h2>AIVOA Copilot</h2>
        <p>Drop complaint files or paste text below.</p>
      </header>

      <div className="copilot-panel__feed">
        {chatMessages.length === 0 && (
          <div className="chat-bubble chat-bubble--assistant">
            Ready to process new complaints. You can paste the raw email from the customer, or
            attach a PDF/DOCX/EML of the complaint report.
          </div>
        )}
        {chatMessages.map((message, index) => (
          <div key={index} className={`chat-bubble chat-bubble--${message.role}`}>
            {message.content}
          </div>
        ))}
        {sending && <div className="chat-bubble chat-bubble--assistant">Thinking...</div>}
      </div>

      <form className="copilot-panel__input" onSubmit={(event) => event.preventDefault()}>
        <label className="attach-button" title="Attach a complaint document">
          📎
          <input type="file" accept=".pdf,.docx,.txt,.eml" hidden />
        </label>
        <input
          type="text"
          placeholder="Type a message or paste a complaint..."
          value={draftMessage}
          onChange={(event) => setDraftMessage(event.target.value)}
        />
        <button type="submit">➤</button>
      </form>
      <p className="copilot-panel__footer">Powered by LangGraph</p>
    </aside>
  );
}
