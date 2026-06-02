import "./styles.css";
import { useState } from "react";
import UploadForm from "./components/UploadForm";
import FeedbackPanel from "./components/FeedbackPanel";

export default function App() {
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>CTE Resume Analyzer</h1>
        <p>AI-powered feedback for student resumes & cover letters</p>
      </header>
      <main className="app-main">
        <UploadForm setFeedback={setFeedback} setLoading={setLoading} />
        {loading && <p className="loading-text">Analyzing your document...</p>}
        {feedback && <FeedbackPanel feedback={feedback} />}
      </main>
    </div>
  );
}
