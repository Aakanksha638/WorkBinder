"use client";

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Employee {
  emp_id: string;
  name: string;
  department: string;
  role: string;
}

interface Task {
  task_id: string;
  title: string;
  description: string;
  priority: string;
  priority_emoji: string;
  status: string;
  status_emoji: string;
  created_by: string;
  assigned_to: string;
  department: string;
  created_at: number;
  updated_at: number;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  department?: string;
}

interface Notification {
  notification_id: string;
  emp_id: string;
  notification_type: string;
  emoji: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: number;
  related_id: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const API = "http://127.0.0.1:8000";

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

const priorityColors: Record<string, string> = {
  Low:    "border-green-600 text-green-400",
  Medium: "border-yellow-600 text-yellow-400",
  High:   "border-red-600 text-red-400",
  Urgent: "border-red-400 text-red-300 animate-pulse",
};

const statusColors: Record<string, string> = {
  Todo:       "bg-gray-700 text-gray-300",
  InProgress: "bg-blue-700 text-blue-200",
  Done:       "bg-green-700 text-green-200",
};

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function Home() {

  // ── Auth State ───────────────────────────
  const [empIdInput, setEmpIdInput]   = useState("");
  const [employee, setEmployee]       = useState<Employee | null>(null);
  const [loginError, setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);


  // ── Tab State ────────────────────────────
const [activeTab, setActiveTab] = useState<"chat" | "tasks" | "docs" | "history" | "admin">("chat");
  // ── Chat State ───────────────────────────
  const [messages, setMessages]       = useState<Message[]>([]);
  const [question, setQuestion]       = useState("");
  const [queryLoading, setQueryLoading] = useState(false);

  // ── Task State ───────────────────────────
  const [myTasks, setMyTasks]         = useState<Task[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks]       = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskView, setTaskView]       = useState<"mine" | "created" | "all">("mine");

