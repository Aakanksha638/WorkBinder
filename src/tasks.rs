// tasks.rs
// Task management system for WorkBindr
// Every task is recorded in MORK permanently
// Tasks have priority levels and status flow

use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::fs;

// ─────────────────────────────────────────────
// Priority Enum
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

impl Priority {
    pub fn from_str(s: &str) -> Option<Priority> {
        match s.to_uppercase().as_str() {
            "LOW"    => Some(Priority::Low),
            "MEDIUM" => Some(Priority::Medium),
            "HIGH"   => Some(Priority::High),
            "URGENT" => Some(Priority::Urgent),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            Priority::Low    => "Low",
            Priority::Medium => "Medium",
            Priority::High   => "High",
            Priority::Urgent => "Urgent",
        }
    }

    // Emoji for each priority level
    // Makes frontend display nicer
    pub fn emoji(&self) -> &str {
        match self {
            Priority::Low    => "🟢",
            Priority::Medium => "🟡",
            Priority::High   => "🔴",
            Priority::Urgent => "🚨",
        }
    }
}

// ─────────────────────────────────────────────
// Status Enum
// Todo → In Progress → Done
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
}

impl TaskStatus {
    pub fn from_str(s: &str) -> Option<TaskStatus> {
        match s.to_uppercase().as_str() {
            "TODO"        => Some(TaskStatus::Todo),
            "INPROGRESS"  => Some(TaskStatus::InProgress),
            "IN_PROGRESS" => Some(TaskStatus::InProgress),
            "DONE"        => Some(TaskStatus::Done),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            TaskStatus::Todo       => "Todo",
            TaskStatus::InProgress => "InProgress",
            TaskStatus::Done       => "Done",
        }
    }

    pub fn emoji(&self) -> &str {
        match self {
            TaskStatus::Todo       => "📋",
            TaskStatus::InProgress => "⚙️",
            TaskStatus::Done       => "✅",
        }
    }
}

// ─────────────────────────────────────────────
// Task Struct — One Task Record
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Task {
    pub task_id: String,          // unique ID e.g. "task_1234567890"
    pub title: String,            // short name of task
    pub description: String,      // full details
    pub priority: Priority,       // Low/Medium/High/Urgent
    pub status: TaskStatus,       // Todo/InProgress/Done
    pub created_by: String,       // emp_id of creator e.g. "0001"
    pub assigned_to: String,      // emp_id of assignee e.g. "0003"
    pub department: String,       // which department owns this task
    pub created_at: u128,         // timestamp when created
    pub updated_at: u128,         // timestamp when last updated
}

// ─────────────────────────────────────────────
// Task Store — Holds ALL Tasks
// ─────────────────────────────────────────────

pub struct TaskStore {
    pub tasks: Mutex<Vec<Task>>,
    file_path: String,
}

impl TaskStore {

    // Create new TaskStore
    // Loads existing tasks from disk automatically
    pub fn new(file_path: &str) -> Self {
        println!("📋 Loading task store from disk...");

        let existing_tasks = match Self::load_from_disk(file_path) {
            Ok(tasks) => {
                println!("  ✅ Loaded {} tasks from disk", tasks.len());
                tasks
            }
            Err(_) => {
                println!("  ℹ️  No existing tasks, starting fresh");
                Vec::new()
            }
        };

        TaskStore {
            tasks: Mutex::new(existing_tasks),
            file_path: file_path.to_string(),
        }
    }

    // Load tasks from JSON file
    fn load_from_disk(file_path: &str) -> Result<Vec<Task>, String> {
        let json = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read: {}", e))?;
        let tasks: Vec<Task> = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse: {}", e))?;
        Ok(tasks)
    }

    // Save all tasks to disk
    pub fn save_to_disk(&self) -> Result<(), String> {
        let tasks = self.tasks.lock().unwrap();
        let json = serde_json::to_string_pretty(&*tasks)
            .map_err(|e| format!("Failed to serialize: {}", e))?;
        fs::write(&self.file_path, json)
            .map_err(|e| format!("Failed to write: {}", e))?;
        println!("  💾 Saved {} tasks to disk", tasks.len());
        Ok(())
    }

    // Add a new task and save immediately
    pub fn add_task(&self, task: Task) -> Result<(), String> {
        {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.push(task);
        }
        self.save_to_disk()
    }

    // Update task status
    // Returns true if found and updated, false if not found
    pub fn update_status(
        &self,
        task_id: &str,
        new_status: TaskStatus,
        emp_id: &str,
        timestamp: u128,
    ) -> bool {
        let mut tasks = self.tasks.lock().unwrap();

        for task in tasks.iter_mut() {
            if task.task_id == task_id {
                // Only assigned employee or CEO can update
                if task.assigned_to == emp_id || emp_id == "0000" {
                    task.status = new_status;
                    task.updated_at = timestamp;
                    drop(tasks); // release lock before saving
                    let _ = self.save_to_disk();
                    return true;
                } else {
                    return false; // found but no permission
                }
            }
        }
        false // not found
    }

    // Get ALL tasks for a specific employee
    // (tasks assigned TO them)
    pub fn get_tasks_for_employee(&self, emp_id: &str) -> Vec<Task> {
        let tasks = self.tasks.lock().unwrap();
        tasks.iter()
            .filter(|t| t.assigned_to == emp_id)
            .cloned()
            .collect()
    }

    // Get ALL tasks created BY an employee
    pub fn get_tasks_created_by(&self, emp_id: &str) -> Vec<Task> {
        let tasks = self.tasks.lock().unwrap();
        tasks.iter()
            .filter(|t| t.created_by == emp_id)
            .cloned()
            .collect()
    }

    // Get ALL tasks for a department
    pub fn get_tasks_by_department(&self, department: &str) -> Vec<Task> {
        let tasks = self.tasks.lock().unwrap();
        tasks.iter()
            .filter(|t| t.department == department)
            .cloned()
            .collect()
    }

    // Get a single task by ID
    pub fn get_task(&self, task_id: &str) -> Option<Task> {
        let tasks = self.tasks.lock().unwrap();
        tasks.iter()
            .find(|t| t.task_id == task_id)
            .cloned()
    }

    // Get ALL tasks (for CEO/admin)
    pub fn get_all_tasks(&self) -> Vec<Task> {
        self.tasks.lock().unwrap().clone()
    }
}