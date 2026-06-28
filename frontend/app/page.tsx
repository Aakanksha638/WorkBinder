// page.tsx
// This is the entire WorkBindr frontend
// One page with three features:
// 1. Ask the AI a question
// 2. Upload a document  
// 3. See full history from MORK

// "use client" tells Next.js this page runs in the browser
// not on the server — we need this because we're using
// React hooks (useState) which only work in the browser
"use client";

// useState = a way to store and update information on the page
// without refreshing. Like a variable that the page 
// automatically redraws when it changes
import { useState } from "react";

// ─────────────────────────────────────────────
// The Main Page Component
// ─────────────────────────────────────────────

export default function Home() {

  // ── State Variables ──────────────────────
  // Think of these like variables that are
  // "remembered" by the page between actions
  // When any of these change, the page automatically redraws

  // For the chat/query section
  const [question, setQuestion] = useState("");
  // "" = starts as empty text
  // setQuestion = the function to change it

  const [answer, setAnswer] = useState("");
  const [queryId, setQueryId] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  // false = not loading yet

  // For the document upload section
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docResult, setDocResult] = useState("");
  const [docLoading, setDocLoading] = useState(false);

  // For the history section
  const [history, setHistory] = useState<string[]>([]);
  // string[] = a list of text strings
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // For delete document section
  const [deleteId, setDeleteId] = useState("");
  const [deleteResult, setDeleteResult] = useState("");

  // ── Function 1: Ask the AI ───────────────
  // This runs when the user clicks "Ask" button
  // "async" because we wait for the backend to respond
  const handleQuery = async () => {

    // Don't do anything if the box is empty
    if (!question.trim()) return;

    // Show loading spinner
    setQueryLoading(true);
    setAnswer("");

    try {
      // fetch() = send a request to our Rust backend
      // This is the same as the PowerShell command we used before
      // just written in JavaScript instead
      const response = await fetch("http://127.0.0.1:8000/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query_text: question,
        }),
      });

      // Convert the response from JSON into a JavaScript object
      const data = await response.json();

      // Update our state variables with the results
      // This automatically redraws the page with new content
      setAnswer(data.message);
      setQueryId(data.query_id);

    } catch (error) {
      setAnswer("Error connecting to WorkBindr backend. Is your Rust server running?");
    }

    // Hide loading spinner
    setQueryLoading(false);
  };

  // ── Function 2: Upload a Document ────────
  const handleAddDocument = async () => {
    if (!docTitle.trim() || !docContent.trim()) return;

    setDocLoading(true);
    setDocResult("");

    try {
      const response = await fetch("http://127.0.0.1:8000/add_document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: docTitle,
          content: docContent,
        }),
      });

      const data = await response.json();
      setDocResult(data.message);

    } catch (error) {
      setDocResult("Error connecting to backend.");
    }

    setDocLoading(false);
  };

  // ── Function 3: Delete a Document ────────
  const handleDeleteDocument = async () => {
    if (!deleteId.trim()) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/delete_document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doc_id: deleteId,
        }),
      });

      const data = await response.json();
      setDeleteResult(data.message);

    } catch (error) {
      setDeleteResult("Error connecting to backend.");
    }
  };

  // ── Function 4: Load History ─────────────
  const handleHistory = async () => {
    setHistoryLoading(true);
    setShowHistory(true);

    try {
      // GET request — no body needed, just asking for data
      const response = await fetch("http://127.0.0.1:8000/history");
      const data = await response.json();
      setHistory(data.events);

    } catch (error) {
      setHistory(["Error connecting to backend."]);
    }

    setHistoryLoading(false);
  };

  // ── The Visual Page Layout ───────────────
  // Everything below is what the user actually SEES
  // Tailwind CSS classes handle all the styling
  // (bg-gray-900 = dark background, text-white = white text, etc.)
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">

      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold text-blue-400 mb-2">
            WorkBindr
          </h1>
          <p className="text-gray-400 text-lg">
            Your Decentralized AI Business OS
          </p>
          <div className="mt-2 text-xs text-gray-600">
            Powered by Rust + MORK + Groq AI
          </div>
        </div>

        {/* ── Section 1: Ask the AI ── */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-blue-300 mb-4">
            🤖 Ask the AI
          </h2>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              // Allow pressing Enter to submit
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="Ask anything... e.g. What is my revenue this month?"
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 
                         border border-gray-700 focus:outline-none 
                         focus:border-blue-500 placeholder-gray-500"
            />
            <button
              onClick={handleQuery}
              disabled={queryLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                         text-white font-semibold px-6 py-3 rounded-xl
                         transition-colors duration-200"
            >
              {queryLoading ? "Thinking..." : "Ask"}
            </button>
          </div>

          {/* Show the AI's answer */}
          {answer && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-xs text-gray-500 mb-2">
                Query ID: {queryId} — recorded permanently in MORK
              </div>
              <p className="text-green-300 leading-relaxed">{answer}</p>
            </div>
          )}
        </div>

        {/* ── Section 2: Upload Document ── */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-blue-300 mb-4">
            📄 Upload a Document
          </h2>

          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="Document title e.g. Q4 Financial Report"
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 
                       border border-gray-700 focus:outline-none 
                       focus:border-blue-500 placeholder-gray-500 mb-3"
          />

          <textarea
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Document content... paste your text here"
            rows={4}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 
                       border border-gray-700 focus:outline-none 
                       focus:border-blue-500 placeholder-gray-500 mb-3"
          />

          <button
            onClick={handleAddDocument}
            disabled={docLoading}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700
                       text-white font-semibold px-6 py-3 rounded-xl
                       transition-colors duration-200"
          >
            {docLoading ? "Uploading..." : "Upload Document"}
          </button>

          {/* Show upload result + doc_id */}
          {docResult && (
            <div className="mt-3 bg-gray-800 rounded-xl p-4 border border-green-800">
              <p className="text-green-300 text-sm">{docResult}</p>
            </div>
          )}
        </div>

        {/* ── Section 3: Delete Document ── */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-blue-300 mb-4">
            🗑️ Delete a Document
          </h2>

          <div className="flex gap-3">
            <input
              type="text"
              value={deleteId}
              onChange={(e) => setDeleteId(e.target.value)}
              placeholder="Paste doc_id here e.g. id_1782495472230"
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 
                         border border-gray-700 focus:outline-none 
                         focus:border-red-500 placeholder-gray-500"
            />
            <button
              onClick={handleDeleteDocument}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold 
                         px-6 py-3 rounded-xl transition-colors duration-200"
            >
              Delete
            </button>
          </div>

          {deleteResult && (
            <div className="mt-3 bg-gray-800 rounded-xl p-4 border border-red-800">
              <p className="text-red-300 text-sm">{deleteResult}</p>
            </div>
          )}
        </div>

        {/* ── Section 4: MORK History ── */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-blue-300">
              📚 MORK History
            </h2>
            <button
              onClick={handleHistory}
              className="bg-purple-600 hover:bg-purple-500 text-white 
                         font-semibold px-4 py-2 rounded-xl 
                         transition-colors duration-200 text-sm"
            >
              {historyLoading ? "Loading..." : "Refresh History"}
            </button>
          </div>

          {showHistory && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-gray-500 text-sm">No events recorded yet.</p>
              ) : (
                history.map((event, index) => (
                  <div
                    key={index}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700
                               font-mono text-xs text-gray-300"
                  >
                    #{index + 1}: {event}
                  </div>
                ))
              )}
              <div className="text-gray-500 text-xs pt-2">
                Total events: {history.length}
              </div>
            </div>
          )}

          {!showHistory && (
            <p className="text-gray-600 text-sm">
              Click "Refresh History" to see all events ever recorded in MORK
            </p>
          )}
        </div>

      </div>
    </main>
  );
}