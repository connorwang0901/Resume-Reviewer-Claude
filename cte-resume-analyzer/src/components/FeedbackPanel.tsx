interface Dimension {
  score: number;
  comment: string;
}

interface Feedback {
  document_type: string;
  overall_score: number;
  dimensions: Record<string, Dimension>;
  suggestions: string[];
  encouragement: string;
  audio_base64?: string;
  session_id?: string;
}

interface Props {
  feedback: Feedback;
}

function scoreLevel(s: number) {
  if (s >= 8) return "high";
  if (s >= 6) return "med";
  return "low";
}

const DIM_LABELS: Record<string, string> = {
  clarity:       "Clarity",
  action_verbs:  "Action verbs",
  cte_relevance: "CTE relevance",
  formatting:    "Formatting",
  completeness:  "Completeness",
};

export default function FeedbackPanel({ feedback }: Props) {
  if (!feedback.dimensions) {
    return (
      <div className="card">
        <p style={{ color: "#cc0000", fontSize: 14 }}>
          Error: Could not parse feedback. Please try again.
        </p>
        <pre style={{ fontSize: 11, color: "#888", marginTop: 8, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(feedback, null, 2)}
        </pre>
      </div>
    );
  }

  const audioUrl = feedback.audio_base64
    ? `data:audio/mpeg;base64,${feedback.audio_base64}`
    : null;

  return (
    <div className="card">
      <div className="feedback-header">
        <h2>Your feedback</h2>
        <span className="badge">
          {feedback.document_type === "resume" ? "Resume" : "Cover letter"}
        </span>
      </div>

      <div className="score-grid">
        <div className="score-card">
          <div className="label">Overall score</div>
          <div className="value">{feedback.overall_score}</div>
          <div className="sub">out of 10</div>
        </div>
        <div className="score-card">
          <div className="label">Submitted</div>
          <div className="value" style={{ fontSize: 16, paddingTop: 6 }}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          <div className="sub">
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      <div className="section-title">Dimension scores</div>
      <div className="dim-list">
        {Object.entries(feedback.dimensions).map(([key, dim]) => {
          const level = scoreLevel(dim.score);
          return (
            <div className="dim-card" key={key}>
              <div className="dim-top">
                <span className="dim-name">{DIM_LABELS[key] ?? key}</span>
                <span className={`dim-score ${level}`}>{dim.score} / 10</span>
              </div>
              <div className="bar-bg">
                <div
                  className={`bar-fill ${level}`}
                  style={{ width: `${dim.score * 10}%` }}
                />
              </div>
              <div className="dim-comment">{dim.comment}</div>
            </div>
          );
        })}
      </div>

      <div className="section-title">Suggestions</div>
      <div className="suggestions-box">
        {feedback.suggestions.map((s, i) => (
          <div className="suggestion-item" key={i}>
            <span className="sug-num">{i + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="encouragement-box">
        <div className="enc-title">Encouragement</div>
        <p>{feedback.encouragement}</p>
      </div>

      {audioUrl && (
        <div style={{ marginTop: 8 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Audio feedback</div>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
        </div>
      )}

      {feedback.session_id && (
        <div style={{ marginTop: 12, fontSize: 11, color: "#aaa", textAlign: "right" }}>
          Session: {feedback.session_id}
        </div>
      )}
    </div>
  );
}
