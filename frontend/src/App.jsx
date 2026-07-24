import "./App.css";
import ComplaintForm from "./components/ComplaintForm";
import CopilotPanel from "./components/CopilotPanel";

function App() {
  return (
    <div className="app-layout">
      <ComplaintForm />
      <CopilotPanel />
    </div>
  );
}

export default App;