  // Create task form
  const [newTaskTitle, setNewTaskTitle]   = useState("");
  const [newTaskDesc, setNewTaskDesc]     = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [taskResult, setTaskResult]       = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);

  // ── Document State ───────────────────────
  const [docTitle, setDocTitle]     = useState("");
  const [docContent, setDocContent] = useState("");
  const [docResult, setDocResult]   = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [deleteId, setDeleteId]     = useState("");
  const [deleteResult, setDeleteResult] = useState("");

  // ── History State ────────────────────────
  const [history, setHistory]         = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── Notification State ───────────────────
  const [unreadCount, setUnreadCount]         = useState(0);
  const [notifications, setNotifications]     = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifLoading, setNotifLoading]       = useState(false);

  // ─────────────────────────────────────────
  // Load tasks when tab opens
  // ─────────────────────────────────────────

  useEffect(() => {
    if (activeTab === "tasks" && employee) {
      loadTasks();
    }
  }, [activeTab, employee]);

  // Poll for unread notifications every 10 seconds
  useEffect(() => {
    if (!employee) return;

    // Check immediately on login
    checkUnread();

    // Then check every 10 seconds
    const interval = setInterval(checkUnread, 10000);

    // Cleanup when component unmounts or user logs out
    return () => clearInterval(interval);
  }, [employee]);

  const checkUnread = async () => {
    if (!employee) return;
    try {
      const res = await fetch(
        `${API}/notifications/count/${employee.emp_id}`
      );
      const data = await res.json();
      setUnreadCount(data.unread);
    } catch {
      // silently fail — don't disrupt the app
    }
  };

  const loadNotifications = async () => {
    if (!employee) return;
    setNotifLoading(true);
    try {
      const res = await fetch(
        `${API}/notifications/${employee.emp_id}`
      );
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread);
    } catch {
      console.error("Failed to load notifications");
    }
    setNotifLoading(false);
  };

  const handleMarkRead = async (notification_id: string) => {
    try {
      await fetch(`${API}/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id }),
      });
      // Update local state immediately
      setNotifications(prev =>
        prev.map(n =>
          n.notification_id === notification_id
            ? { ...n, is_read: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      console.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    if (!employee) return;
    try {
      await fetch(`${API}/notifications/read_all/${employee.emp_id}`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      console.error("Failed to mark all as read");
    }
  };

  // ─────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────

  const handleLogin = async () => {
    if (!empIdInput.trim()) return;
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch(`${API}/employee/${empIdInput.trim()}`);
      const data: Employee = await res.json();

      if (data.role === "Employee not found") {
        setLoginError(`❌ Employee ID '${empIdInput}' not found.`);
      } else {
        setEmployee(data);
        setMessages([{
          role: "system",
          content: `Welcome ${data.name}! You're logged in as ${data.role} in ${data.department}. You can only access ${data.department} documents.`,
        }]);
      }
    } catch {
      setLoginError("❌ Cannot connect to WorkBindr server.");
    }
    setLoginLoading(false);
  };

  // ─────────────────────────────────────────
  // Load Tasks
  // ─────────────────────────────────────────

  const loadTasks = async () => {
    if (!employee) return;
    setTasksLoading(true);

    try {
      // Load tasks assigned to me
      const mineRes = await fetch(`${API}/tasks/mine/${employee.emp_id}`);
      const mineData = await mineRes.json();
      setMyTasks(mineData.tasks || []);

      // Load tasks I created
      const createdRes = await fetch(`${API}/tasks/created/${employee.emp_id}`);
      const createdData = await createdRes.json();
      setCreatedTasks(createdData.tasks || []);

      // CEO sees all tasks
      if (employee.department === "CEO") {
        const allRes = await fetch(`${API}/tasks/all`);
        const allData = await allRes.json();
        setAllTasks(allData.tasks || []);
      }
    } catch {
      console.error("Failed to load tasks");
    }
    setTasksLoading(false);
  };

  // ─────────────────────────────────────────
  // Create Task
  // ─────────────────────────────────────────

  const handleCreateTask = async () => {
    if (!newTaskTitle || !newTaskAssignee || !employee) return;

    try {
      const res = await fetch(`${API}/tasks/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          assigned_to: newTaskAssignee,
          title: newTaskTitle,
          description: newTaskDesc,
          priority: newTaskPriority,
        }),
      });

      const data = await res.json();
      setTaskResult(data.message);

      if (data.success) {
        // Clear form and reload tasks
        setNewTaskTitle("");
        setNewTaskDesc("");
        setNewTaskAssignee("");
        setNewTaskPriority("Medium");
        setShowCreateTask(false);
        await loadTasks();
      }
    } catch {
      setTaskResult("❌ Error creating task.");
    }
  };

  // ─────────────────────────────────────────
  // Update Task Status
  // ─────────────────────────────────────────

  const handleUpdateStatus = async (
    task_id: string,
    new_status: string
  ) => {
    if (!employee) return;

    try {
      const res = await fetch(`${API}/tasks/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          task_id,
          new_status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await loadTasks(); // reload to show updated status
      }
    } catch {
      console.error("Failed to update task");
    }
  };

  // ─────────────────────────────────────────
  // Ask AI
  // ─────────────────────────────────────────

  const handleQuery = async () => {
    if (!question.trim() || !employee) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setQuestion("");
    setQueryLoading(true);

    try {
      const res = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          query_text: question,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message,
        department: data.department,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Error connecting to backend.",
      }]);
    }
    setQueryLoading(false);
  };

  // ─────────────────────────────────────────
  // Upload Document
  // ─────────────────────────────────────────

  const handleAddDocument = async () => {
    if (!docTitle || !docContent || !employee) return;
    setDocLoading(true);
    setDocResult("");

    try {
      const res = await fetch(`${API}/add_document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          title: docTitle,
          content: docContent,
        }),
      });
      const data = await res.json();
      setDocResult(data.message);
      setDocTitle("");
      setDocContent("");
    } catch {
      setDocResult("❌ Error uploading document.");
    }
    setDocLoading(false);
  };

  // ─────────────────────────────────────────
  // Delete Document
  // ─────────────────────────────────────────

  const handleDeleteDocument = async () => {
    if (!deleteId || !employee) return;

    try {
      const res = await fetch(`${API}/delete_document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          doc_id: deleteId,
        }),
      });
      const data = await res.json();
      setDeleteResult(data.message);
      setDeleteId("");
    } catch {
      setDeleteResult("❌ Error deleting document.");
    }
  };

  // ─────────────────────────────────────────
  // Load History
  // ─────────────────────────────────────────

  const handleHistory = async () => {
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const res = await fetch(`${API}/history`);
      const data = await res.json();
      setHistory(data.events);
    } catch {
      setHistory(["❌ Error loading history."]);
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
    setMyTasks([]);
    setCreatedTasks([]);
    setAllTasks([]);
    setActiveTab("chat");
  };

  // ─────────────────────────────────────────
  // Task Card Component
  // ─────────────────────────────────────────

  const TaskCard = ({ task }: { task: Task }) => {
    const isAssignedToMe = task.assigned_to === employee?.emp_id;

    return (
      <div className={`bg-gray-800 rounded-xl p-4 border-l-4
                      ${priorityColors[task.priority]?.split(" ")[0] || "border-gray-600"}`}>

        {/* Task Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">
              {task.title}
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              {task.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 ml-3">
            {/* Priority Badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full border
                             ${priorityColors[task.priority]}`}>
              {task.priority_emoji} {task.priority}
            </span>
            {/* Status Badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full
                             ${statusColors[task.status]}`}>
              {task.status_emoji} {task.status}
            </span>
          </div>
        </div>

        {/* Task Meta */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span>From: {task.created_by}</span>
          <span>→</span>
          <span>To: {task.assigned_to}</span>
          <span className={`${deptColors[task.department]} 
                            text-white px-2 py-0.5 rounded-full text-xs`}>
            {task.department}
          </span>
        </div>

        {/* Status Update Buttons — only for assignee */}
        {isAssignedToMe && task.status !== "Done" && (
          <div className="flex gap-2">
            {task.status === "Todo" && (
              <button
                onClick={() => handleUpdateStatus(task.task_id, "InProgress")}
                className="bg-blue-600 hover:bg-blue-500 text-white
                           text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                ⚙️ Start
              </button>
            )}
            {task.status === "InProgress" && (
              <button
                onClick={() => handleUpdateStatus(task.task_id, "Done")}
                className="bg-green-600 hover:bg-green-500 text-white
                           text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                ✅ Mark Done
              </button>
            )}
          </div>
        )}

        {task.status === "Done" && (
          <div className="text-green-400 text-xs">
            ✅ Completed
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────
  // RENDER — Login Screen
  // ─────────────────────────────────────────

  if (!employee) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center
                       justify-center p-4">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-blue-400 mb-2">
              WorkBindr
            </h1>
            <p className="text-gray-400">Enterprise AI Business OS</p>
            <p className="text-gray-600 text-sm mt-1">
              Powered by Rust + MORK + Groq AI
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">
              🔐 Employee Login
            </h2>

            <label className="block text-gray-400 text-sm mb-2">
              Employee ID
            </label>
            <input
              type="text"
              value={empIdInput}
              onChange={(e) => setEmpIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="e.g. 0001"
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                         border border-gray-700 focus:outline-none
                         focus:border-blue-500 placeholder-gray-500
                         text-center text-lg tracking-widest mb-4"
            />

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
                         py-3 rounded-xl transition-colors"
            >
              {loginLoading ? "Verifying..." : "Login →"}
            </button>

            {/* Demo Employees */}
            <div className="mt-6 border-t border-gray-800 pt-4">
              <p className="text-gray-500 text-xs text-center mb-3">
                Demo Employee IDs
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "0000", label: "👑 CEO" },
                  { id: "0001", label: "👥 HR Mgr" },
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
  // RENDER — Main App
  // ─────────────────────────────────────────

  const deptColor = deptColors[employee.department] || "bg-gray-600";
  const deptIcon  = deptIcons[employee.department]  || "❓";

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── Navbar ── */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-400">WorkBindr</h1>
          <div className="flex items-center gap-3">
            <div className={`${deptColor} px-3 py-1 rounded-full
                            text-xs font-semibold`}>
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

      {/* ── Tabs ── */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: "chat",    label: "🤖 AI Chat" },
              { id: "tasks",   label: "📋 Tasks" },
              { id: "docs",    label: "📄 Documents" },
              { id: "history", label: "📚 MORK History" },
              ...(employee.department === "CEO"
                ? [{ id: "admin", label: "👑 Admin" }]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(
                  tab.id as "chat" | "tasks" | "docs" | "history" | "admin"
                )}
                
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

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ════════════════════════════════
            TAB 1: AI CHAT
        ════════════════════════════════ */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[calc(100vh-220px)]">

            {/* Permission banner */}
            <div className={`${deptColor} bg-opacity-20 border
                            border-opacity-30 rounded-xl p-3 mb-4
                            flex items-center gap-2 text-sm text-gray-300`}>
              <span>{deptIcon}</span>
              <span>
                You are in <strong>{employee.department}</strong>.
                AI only searches your department documents.
                {employee.department === "CEO" &&
                  " As CEO you have full access."}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user"
                    ? "justify-end"
                    : "justify-start"}`}
                >
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
                      </div>
                    )}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}

              {queryLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3
                                  text-gray-400 text-sm">
                    🤖 Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
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
                           transition-colors"
              >
                {queryLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 2: TASKS
        ════════════════════════════════ */}
        {activeTab === "tasks" && (
          <div>

            {/* Task Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                📋 Task Board
              </h2>
              <button
                onClick={() => setShowCreateTask(!showCreateTask)}
                className="bg-blue-600 hover:bg-blue-500 text-white
                           font-semibold px-4 py-2 rounded-xl
                           transition-colors text-sm"
              >
                {showCreateTask ? "✕ Cancel" : "+ Create Task"}
              </button>
            </div>

            {/* Create Task Form */}
            {showCreateTask && (
              <div className="bg-gray-900 rounded-2xl p-6 border
                              border-gray-800 mb-6">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">
                  Create New Task
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g. Review Q4 Budget"
                      className="w-full bg-gray-800 text-white rounded-xl
                                 px-4 py-3 border border-gray-700
                                 focus:outline-none focus:border-blue-500
                                 placeholder-gray-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Assign To (Employee ID) *
                    </label>
                    <input
                      type="text"
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      placeholder="e.g. 0003"
                      className="w-full bg-gray-800 text-white rounded-xl
                                 px-4 py-3 border border-gray-700
                                 focus:outline-none focus:border-blue-500
                                 placeholder-gray-500 text-sm"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-gray-400 text-xs mb-1 block">
                    Description
                  </label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Task details..."
                    rows={3}
                    className="w-full bg-gray-800 text-white rounded-xl
                               px-4 py-3 border border-gray-700
                               focus:outline-none focus:border-blue-500
                               placeholder-gray-500 text-sm"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-gray-400 text-xs mb-1 block">
                    Priority
                  </label>
                  <div className="flex gap-2">
                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setNewTaskPriority(p)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium
                                   transition-colors border ${
                          newTaskPriority === p
                            ? priorityColors[p]
                            : "border-gray-700 text-gray-500"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateTask}
                  className="bg-green-600 hover:bg-green-500 text-white
                             font-semibold px-6 py-3 rounded-xl
                             transition-colors"
                >
                  Create Task
                </button>

                {taskResult && (
                  <div className="mt-3 bg-gray-800 rounded-xl p-3
                                  text-green-300 text-sm">
                    {taskResult}
                  </div>
                )}
              </div>
            )}

            {/* Task View Switcher */}
            <div className="flex gap-2 mb-4">
              {[
                { id: "mine",    label: `📥 Assigned to Me (${myTasks.length})` },
                { id: "created", label: `📤 Created by Me (${createdTasks.length})` },
                ...(employee.department === "CEO"
                  ? [{ id: "all", label: `👑 All Tasks (${allTasks.length})` }]
                  : []),
              ].map((view) => (
                <button
                  key={view.id}
                  onClick={() => setTaskView(view.id as "mine" | "created" | "all")}
                  className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                    taskView === view.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {view.label}
                </button>
              ))}
              <button
                onClick={loadTasks}
                className="ml-auto bg-gray-800 hover:bg-gray-700
                           text-gray-400 px-3 py-2 rounded-xl
                           text-sm transition-colors"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Task Lists */}
            {tasksLoading ? (
              <div className="text-gray-500 text-center py-8">
                Loading tasks...
              </div>
            ) : (
              <div>
                {/* Kanban style — 3 columns */}
                <div className="grid grid-cols-3 gap-4">
                  {["Todo", "InProgress", "Done"].map((status) => {
                    const currentTasks = taskView === "mine"
                      ? myTasks
                      : taskView === "created"
                      ? createdTasks
                      : allTasks;

                    const filtered = currentTasks.filter(
                      (t) => t.status === status
                    );

                    return (
                      <div key={status} className="bg-gray-900 rounded-2xl p-4
                                                   border border-gray-800">
                        <div className="flex items-center gap-2 mb-4">
                          <span className={`text-xs px-3 py-1 rounded-full
                                          ${statusColors[status]}`}>
                            {status === "Todo"       && "📋 Todo"}
                            {status === "InProgress" && "⚙️ In Progress"}
                            {status === "Done"       && "✅ Done"}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {filtered.length}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {filtered.length === 0 ? (
                            <p className="text-gray-600 text-xs text-center py-4">
                              No tasks
                            </p>
                          ) : (
                            filtered.map((task) => (
                              <TaskCard key={task.task_id} task={task} />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════
            TAB 3: DOCUMENTS
        ════════════════════════════════ */}
        {activeTab === "docs" && (
          <div className="space-y-6">

            {/* Upload */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-blue-300 mb-2">
                📄 Upload Document
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Auto-tagged to
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
                           transition-colors"
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

            {/* Delete */}
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
                             font-semibold px-6 py-3 rounded-xl transition-colors"
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

        {/* ════════════════════════════════
            TAB 4: MORK HISTORY
        ════════════════════════════════ */}
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
                           transition-colors text-sm"
              >
                {historyLoading ? "Loading..." : "🔄 Refresh"}
              </button>
            </div>

            {!showHistory && (
              <p className="text-gray-600 text-sm">
                Click Refresh to see all events ever recorded in MORK
              </p>
            )}

            {/* ════════════════════════════════
            TAB 5: ADMIN PANEL (CEO only)
        ════════════════════════════════ */}
        {activeTab === "admin" && employee.department === "CEO" && (
          <AdminPanel employee={employee} />
        )}

            {showHistory && (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-gray-500 text-sm">No events yet.</p>
                ) : (
                  history.map((event, i) => (
                    <div
                      key={i}
                      className={`bg-gray-800 rounded-lg p-3 border
                                 font-mono text-xs ${
                        event.includes("TaskCreated")
                          ? "border-blue-800 text-blue-300"
                          : event.includes("TaskUpdated")
                          ? "border-green-800 text-green-300"
                          : event.includes("DocumentAdded")
                          ? "border-yellow-800 text-yellow-300"
                          : event.includes("Tombstone")
                          ? "border-red-800 text-red-300"
                          : event.includes("UserInput")
                          ? "border-purple-800 text-purple-300"
                          : "border-gray-700 text-gray-300"
                      }`}
                    >
                      #{i + 1}: {event}
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
// ─────────────────────────────────────────────
// Admin Panel Component
// Only visible to CEO
// ─────────────────────────────────────────────

function AdminPanel({ employee }: { employee: Employee }) {

  const API = "http://127.0.0.1:8000";

  // Stats
  interface Stats {
    total_employees: number;
    total_events: number;
    total_tasks: number;
    total_tasks_done: number;
    departments: Array<{
      name: string;
      employee_count: number;
      task_count: number;
    }>;
  }

  interface EmployeeInfo {
    emp_id: string;
    name: string;
    department: string;
    role: string;
  }

  const [stats, setStats]           = useState<Stats | null>(null);
  const [employees, setEmployees]   = useState<EmployeeInfo[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [adminView, setAdminView]   = useState<"stats" | "employees" | "add">("stats");

  // Add employee form
  const [newEmpId,   setNewEmpId]   = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("HR");
  const [newEmpRole, setNewEmpRole] = useState("");
  const [addResult,  setAddResult]  = useState("");

  // Deactivate
  const [deactivateId,     setDeactivateId]     = useState("");
  const [deactivateResult, setDeactivateResult] = useState("");

  // Load stats on mount
  useEffect(() => {
    loadStats();
    loadEmployees();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch(`${API}/admin/stats`);
      const data = await res.json();
      setStats(data);
    } catch {
      console.error("Failed to load stats");
    }
    setStatsLoading(false);
  };

  const loadEmployees = async () => {
    try {
      const res  = await fetch(`${API}/admin/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch {
      console.error("Failed to load employees");
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmpId || !newEmpName || !newEmpRole) return;

    try {
      const res = await fetch(`${API}/admin/add_employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_emp_id: employee.emp_id,
          emp_id:       newEmpId,
          name:         newEmpName,
          department:   newEmpDept,
          role:         newEmpRole,
        }),
      });
      const data = await res.json();
      setAddResult(data.message);

      if (data.success) {
        setNewEmpId("");
        setNewEmpName("");
        setNewEmpRole("");
        await loadEmployees();
        await loadStats();
      }
    } catch {
      setAddResult("❌ Error adding employee.");
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    try {
      const res = await fetch(`${API}/admin/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_emp_id: employee.emp_id,
          emp_id:       deactivateId,
        }),
      });
      const data = await res.json();
      setDeactivateResult(data.message);
      if (data.success) {
        setDeactivateId("");
        await loadEmployees();
        await loadStats();
      }
    } catch {
      setDeactivateResult("❌ Error deactivating employee.");
    }
  };

  const deptColors: Record<string, string> = {
    HR:          "bg-pink-600",
    Finance:     "bg-green-600",
    Legal:       "bg-yellow-600",
    Engineering: "bg-blue-600",
    CEO:         "bg-purple-600",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">👑 Admin Panel</h2>
        <span className="text-gray-500 text-sm">CEO Access Only</span>
      </div>

      {/* Admin Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "stats",     label: "📊 Platform Stats" },
          { id: "employees", label: "👥 All Employees" },
          { id: "add",       label: "➕ Add Employee" },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setAdminView(v.id as "stats" | "employees" | "add")}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              adminView === v.id
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Stats View ── */}
      {adminView === "stats" && (
        <div>
          {statsLoading ? (
            <p className="text-gray-500">Loading stats...</p>
          ) : stats ? (
            <div>
              {/* Top Stats Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Total Employees",
                    value: stats.total_employees,
                    icon:  "👥",
                    color: "border-blue-600",
                  },
                  {
                    label: "Total Events",
                    value: stats.total_events,
                    icon:  "📝",
                    color: "border-purple-600",
                  },
                  {
                    label: "Total Tasks",
                    value: stats.total_tasks,
                    icon:  "📋",
                    color: "border-yellow-600",
                  },
                  {
                    label: "Tasks Done",
                    value: stats.total_tasks_done,
                    icon:  "✅",
                    color: "border-green-600",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`bg-gray-900 rounded-2xl p-5 border-l-4
                               ${stat.color} border border-gray-800`}
                  >
                    <div className="text-3xl mb-1">{stat.icon}</div>
                    <div className="text-3xl font-bold text-white">
                      {stat.value}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Department Stats */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Department Overview
                </h3>
                <div className="space-y-3">
                  {stats.departments.map((dept) => (
                    <div
                      key={dept.name}
                      className="flex items-center justify-between
                                 bg-gray-800 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`${deptColors[dept.name] || "bg-gray-600"}
                                         text-white px-3 py-1 rounded-full
                                         text-xs font-semibold`}>
                          {dept.name}
                        </span>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <div className="text-white font-bold">
                            {dept.employee_count}
                          </div>
                          <div className="text-gray-500 text-xs">
                            Employees
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-white font-bold">
                            {dept.task_count}
                          </div>
                          <div className="text-gray-500 text-xs">Tasks</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { loadStats(); loadEmployees(); }}
                className="mt-4 bg-gray-800 hover:bg-gray-700 text-gray-400
                           px-4 py-2 rounded-xl text-sm transition-colors"
              >
                🔄 Refresh Stats
              </button>
            </div>
          ) : (
            <p className="text-gray-500">No stats available.</p>
          )}
        </div>
      )}

      {/* ── Employees View ── */}
      {adminView === "employees" && (
        <div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 text-sm font-medium">
                    ID
                  </th>
                  <th className="text-left p-4 text-gray-400 text-sm font-medium">
                    Name
                  </th>
                  <th className="text-left p-4 text-gray-400 text-sm font-medium">
                    Department
                  </th>
                  <th className="text-left p-4 text-gray-400 text-sm font-medium">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.emp_id}
                    className="border-b border-gray-800 hover:bg-gray-800
                               transition-colors"
                  >
                    <td className="p-4 font-mono text-gray-300 text-sm">
                      {emp.emp_id}
                    </td>
                    <td className="p-4 text-white font-medium">{emp.name}</td>
                    <td className="p-4">
                      <span className={`${deptColors[emp.department] || "bg-gray-600"}
                                        text-white px-2 py-0.5 rounded-full
                                        text-xs`}>
                        {emp.department}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">{emp.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Deactivate Employee */}
          <div className="mt-6 bg-gray-900 rounded-2xl p-6 border border-red-900">
            <h3 className="text-lg font-semibold text-red-400 mb-4">
              ⚠️ Deactivate Employee
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={deactivateId}
                onChange={(e) => setDeactivateId(e.target.value)}
                placeholder="Employee ID to deactivate e.g. 0008"
                className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3
                           border border-gray-700 focus:outline-none
                           focus:border-red-500 placeholder-gray-500 text-sm"
              />
              <button
                onClick={handleDeactivate}
                className="bg-red-600 hover:bg-red-500 text-white
                           font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Deactivate
              </button>
            </div>
            {deactivateResult && (
              <div className="mt-3 bg-gray-800 rounded-xl p-3
                              text-red-300 text-sm">
                {deactivateResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Employee View ── */}
      {adminView === "add" && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-blue-300 mb-6">
            ➕ Add New Employee
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                Employee ID *
              </label>
              <input
                type="text"
                value={newEmpId}
                onChange={(e) => setNewEmpId(e.target.value)}
                placeholder="e.g. 0009"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                           border border-gray-700 focus:outline-none
                           focus:border-blue-500 placeholder-gray-500
                           text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                Full Name *
              </label>
              <input
                type="text"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                placeholder="e.g. Rahul Singh"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                           border border-gray-700 focus:outline-none
                           focus:border-blue-500 placeholder-gray-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                Department *
              </label>
              <div className="flex flex-wrap gap-2">
                {["HR", "Finance", "Legal", "Engineering", "CEO"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setNewEmpDept(d)}
                    className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                      newEmpDept === d
                        ? `${deptColors[d]} text-white`
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                Role/Title *
              </label>
              <input
                type="text"
                value={newEmpRole}
                onChange={(e) => setNewEmpRole(e.target.value)}
                placeholder="e.g. Senior Engineer"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                           border border-gray-700 focus:outline-none
                           focus:border-blue-500 placeholder-gray-500 text-sm"
              />
            </div>
          </div>

          {/* Preview Card */}
          {newEmpId && newEmpName && (
            <div className="mb-4 bg-gray-800 rounded-xl p-4 border
                            border-gray-700">
              <p className="text-gray-400 text-xs mb-2">Preview:</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-gray-300 text-sm">
                  {newEmpId}
                </span>
                <span className="text-white font-medium">{newEmpName}</span>
                <span className={`${deptColors[newEmpDept]} text-white
                                  px-2 py-0.5 rounded-full text-xs`}>
                  {newEmpDept}
                </span>
                <span className="text-gray-400 text-sm">{newEmpRole}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleAddEmployee}
            className="bg-green-600 hover:bg-green-500 text-white
                       font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            ➕ Add Employee
          </button>

          {addResult && (
            <div className={`mt-3 rounded-xl p-3 text-sm ${
              addResult.includes("✅")
                ? "bg-green-900/30 text-green-300 border border-green-800"
                : "bg-red-900/30 text-red-300 border border-red-800"
            }`}>
              {addResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}