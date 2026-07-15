"use client";

import { useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Employee {
  emp_id: string;
  name: string;
  department: string;
  role: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  department?: string;
}

// ─────────────────────────────────────────────
// Department Colors
// Each department gets its own color badge
// ─────────────────────────────────────────────

const deptColors: Record<string, string> = {
  HR:          "bg-pink-600",
  Finance:     "bg-green-600",
  Legal:       "bg-yellow-600",
  Engineering: "bg-blue-600",
  CEO:         "bg-purple-600",
  Unknown:     "bg-gray-600",
};

const deptIcons: Record<string, string> = {
  HR:          "👥",
  Finance:     "💰",
  Legal:       "⚖️",
  Engineering: "⚙️",
  CEO:         "👑",
  Unknown:     "❓",
};

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function Home() {

  // ── Login State ──────────────────────────
  const [empIdInput, setEmpIdInput] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Chat State ───────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);

  // ── Document State ───────────────────────
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docResult, setDocResult] = useState("");
  const [docLoading, setDocLoading] = useState(false);

  // ── Delete State ─────────────────────────
  const [deleteId, setDeleteId] = useState("");
  const [deleteResult, setDeleteResult] = useState("");

  // ── History State ────────────────────────
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Active Tab ───────────────────────────
  const [activeTab, setActiveTab] = useState<"chat" | "docs" | "history">("chat");

  // ─────────────────────────────────────────
  // Login Function
  // ─────────────────────────────────────────

  const handleLogin = async () => {
    if (!empIdInput.trim()) return;
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/employee/${empIdInput.trim()}`
      );
      const data: Employee = await response.json();

      if (data.role === "Employee not found") {
        setLoginError(
          `❌ Employee ID '${empIdInput}' not found. Please check your ID.`
        );
      } else {
        setEmployee(data);
        // Welcome message in chat
        setMessages([{
          role: "system",
          content: `Welcome ${data.name}! You're logged in as ${data.role} in the ${data.department} department. You can only access ${data.department} documents.`,
        }]);
      }
    } catch {
      setLoginError("❌ Cannot connect to WorkBindr server. Is it running?");
    }

    setLoginLoading(false);
  };

  // ─────────────────────────────────────────
  // Ask AI Function
  // ─────────────────────────────────────────

  const handleQuery = async () => {
    if (!question.trim() || !employee) return;

    // Add user message to chat
    const userMessage: Message = {
      role: "user",
      content: question,
    };
    setMessages(prev => [...prev, userMessage]);
    setQuestion("");
    setQueryLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          query_text: question,
        }),
      });

      const data = await response.json();

      // Add AI response to chat
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message,
        department: data.department,
      }]);

    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Error connecting to backend. Is the Rust server running?",
      }]);
    }

    setQueryLoading(false);
  };

  // ─────────────────────────────────────────
  // Upload Document Function
  // ─────────────────────────────────────────

  const handleAddDocument = async () => {
    if (!docTitle.trim() || !docContent.trim() || !employee) return;
    setDocLoading(true);
    setDocResult("");

    try {
      const response = await fetch("http://127.0.0.1:8000/add_document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          title: docTitle,
          content: docContent,
        }),
      });

      const data = await response.json();
      setDocResult(data.message);
      setDocTitle("");
      setDocContent("");

    } catch {
      setDocResult("❌ Error connecting to backend.");
    }

    setDocLoading(false);
  };

  // ─────────────────────────────────────────
  // Delete Document Function
  // ─────────────────────────────────────────

  const handleDeleteDocument = async () => {
    if (!deleteId.trim() || !employee) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/delete_document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          doc_id: deleteId,
        }),
      });

      const data = await response.json();
      setDeleteResult(data.message);
      setDeleteId("");

    } catch {
      setDeleteResult("❌ Error connecting to backend.");
    }
  };

  // ─────────────────────────────────────────
  // Load History Function
  // ─────────────────────────────────────────

  const handleHistory = async () => {
    setHistoryLoading(true);
    setShowHistory(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/history");
      const data = await response.json();
      setHistory(data.events);
    } catch {
      setHistory(["❌ Error connecting to backend."]);
    }

    setHistoryLoading(false);
  };

  // ─────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────

  const handleLogout = () => {
    setEmployee(null);
    setMessages([]);
    setEmpIdInput("");
    setDocResult("");
    setDeleteResult("");
    setHistory([]);
    setShowHistory(false);
    setActiveTab("chat");
  };

  // ─────────────────────────────────────────
  // RENDER — Login Screen
  // ─────────────────────────────────────────

  if (!employee) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-blue-400 mb-2">
              WorkBindr
            </h1>
            <p className="text-gray-400">
              Enterprise AI Business OS
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Powered by Rust + MORK + Groq AI
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">
              🔐 Employee Login
            </h2>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">
                Employee ID
              </label>
              <input
                type="text"
                value={empIdInput}
                onChange={(e) => setEmpIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter your Employee ID e.g. 0001"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                           border border-gray-700 focus:outline-none
                           focus:border-blue-500 placeholder-gray-500
                           text-center text-lg tracking-widest"
              />
            </div>

            {loginError && (
              <div className="mb-4 bg-red-900/30 border border-red-700
                              rounded-xl p-3 text-red-300 text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full bg-blue-600 hover:bg-blue-500
                         disabled:bg-gray-700 text-white font-semibold
                         py-3 rounded-xl transition-colors duration-200"
            >
              {loginLoading ? "Verifying..." : "Login →"}
            </button>

            {/* Demo Employee IDs */}
            <div className="mt-6 border-t border-gray-800 pt-4">
              <p className="text-gray-500 text-xs text-center mb-3">
                Demo Employee IDs
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "0000", label: "👑 CEO" },
                  { id: "0001", label: "👥 HR" },
                  { id: "0003", label: "💰 Finance" },
                  { id: "0005", label: "⚖️ Legal" },
                  { id: "0007", label: "⚙️ Eng" },
                  { id: "0002", label: "👥 HR Jr" },
                ].map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setEmpIdInput(emp.id)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300
                               text-xs py-2 px-3 rounded-lg transition-colors
                               border border-gray-700"
                  >
                    {emp.label}
                    <span className="block text-gray-500">{emp.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────
  // RENDER — Main App (After Login)
  // ─────────────────────────────────────────

  const deptColor = deptColors[employee.department] || "bg-gray-600";
  const deptIcon = deptIcons[employee.department] || "❓";

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── Top Navigation Bar ── */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">

          {/* Logo */}
          <h1 className="text-2xl font-bold text-blue-400">
            WorkBindr
          </h1>

          {/* Employee Badge */}
          <div className="flex items-center gap-3">
            <div className={`${deptColor} px-3 py-1 rounded-full text-xs font-semibold`}>
              {deptIcon} {employee.department}
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">
                {employee.name}
              </div>
              <div className="text-gray-500 text-xs">
                {employee.role} • ID: {employee.emp_id}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400
                         text-xs px-3 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ── Tab Navigation ── */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: "chat", label: "🤖 AI Chat" },
              { id: "docs", label: "📄 Documents" },
              { id: "history", label: "📚 MORK History" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "chat" | "docs" | "history")}
                className={`px-4 py-3 text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ── Tab 1: AI Chat ── */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[calc(100vh-220px)]">

            {/* Permission Banner */}
            <div className={`${deptColor} bg-opacity-20 border 
                            border-opacity-30 rounded-xl p-3 mb-4
                            flex items-center gap-2`}>
              <span>{deptIcon}</span>
              <span className="text-sm text-gray-300">
                You are in <strong>{employee.department}</strong> department.
                You can only access <strong>{employee.department}</strong> documents.
                {employee.department === "CEO" && " As CEO, you have access to all departments."}
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.role === "system"
                      ? "bg-gray-800 text-gray-300 text-sm italic"
                      : "bg-gray-800 text-gray-100"
                  }`}>
                    {msg.role === "assistant" && (
                      <div className="text-xs text-gray-500 mb-1">
                        🤖 WorkBindr AI
                        {msg.department && (
                          <span className={`ml-2 ${deptColor} 
                                          text-white px-2 py-0.5 
                                          rounded-full text-xs`}>
                            {msg.department}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}

              {queryLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="text-gray-400 text-sm">
                      🤖 Thinking...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder={`Ask anything as ${employee.name}...`}
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
                {queryLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab 2: Documents ── */}
        {activeTab === "docs" && (
          <div className="space-y-6">

            {/* Upload Document */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-blue-300 mb-2">
                📄 Upload Document
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Documents you upload will be automatically tagged to
                <span className={`ml-1 ${deptColor} text-white 
                                  px-2 py-0.5 rounded-full text-xs`}>
                  {deptIcon} {employee.department}
                </span>
              </p>

              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document title"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                           border border-gray-700 focus:outline-none
                           focus:border-blue-500 placeholder-gray-500 mb-3"
              />

              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Document content..."
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
                {docLoading ? "Uploading..." : `Upload to ${employee.department}`}
              </button>

              {docResult && (
                <div className="mt-3 bg-gray-800 rounded-xl p-4
                                border border-green-800">
                  <p className="text-green-300 text-sm">{docResult}</p>
                </div>
              )}
            </div>

            {/* Delete Document */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-blue-300 mb-4">
                🗑️ Delete Document
              </h2>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={deleteId}
                  onChange={(e) => setDeleteId(e.target.value)}
                  placeholder="Paste doc_id here"
                  className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3
                             border border-gray-700 focus:outline-none
                             focus:border-red-500 placeholder-gray-500"
                />
                <button
                  onClick={handleDeleteDocument}
                  className="bg-red-600 hover:bg-red-500 text-white
                             font-semibold px-6 py-3 rounded-xl
                             transition-colors duration-200"
                >
                  Delete
                </button>
              </div>

              {deleteResult && (
                <div className="mt-3 bg-gray-800 rounded-xl p-4
                                border border-red-800">
                  <p className="text-red-300 text-sm">{deleteResult}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 3: MORK History ── */}
        {activeTab === "history" && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-blue-300">
                📚 MORK Event History
              </h2>
              <button
                onClick={handleHistory}
                className="bg-purple-600 hover:bg-purple-500 text-white
                           font-semibold px-4 py-2 rounded-xl
                           transition-colors duration-200 text-sm"
              >
                {historyLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {!showHistory && (
              <p className="text-gray-600 text-sm">
                Click Refresh to see all events ever recorded in MORK
              </p>
            )}

            {showHistory && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-gray-500 text-sm">No events yet.</p>
                ) : (
                  history.map((event, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 rounded-lg p-3
                                 border border-gray-700 font-mono
                                 text-xs text-gray-300"
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
          </div>
        )}
      </div>
    </main>
  );
}