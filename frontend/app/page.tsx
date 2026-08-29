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

interface DeptMember {
  emp_id: string;
  name: string;
  role: string;
  unread: number;
}

interface ChatMessage {
  message_id: string;
  from_emp_id: string;
  to_emp_id: string;
  content: string;
  department: string;
  is_read: boolean;
  created_at: number;
}

interface Analytics {
  tasks_todo: number;
  tasks_in_progress: number;
  tasks_done: number;
  tasks_urgent: number;
  total_messages: number;
  total_documents: number;
  total_ai_queries: number;
  total_employees: number;
  dept_stats: Array<{
    department: string;
    employees: number;
    tasks: number;
    tasks_done: number;
    documents: number;
  }>;
}

interface SearchResult {
  doc_id: string;
  title: string;
  department: string;
  snippet: string;
  relevance: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const API = "http://127.0.0.1:8000";

const deptColors: Record<string, string> = {
  HR: "bg-pink-600",
  Finance: "bg-green-600",
  Legal: "bg-yellow-600",
  Engineering: "bg-blue-600",
  CEO: "bg-purple-600",
  Unknown: "bg-gray-600",
};

const deptIcons: Record<string, string> = {
  HR: "👥",
  Finance: "💰",
  Legal: "⚖️",
  Engineering: "⚙️",
  CEO: "👑",
  Unknown: "❓",
};

const priorityColors: Record<string, string> = {
  Low: "border-green-600 text-green-400",
  Medium: "border-yellow-600 text-yellow-400",
  High: "border-red-600 text-red-400",
  Urgent: "border-red-400 text-red-300 animate-pulse",
};

const statusColors: Record<string, string> = {
  Todo: "bg-gray-700 text-gray-300",
  InProgress: "bg-blue-700 text-blue-200",
  Done: "bg-green-700 text-green-200",
};

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function Home() {

  // ── Auth State ───────────────────────────
  const [empIdInput, setEmpIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Change password modal
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changePwdResult, setChangePwdResult] = useState("");

  // ── Tab State ────────────────────────────
  const [activeTab, setActiveTab] = useState<
    "chat" | "tasks" | "messages" | "search" | "docs" | "analytics" | "history" | "admin"
  >("chat");

  // ── Chat/AI State ────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);

  // ── Task State ───────────────────────────
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskView, setTaskView] = useState<"mine" | "created" | "all">("mine");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [taskResult, setTaskResult] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);

  // ── Notification State ───────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // ── Document State ───────────────────────
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docResult, setDocResult] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [deleteResult, setDeleteResult] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [fileResult, setFileResult] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Chat/Messages State ──────────────────
  const [deptMembers, setDeptMembers] = useState<DeptMember[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<DeptMember | null>(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  // ── Analytics State ──────────────────────
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Search State ─────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  // ── History State ────────────────────────
  const [history, setHistory] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ─────────────────────────────────────────
  // useEffects
  // ─────────────────────────────────────────

  useEffect(() => {
    if (activeTab === "tasks" && employee) loadTasks();
  }, [activeTab, employee]);

  useEffect(() => {
    if (activeTab === "messages" && employee) loadDeptMembers();
  }, [activeTab, employee]);

  useEffect(() => {
    if (activeTab === "analytics" && employee) loadAnalytics();
  }, [activeTab, employee]);

  // Poll for unread notifications every 10 seconds
  useEffect(() => {
    if (!employee) return;
    checkUnread();
    const interval = setInterval(checkUnread, 10000);
    return () => clearInterval(interval);
  }, [employee]);

  // ─────────────────────────────────────────
  // Auth Functions
  // ─────────────────────────────────────────

  const handleLogin = async () => {
    if (!empIdInput.trim() || !password.trim()) return;
    setLoginLoading(true);
    setLoginError("");

    try {
      const authRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: empIdInput.trim(),
          password: password,
        }),
      });

      const authData = await authRes.json();

      if (!authData.success) {
        setLoginError(authData.message);
        setLoginLoading(false);
        return;
      }

      setEmployee({
        emp_id: authData.emp_id,
        name: authData.name,
        department: authData.department,
        role: authData.role,
      });

      setMessages([{
        role: "system",
        content: `${authData.message} You have secure access to ${authData.department} resources.`,
      }]);

    } catch {
      setLoginError("❌ Cannot connect to WorkBindr server. Is it running?");
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    setEmployee(null);
    setMessages([]);
    setEmpIdInput("");
    setPassword("");
    setMyTasks([]);
    setCreatedTasks([]);
    setAllTasks([]);
    setActiveTab("chat");
    setSelectedPeer(null);
    setConversation([]);
    setUnreadCount(0);
    setNotifications([]);
  };

  const handleChangePassword = async () => {
    if (!employee || !oldPassword || !newPassword) return;
    try {
      const res = await fetch(`${API}/auth/change_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      setChangePwdResult(data.message);
      if (data.success) {
        setOldPassword("");
        setNewPassword("");
        setTimeout(() => {
          setShowChangePwd(false);
          setChangePwdResult("");
        }, 2000);
      }
    } catch {
      setChangePwdResult("❌ Error changing password.");
    }
  };

  // ─────────────────────────────────────────
  // Notification Functions
  // ─────────────────────────────────────────

  const checkUnread = async () => {
    if (!employee) return;
    try {
      const res = await fetch(`${API}/notifications/count/${employee.emp_id}`);
      const data = await res.json();
      setUnreadCount(data.unread);
    } catch { /* silently fail */ }
  };

  const loadNotifications = async () => {
    if (!employee) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`${API}/notifications/${employee.emp_id}`);
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
      setNotifications(prev =>
        prev.map(n => n.notification_id === notification_id ? { ...n, is_read: true } : n)
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
  // AI Chat Functions
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
        body: JSON.stringify({ emp_id: employee.emp_id, query_text: question }),
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
  // Task Functions
  // ─────────────────────────────────────────

  const loadTasks = async () => {
    if (!employee) return;
    setTasksLoading(true);
    try {
      const mineRes = await fetch(`${API}/tasks/mine/${employee.emp_id}`);
      const mineData = await mineRes.json();
      setMyTasks(mineData.tasks || []);

      const createdRes = await fetch(`${API}/tasks/created/${employee.emp_id}`);
      const createdData = await createdRes.json();
      setCreatedTasks(createdData.tasks || []);

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

  const handleUpdateStatus = async (task_id: string, new_status: string) => {
    if (!employee) return;
    try {
      const res = await fetch(`${API}/tasks/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emp_id: employee.emp_id, task_id, new_status }),
      });
      const data = await res.json();
      if (data.success) await loadTasks();
    } catch {
      console.error("Failed to update task");
    }
  };

  // ─────────────────────────────────────────
  // Document Functions
  // ─────────────────────────────────────────

  const handleAddDocument = async () => {
    if (!docTitle || !docContent || !employee) return;
    setDocLoading(true);
    setDocResult("");
    try {
      const res = await fetch(`${API}/add_document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emp_id: employee.emp_id, title: docTitle, content: docContent }),
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

  const handleDeleteDocument = async () => {
    if (!deleteId || !employee) return;
    try {
      const res = await fetch(`${API}/delete_document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emp_id: employee.emp_id, doc_id: deleteId }),
      });
      const data = await res.json();
      setDeleteResult(data.message);
      setDeleteId("");
    } catch {
      setDeleteResult("❌ Error deleting document.");
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!employee || !fileTitle.trim()) {
      setFileResult("❌ Please enter a title first.");
      return;
    }
    setFileLoading(true);
    setFileResult("");
    try {
      const text = await file.text();
      const fileType = file.name.split(".").pop()?.toLowerCase() || "txt";
      const res = await fetch(`${API}/upload_file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: employee.emp_id,
          title: fileTitle,
          file_name: file.name,
          file_type: fileType,
          content: text,
        }),
      });
      const data = await res.json();
      setFileResult(data.message);
      if (data.doc_id !== "none") setFileTitle("");
    } catch {
      setFileResult("❌ Upload failed. Try again.");
    }
    setFileLoading(false);
  };

  // ─────────────────────────────────────────
  // Chat/Messages Functions
  // ─────────────────────────────────────────

  const loadDeptMembers = async () => {
    if (!employee) return;
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/chat/members/${employee.emp_id}`);
      const data = await res.json();
      setDeptMembers(data.members || []);
    } catch {
      console.error("Failed to load dept members");
    }
    setChatLoading(false);
  };

  const loadConversation = async (peer: DeptMember) => {
    if (!employee) return;
    setSelectedPeer(peer);
    try {
      const res = await fetch(`${API}/chat/conversation/${employee.emp_id}/${peer.emp_id}`);
      const data = await res.json();
      setConversation(data.messages || []);
      setDeptMembers(prev =>
        prev.map(m => m.emp_id === peer.emp_id ? { ...m, unread: 0 } : m)
      );
    } catch {
      console.error("Failed to load conversation");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !employee || !selectedPeer) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`${API}/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_emp_id: employee.emp_id,
          to_emp_id: selectedPeer.emp_id,
          content: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMessage("");
        await loadConversation(selectedPeer);
      }
    } catch {
      console.error("Failed to send message");
    }
    setSendingMsg(false);
  };

  // ─────────────────────────────────────────
  // Analytics Functions
  // ─────────────────────────────────────────

  const loadAnalytics = async () => {
    if (!employee) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API}/analytics/${employee.emp_id}`);
      const data = await res.json();
      setAnalytics(data);
    } catch {
      console.error("Failed to load analytics");
    }
    setAnalyticsLoading(false);
  };

  // ─────────────────────────────────────────
  // Search Functions
  // ─────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim() || !employee) return;
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emp_id: employee.emp_id, query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearchDone(true);
    } catch {
      console.error("Search failed");
    }
    setSearchLoading(false);
  };

  // ─────────────────────────────────────────
  // History Functions
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
  // Task Card Component
  // ─────────────────────────────────────────

  const TaskCard = ({ task }: { task: Task }) => {
    const isAssignedToMe = task.assigned_to === employee?.emp_id;
    return (
      <div className={`bg-gray-800 rounded-xl p-4 border-l-4 ${priorityColors[task.priority]?.split(" ")[0] || "border-gray-600"}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">{task.title}</h3>
            <p className="text-gray-400 text-xs mt-1">{task.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1 ml-3">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
              {task.priority_emoji} {task.priority}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>
              {task.status_emoji} {task.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span>From: {task.created_by}</span>
          <span>→</span>
          <span>To: {task.assigned_to}</span>
          <span className={`${deptColors[task.department]} text-white px-2 py-0.5 rounded-full text-xs`}>
            {task.department}
          </span>
        </div>
        {isAssignedToMe && task.status !== "Done" && (
          <div className="flex gap-2">
            {task.status === "Todo" && (
              <button
                onClick={() => handleUpdateStatus(task.task_id, "InProgress")}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                ⚙️ Start
              </button>
            )}
            {task.status === "InProgress" && (
              <button
                onClick={() => handleUpdateStatus(task.task_id, "Done")}
                className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                ✅ Mark Done
              </button>
            )}
          </div>
        )}
        {task.status === "Done" && (
          <div className="text-green-400 text-xs">✅ Completed</div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────
  // RENDER — Login Screen
  // ─────────────────────────────────────────

  if (!employee) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-blue-400 mb-2">WorkBindr</h1>
            <p className="text-gray-400">Enterprise AI Business OS</p>
            <p className="text-gray-600 text-sm mt-1">Powered by Rust + MORK + Groq AI</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">🔐 Secure Login</h2>

            <div className="mb-4">
              <label className="block text-gray-400 text-xs mb-1">Employee ID</label>
              <input
                type="text"
                value={empIdInput}
                onChange={(e) => setEmpIdInput(e.target.value)}
                placeholder="e.g. 0001"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-center text-lg tracking-widest"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-xs mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter your password"
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="mb-4 bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-300 text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loginLoading ? "Verifying..." : "🔐 Login"}
            </button>

            <div className="mt-6 border-t border-gray-800 pt-4">
              <p className="text-gray-500 text-xs text-center mb-2">Demo Credentials</p>
              <div className="bg-gray-800 rounded-xl p-3 mb-3">
                <p className="text-gray-400 text-xs text-center">Password = Employee ID + "Pass1!"</p>
                <p className="text-gray-500 text-xs text-center mt-1">e.g. ID 0001 → Password: 0001Pass1!</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "0000", label: "👑 CEO", pwd: "0000Pass1!" },
                  { id: "0001", label: "👥 HR Mgr", pwd: "0001Pass1!" },
                  { id: "0003", label: "💰 Finance", pwd: "0003Pass1!" },
                  { id: "0005", label: "⚖️ Legal", pwd: "0005Pass1!" },
                  { id: "0007", label: "⚙️ Eng", pwd: "0007Pass1!" },
                  { id: "0002", label: "👥 HR Jr", pwd: "0002Pass1!" },
                ].map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => { setEmpIdInput(emp.id); setPassword(emp.pwd); }}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-2 px-3 rounded-lg transition-colors border border-gray-600"
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
  const deptIcon = deptIcons[employee.department] || "❓";

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── Navbar ── */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-400">WorkBindr</h1>
          <div className="flex items-center gap-3">

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) loadNotifications(); }}
                className="relative bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-xl transition-colors"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 max-h-96 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-white font-semibold">
                      🔔 Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-blue-400 text-xs hover:text-blue-300">Mark all read</button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-72">
                    {notifLoading ? (
                      <p className="text-gray-500 text-sm text-center p-4">Loading...</p>
                    ) : notifications.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center p-8">No notifications yet 🎉</p>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.notification_id}
                          onClick={() => handleMarkRead(notif.notification_id)}
                          className={`p-4 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800 ${!notif.is_read ? "bg-gray-800/50 border-l-2 border-l-blue-500" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{notif.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className={`text-sm font-medium ${!notif.is_read ? "text-white" : "text-gray-400"}`}>{notif.title}</p>
                                {!notif.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0" />}
                              </div>
                              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{notif.message}</p>
                              <p className="text-gray-600 text-xs mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`${deptColor} px-3 py-1 rounded-full text-xs font-semibold`}>
              {deptIcon} {employee.department}
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{employee.name}</div>
              <div className="text-gray-500 text-xs">{employee.role} • ID: {employee.emp_id}</div>
            </div>
            <button
              onClick={() => setShowChangePwd(true)}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs px-3 py-2 rounded-lg transition-colors"
            >
              🔑
            </button>
            <button
              onClick={handleLogout}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs px-3 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ── Tabs ── */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {[
              { id: "chat", label: "🤖 AI Chat" },
              { id: "tasks", label: "📋 Tasks" },
              { id: "messages", label: `💬 Messages${chatUnread > 0 ? ` (${chatUnread})` : ""}` },
              { id: "search", label: "🔍 Search" },
              { id: "docs", label: "📄 Documents" },
              { id: "analytics", label: "📊 Analytics" },
              { id: "history", label: "📚 History" },
              ...(employee.department === "CEO" ? [{ id: "admin", label: "👑 Admin" }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "chat" | "tasks" | "messages" | "search" | "docs" | "analytics" | "history" | "admin")}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ════ TAB: AI CHAT ════ */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[calc(100vh-220px)]">
            <div className={`${deptColor} bg-opacity-20 border border-opacity-30 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-gray-300`}>
              <span>{deptIcon}</span>
              <span>You are in <strong>{employee.department}</strong>. AI only searches your department documents.{employee.department === "CEO" && " As CEO you have full access."}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-blue-600 text-white" : msg.role === "system" ? "bg-gray-800 text-gray-300 text-sm italic" : "bg-gray-800 text-gray-100"}`}>
                    {msg.role === "assistant" && <div className="text-xs text-gray-500 mb-1">🤖 WorkBindr AI</div>}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {queryLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3 text-gray-400 text-sm">🤖 Thinking...</div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder={`Ask anything as ${employee.name}...`}
                className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500"
              />
              <button
                onClick={handleQuery}
                disabled={queryLoading}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                {queryLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        )}

        {/* ════ TAB: TASKS ════ */}
        {activeTab === "tasks" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">📋 Task Board</h2>
              <button
                onClick={() => setShowCreateTask(!showCreateTask)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
              >
                {showCreateTask ? "✕ Cancel" : "+ Create Task"}
              </button>
            </div>

            {showCreateTask && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">Create New Task</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Task Title *</label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g. Review Q4 Budget"
                      className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Assign To (Employee ID) *</label>
                    <input
                      type="text"
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      placeholder="e.g. 0003"
                      className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-gray-400 text-xs mb-1 block">Description</label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Task details..."
                    rows={3}
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
                  />
                </div>
                <div className="mb-4">
                  <label className="text-gray-400 text-xs mb-1 block">Priority</label>
                  <div className="flex gap-2">
                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setNewTaskPriority(p)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${newTaskPriority === p ? priorityColors[p] : "border-gray-700 text-gray-500"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCreateTask}
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  Create Task
                </button>
                {taskResult && (
                  <div className="mt-3 bg-gray-800 rounded-xl p-3 text-green-300 text-sm">{taskResult}</div>
                )}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              {[
                { id: "mine", label: `📥 Assigned to Me (${myTasks.length})` },
                { id: "created", label: `📤 Created by Me (${createdTasks.length})` },
                ...(employee.department === "CEO" ? [{ id: "all", label: `👑 All Tasks (${allTasks.length})` }] : []),
              ].map((view) => (
                <button
                  key={view.id}
                  onClick={() => setTaskView(view.id as "mine" | "created" | "all")}
                  className={`px-4 py-2 rounded-xl text-sm transition-colors ${taskView === view.id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  {view.label}
                </button>
              ))}
              <button onClick={loadTasks} className="ml-auto bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-xl text-sm transition-colors">🔄 Refresh</button>
            </div>

            {tasksLoading ? (
              <div className="text-gray-500 text-center py-8">Loading tasks...</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {["Todo", "InProgress", "Done"].map((status) => {
                  const currentTasks = taskView === "mine" ? myTasks : taskView === "created" ? createdTasks : allTasks;
                  const filtered = currentTasks.filter((t) => t.status === status);
                  return (
                    <div key={status} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`text-xs px-3 py-1 rounded-full ${statusColors[status]}`}>
                          {status === "Todo" && "📋 Todo"}
                          {status === "InProgress" && "⚙️ In Progress"}
                          {status === "Done" && "✅ Done"}
                        </span>
                        <span className="text-gray-500 text-xs">{filtered.length}</span>
                      </div>
                      <div className="space-y-3">
                        {filtered.length === 0 ? (
                          <p className="text-gray-600 text-xs text-center py-4">No tasks</p>
                        ) : (
                          filtered.map((task) => <TaskCard key={task.task_id} task={task} />)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: MESSAGES ════ */}
        {activeTab === "messages" && (
          <div className="flex h-[calc(100vh-220px)] gap-4">
            <div className="w-72 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm">💬 {employee.department} Team</h3>
                <p className="text-gray-500 text-xs mt-0.5">Direct messages</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatLoading ? (
                  <p className="text-gray-500 text-xs text-center p-4">Loading...</p>
                ) : deptMembers.length === 0 ? (
                  <p className="text-gray-600 text-xs text-center p-4">No other employees in your department yet.</p>
                ) : (
                  deptMembers.map((member) => (
                    <div
                      key={member.emp_id}
                      onClick={() => loadConversation(member)}
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-gray-800 hover:bg-gray-800 ${selectedPeer?.emp_id === member.emp_id ? "bg-gray-800 border-l-2 border-l-blue-500" : ""}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${deptColor}`}>
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-white text-sm font-medium truncate">{member.name}</p>
                          {member.unread > 0 && (
                            <span className="bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-1">{member.unread}</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs truncate">{member.role}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col overflow-hidden">
              {!selectedPeer ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-gray-400 font-medium">Select a colleague to start chatting</p>
                    <p className="text-gray-600 text-sm mt-1">Messages are department-scoped and recorded in MORK</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-gray-800 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${deptColor}`}>
                      {selectedPeer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{selectedPeer.name}</p>
                      <p className="text-gray-500 text-xs">{selectedPeer.role} • {employee.department}</p>
                    </div>
                    <button
                      onClick={() => loadConversation(selectedPeer)}
                      className="ml-auto text-gray-500 hover:text-gray-300 text-xs bg-gray-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {conversation.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-600 text-sm">No messages yet. Say hello! 👋</p>
                      </div>
                    ) : (
                      conversation.map((msg) => {
                        const isMe = msg.from_emp_id === employee.emp_id;
                        return (
                          <div key={msg.message_id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                              <div className={`rounded-2xl px-4 py-2.5 ${isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-800 text-gray-100 rounded-bl-sm"}`}>
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                              </div>
                              <p className="text-gray-600 text-xs mt-1 px-1">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {isMe && <span className="ml-1">{msg.is_read ? " ✓✓" : " ✓"}</span>}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="p-4 border-t border-gray-800">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder={`Message ${selectedPeer.name}...`}
                        className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={sendingMsg || !newMessage.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
                      >
                        {sendingMsg ? "..." : "Send"}
                      </button>
                    </div>
                    <p className="text-gray-600 text-xs mt-2">Press Enter to send • Messages recorded in MORK permanently</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ════ TAB: SEARCH ════ */}
        {activeTab === "search" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">🔍 Document Search</h2>
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
              <p className="text-gray-400 text-sm mb-4">
                Search across all
                <span className={`mx-1 ${deptColor} text-white px-2 py-0.5 rounded-full text-xs`}>{employee.department}</span>
                documents using semantic AI search.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search documents... e.g. 'salary information' or 'Q4 revenue'"
                  className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {searchLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            {searchDone && (
              <div>
                <p className="text-gray-400 text-sm mb-4">Found {searchResults.length} results for &quot;{searchQuery}&quot;</p>
                {searchResults.length === 0 ? (
                  <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-gray-400">No documents found matching your search.</p>
                    <p className="text-gray-600 text-sm mt-2">Try different keywords or upload more documents.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.map((result) => (
                      <div key={result.doc_id} className="bg-gray-900 rounded-2xl p-5 border border-gray-800 hover:border-gray-600 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-semibold">📄 {result.title}</h3>
                          <div className="flex items-center gap-2 ml-3">
                            <span className={`${deptColors[result.department] || "bg-gray-600"} text-white px-2 py-0.5 rounded-full text-xs`}>{result.department}</span>
                            <span className="text-gray-500 text-xs">{Math.round(result.relevance * 100)}% match</span>
                          </div>
                        </div>
                        <div className="h-1 bg-gray-800 rounded-full mb-3">
                          <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${Math.round(result.relevance * 100)}%` }} />
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">{result.snippet}</p>
                        <p className="text-gray-600 text-xs mt-2 font-mono">ID: {result.doc_id}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: DOCUMENTS ════ */}
        {activeTab === "docs" && (
          <div className="space-y-6">

            {/* File Upload */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-blue-300 mb-2">📎 Upload File</h2>
              <p className="text-gray-500 text-sm mb-4">
                Upload PDF, TXT, or other text files. Auto-tagged to
                <span className={`ml-1 ${deptColor} text-white px-2 py-0.5 rounded-full text-xs`}>{employee.department}</span>
              </p>
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="Document title"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 mb-3"
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500"}`}
              >
                <div className="text-3xl mb-2">📎</div>
                <p className="text-gray-400 text-sm">Drag and drop a file here</p>
                <p className="text-gray-600 text-xs mt-1">or</p>
                <label className="mt-2 inline-block cursor-pointer">
                  <span className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors">
                    {fileLoading ? "Uploading..." : "Browse File"}
                  </span>
                  <input
                    type="file"
                    accept=".txt,.pdf,.md,.csv"
                    className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }}
                  />
                </label>
                <p className="text-gray-600 text-xs mt-2">Supports: TXT, PDF, MD, CSV</p>
              </div>
              {fileResult && (
                <div className={`mt-3 rounded-xl p-4 text-sm ${fileResult.includes("✅") ? "bg-green-900/30 text-green-300 border border-green-800" : "bg-red-900/30 text-red-300 border border-red-800"}`}>
                  {fileResult}
                </div>
              )}
            </div>

            {/* Text Upload */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-blue-300 mb-2">📄 Upload Text Document</h2>
              <p className="text-gray-500 text-sm mb-4">
                Paste text content directly. Auto-tagged to
                <span className={`ml-1 ${deptColor} text-white px-2 py-0.5 rounded-full text-xs`}>{deptIcon} {employee.department}</span>
              </p>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document title"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 mb-3"
              />
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Document content..."
                rows={4}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 mb-3"
              />
              <button
                onClick={handleAddDocument}
                disabled={docLoading}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                {docLoading ? "Uploading..." : `Upload to ${employee.department}`}
              </button>
              {docResult && (
                <div className="mt-3 bg-gray-800 rounded-xl p-4 border border-green-800">
                  <p className="text-green-300 text-sm">{docResult}</p>
                </div>
              )}
            </div>

            {/* Delete Document */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold text-blue-300 mb-4">🗑️ Delete Document</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={deleteId}
                  onChange={(e) => setDeleteId(e.target.value)}
                  placeholder="Paste doc_id here"
                  className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-red-500 placeholder-gray-500"
                />
                <button
                  onClick={handleDeleteDocument}
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
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
          </div>
        )}

        {/* ════ TAB: ANALYTICS ════ */}
        {activeTab === "analytics" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">📊 Analytics Dashboard</h2>
              <button onClick={loadAnalytics} className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-4 py-2 rounded-xl text-sm transition-colors">🔄 Refresh</button>
            </div>

            {analyticsLoading ? (
              <div className="text-gray-500 text-center py-12">Loading analytics...</div>
            ) : analytics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Employees", value: analytics.total_employees, icon: "👥", color: "border-blue-500" },
                    { label: "AI Queries", value: analytics.total_ai_queries, icon: "🤖", color: "border-purple-500" },
                    { label: "Documents", value: analytics.total_documents, icon: "📄", color: "border-yellow-500" },
                    { label: "Messages", value: analytics.total_messages, icon: "💬", color: "border-green-500" },
                  ].map((stat) => (
                    <div key={stat.label} className={`bg-gray-900 rounded-2xl p-5 border border-gray-800 border-l-4 ${stat.color}`}>
                      <div className="text-2xl mb-2">{stat.icon}</div>
                      <div className="text-3xl font-bold text-white">{stat.value}</div>
                      <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-white font-semibold mb-4">📋 Task Overview</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Todo", value: analytics.tasks_todo, color: "bg-gray-500", emoji: "📋" },
                      { label: "In Progress", value: analytics.tasks_in_progress, color: "bg-blue-500", emoji: "⚙️" },
                      { label: "Done", value: analytics.tasks_done, color: "bg-green-500", emoji: "✅" },
                      { label: "Urgent", value: analytics.tasks_urgent, color: "bg-red-500", emoji: "🚨" },
                    ].map((item) => {
                      const total = analytics.tasks_todo + analytics.tasks_in_progress + analytics.tasks_done;
                      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">{item.emoji} {item.label}</span>
                            <span className="text-white font-medium">{item.value} <span className="text-gray-500">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full">
                            <div className={`h-2 ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(analytics.tasks_todo + analytics.tasks_in_progress + analytics.tasks_done) > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <p className="text-gray-400 text-sm">
                        Completion Rate:
                        <span className="text-green-400 font-bold ml-2 text-lg">
                          {Math.round((analytics.tasks_done / (analytics.tasks_todo + analytics.tasks_in_progress + analytics.tasks_done)) * 100)}%
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-white font-semibold mb-4">🏢 Department Activity</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {["Department", "Employees", "Tasks", "Done", "Documents", "Completion"].map((h) => (
                            <th key={h} className="text-left p-3 text-gray-400 text-xs font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.dept_stats.filter(d => d.employees > 0).map((dept) => {
                          const completionPct = dept.tasks > 0 ? Math.round((dept.tasks_done / dept.tasks) * 100) : 0;
                          return (
                            <tr key={dept.department} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                              <td className="p-3">
                                <span className={`${deptColors[dept.department] || "bg-gray-600"} text-white px-2 py-0.5 rounded-full text-xs`}>{dept.department}</span>
                              </td>
                              <td className="p-3 text-white text-sm">{dept.employees}</td>
                              <td className="p-3 text-white text-sm">{dept.tasks}</td>
                              <td className="p-3 text-green-400 text-sm">{dept.tasks_done}</td>
                              <td className="p-3 text-white text-sm">{dept.documents}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full">
                                    <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${completionPct}%` }} />
                                  </div>
                                  <span className="text-gray-400 text-xs w-8">{completionPct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data yet. Start using the platform to see analytics!</p>
            )}
          </div>
        )}

        {/* ════ TAB: HISTORY ════ */}
        {activeTab === "history" && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-blue-300">📚 MORK Event History</h2>
              <button
                onClick={handleHistory}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
              >
                {historyLoading ? "Loading..." : "🔄 Refresh"}
              </button>
            </div>
            {!showHistory && <p className="text-gray-600 text-sm">Click Refresh to see all events ever recorded in MORK</p>}
            {showHistory && (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-gray-500 text-sm">No events yet.</p>
                ) : (
                  history.map((event, i) => (
                    <div
                      key={i}
                      className={`bg-gray-800 rounded-lg p-3 border font-mono text-xs ${
                        event.includes("TaskCreated") ? "border-blue-800 text-blue-300" :
                        event.includes("TaskUpdated") ? "border-green-800 text-green-300" :
                        event.includes("DocumentAdded") ? "border-yellow-800 text-yellow-300" :
                        event.includes("Tombstone") ? "border-red-800 text-red-300" :
                        event.includes("MessageSent") ? "border-teal-800 text-teal-300" :
                        event.includes("UserInput") ? "border-purple-800 text-purple-300" :
                        "border-gray-700 text-gray-300"
                      }`}
                    >
                      #{i + 1}: {event}
                    </div>
                  ))
                )}
                <div className="text-gray-500 text-xs pt-2">Total events: {history.length}</div>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: ADMIN (CEO only) ════ */}
        {activeTab === "admin" && employee.department === "CEO" && (
          <AdminPanel employee={employee} />
        )}

      </div>

      {/* Change Password Modal */}
      {showChangePwd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">🔑 Change Password</h3>
              <button onClick={() => { setShowChangePwd(false); setChangePwdResult(""); setOldPassword(""); setNewPassword(""); }} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Current Password</label>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500" />
              </div>
              <button onClick={handleChangePassword} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">Change Password</button>
              {changePwdResult && (
                <div className={`rounded-xl p-3 text-sm ${changePwdResult.includes("✅") ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"}`}>
                  {changePwdResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

// ─────────────────────────────────────────────
// Admin Panel Component (CEO only)
// ─────────────────────────────────────────────

function AdminPanel({ employee }: { employee: Employee }) {

  const API = "http://127.0.0.1:8000";

  interface Stats {
    total_employees: number;
    total_events: number;
    total_tasks: number;
    total_tasks_done: number;
    departments: Array<{ name: string; employee_count: number; task_count: number; }>;
  }

  interface EmployeeInfo {
    emp_id: string;
    name: string;
    department: string;
    role: string;
  }

  const [stats, setStats] = useState<Stats | null>(null);
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [adminView, setAdminView] = useState<"stats" | "employees" | "add">("stats");
  const [newEmpId, setNewEmpId] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("HR");
  const [newEmpRole, setNewEmpRole] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [addResult, setAddResult] = useState("");
  const [deactivateId, setDeactivateId] = useState("");
  const [deactivateResult, setDeactivateResult] = useState("");

  const deptColors: Record<string, string> = {
    HR: "bg-pink-600", Finance: "bg-green-600", Legal: "bg-yellow-600",
    Engineering: "bg-blue-600", CEO: "bg-purple-600",
  };

  useEffect(() => { loadStats(); loadEmployees(); }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API}/admin/stats`);
      const data = await res.json();
      setStats(data);
    } catch { console.error("Failed to load stats"); }
    setStatsLoading(false);
  };

  const loadEmployees = async () => {
    try {
      const res = await fetch(`${API}/admin/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch { console.error("Failed to load employees"); }
  };

  const handleAddEmployee = async () => {
    if (!newEmpId || !newEmpName || !newEmpRole || !newEmpPassword) return;
    try {
      // Add employee to registry
      const empRes = await fetch(`${API}/admin/add_employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_emp_id: employee.emp_id, emp_id: newEmpId, name: newEmpName, department: newEmpDept, role: newEmpRole }),
      });
      const empData = await empRes.json();

      if (empData.success) {
        // Create auth account for new employee
        await fetch(`${API}/auth/create_account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_emp_id: employee.emp_id, emp_id: newEmpId, password: newEmpPassword }),
        });
        setAddResult(`✅ Employee added! ID: ${newEmpId}, Password: ${newEmpPassword}`);
        setNewEmpId(""); setNewEmpName(""); setNewEmpRole(""); setNewEmpPassword("");
        await loadEmployees(); await loadStats();
      } else {
        setAddResult(empData.message);
      }
    } catch { setAddResult("❌ Error adding employee."); }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    try {
      const res = await fetch(`${API}/admin/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_emp_id: employee.emp_id, emp_id: deactivateId }),
      });
      const data = await res.json();
      setDeactivateResult(data.message);
      if (data.success) { setDeactivateId(""); await loadEmployees(); await loadStats(); }
    } catch { setDeactivateResult("❌ Error deactivating employee."); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">👑 Admin Panel</h2>
        <span className="text-gray-500 text-sm">CEO Access Only</span>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { id: "stats", label: "📊 Platform Stats" },
          { id: "employees", label: "👥 All Employees" },
          { id: "add", label: "➕ Add Employee" },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setAdminView(v.id as "stats" | "employees" | "add")}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${adminView === v.id ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {adminView === "stats" && (
        <div>
          {statsLoading ? (
            <p className="text-gray-500">Loading stats...</p>
          ) : stats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Employees", value: stats.total_employees, icon: "👥", color: "border-blue-600" },
                  { label: "Total Events", value: stats.total_events, icon: "📝", color: "border-purple-600" },
                  { label: "Total Tasks", value: stats.total_tasks, icon: "📋", color: "border-yellow-600" },
                  { label: "Tasks Done", value: stats.total_tasks_done, icon: "✅", color: "border-green-600" },
                ].map((stat) => (
                  <div key={stat.label} className={`bg-gray-900 rounded-2xl p-5 border-l-4 ${stat.color} border border-gray-800`}>
                    <div className="text-3xl mb-1">{stat.icon}</div>
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                    <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4">Department Overview</h3>
                <div className="space-y-3">
                  {stats.departments.map((dept) => (
                    <div key={dept.name} className="flex items-center justify-between bg-gray-800 rounded-xl p-4">
                      <span className={`${deptColors[dept.name] || "bg-gray-600"} text-white px-3 py-1 rounded-full text-xs font-semibold`}>{dept.name}</span>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center"><div className="text-white font-bold">{dept.employee_count}</div><div className="text-gray-500 text-xs">Employees</div></div>
                        <div className="text-center"><div className="text-white font-bold">{dept.task_count}</div><div className="text-gray-500 text-xs">Tasks</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { loadStats(); loadEmployees(); }} className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-4 py-2 rounded-xl text-sm transition-colors">🔄 Refresh Stats</button>
            </div>
          ) : (
            <p className="text-gray-500">No stats available.</p>
          )}
        </div>
      )}

      {adminView === "employees" && (
        <div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {["ID", "Name", "Department", "Role"].map((h) => (
                    <th key={h} className="text-left p-4 text-gray-400 text-sm font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.emp_id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="p-4 font-mono text-gray-300 text-sm">{emp.emp_id}</td>
                    <td className="p-4 text-white font-medium">{emp.name}</td>
                    <td className="p-4"><span className={`${deptColors[emp.department] || "bg-gray-600"} text-white px-2 py-0.5 rounded-full text-xs`}>{emp.department}</span></td>
                    <td className="p-4 text-gray-400 text-sm">{emp.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 border border-red-900">
            <h3 className="text-lg font-semibold text-red-400 mb-4">⚠️ Deactivate Employee</h3>
            <div className="flex gap-3">
              <input type="text" value={deactivateId} onChange={(e) => setDeactivateId(e.target.value)} placeholder="Employee ID to deactivate" className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-red-500 placeholder-gray-500 text-sm" />
              <button onClick={handleDeactivate} className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">Deactivate</button>
            </div>
            {deactivateResult && <div className="mt-3 bg-gray-800 rounded-xl p-3 text-red-300 text-sm">{deactivateResult}</div>}
          </div>
        </div>
      )}

      {adminView === "add" && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-blue-300 mb-6">➕ Add New Employee</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Employee ID *</label>
              <input type="text" value={newEmpId} onChange={(e) => setNewEmpId(e.target.value)} placeholder="e.g. 0009" className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm font-mono" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Full Name *</label>
              <input type="text" value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} placeholder="e.g. Rahul Singh" className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Department *</label>
              <div className="flex flex-wrap gap-2">
                {["HR", "Finance", "Legal", "Engineering", "CEO"].map((d) => (
                  <button key={d} onClick={() => setNewEmpDept(d)} className={`px-3 py-2 rounded-xl text-sm transition-colors ${newEmpDept === d ? `${deptColors[d]} text-white` : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Role/Title *</label>
              <input type="text" value={newEmpRole} onChange={(e) => setNewEmpRole(e.target.value)} placeholder="e.g. Senior Engineer" className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-gray-400 text-xs mb-1 block">Initial Password *</label>
            <input type="text" value={newEmpPassword} onChange={(e) => setNewEmpPassword(e.target.value)} placeholder="e.g. TempPass123!" className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm" />
            <p className="text-gray-600 text-xs mt-1">Share this with the employee. They can change it after login.</p>
          </div>
          {newEmpId && newEmpName && (
            <div className="mb-4 bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-gray-400 text-xs mb-2">Preview:</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-gray-300 text-sm">{newEmpId}</span>
                <span className="text-white font-medium">{newEmpName}</span>
                <span className={`${deptColors[newEmpDept]} text-white px-2 py-0.5 rounded-full text-xs`}>{newEmpDept}</span>
                <span className="text-gray-400 text-sm">{newEmpRole}</span>
              </div>
            </div>
          )}
          <button onClick={handleAddEmployee} className="bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">➕ Add Employee</button>
          {addResult && (
            <div className={`mt-3 rounded-xl p-3 text-sm ${addResult.includes("✅") ? "bg-green-900/30 text-green-300 border border-green-800" : "bg-red-900/30 text-red-300 border border-red-800"}`}>
              {addResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
