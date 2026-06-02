import { useState } from "react";

// ---------------------------------------------------------------
// CONFIGURE: Replace with your own API Gateway Invoke URL
// Format: https://XXXXXXXXXX.execute-api.REGION.amazonaws.com/prod/analyze
// ---------------------------------------------------------------
const API_URL = "https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/analyze";

interface Props {
  setFeedback: (f: any) => void;
  setLoading: (l: boolean) => void;
}

export default function UploadForm({ setFeedback, setLoading }: Props) {
  const [docType, setDocType] = useState<"resume" | "cover_letter">("resume");
  const [file, setFile] = useState<File | null>(null);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) {
      setFile(picked);
      setError(null);
    }
  }

  async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const pdf_base64 = await toBase64(file);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_base64,
          document_type: docType,
          student_id: studentId || "anonymous",
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Server error");
      }

      const feedback = await response.json();
      setFeedback(feedback);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="tabs">
        <button
          className={`tab ${docType === "resume" ? "active" : ""}`}
          onClick={() => setDocType("resume")}
        >
          Resume
        </button>
        <button
          className={`tab ${docType === "cover_letter" ? "active" : ""}`}
          onClick={() => setDocType("cover_letter")}
        >
          Cover letter
        </button>
      </div>

      <label
        className={`upload-zone ${file ? "has-file" : ""}`}
        htmlFor="file-input"
        style={{ display: "block" }}
      >
        <p style={{ fontWeight: 500, marginBottom: 4 }}>
          {file ? file.name : "Drop your PDF here"}
        </p>
        <span>{file ? "Click to change file" : "PDF only, max 5 MB"}</span>
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </label>

      <div className="field-label">Student ID (optional)</div>
      <input
        className="text-input"
        type="text"
        placeholder="e.g. STU-2024-001"
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
      />

      {error && (
        <div style={{
          background: "#fff0f0",
          border: "0.5px solid #ffcccc",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          color: "#cc0000",
          marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      <button
        className="submit-btn"
        onClick={handleSubmit}
        disabled={!file}
      >
        Analyze my resume
      </button>
    </div>
  );
}
