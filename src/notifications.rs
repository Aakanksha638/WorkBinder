// notifications.rs
// Notification system for WorkBindr
// Stores alerts for each employee
// Persists to disk so notifications survive restarts

use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────
// Notification Type
// What kind of alert is this?
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum NotificationType {
    TaskAssigned,      // someone assigned a task to you
    TaskCompleted,     // a task you created was completed
    DocumentAdded,     // new doc added to your department
    NewEmployee,       // new employee joined (CEO only)
}

impl NotificationType {
    pub fn emoji(&self) -> &str {
        match self {
            NotificationType::TaskAssigned  => "📋",
            NotificationType::TaskCompleted => "✅",
            NotificationType::DocumentAdded => "📄",
            NotificationType::NewEmployee   => "👤",
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            NotificationType::TaskAssigned  => "TaskAssigned",
            NotificationType::TaskCompleted => "TaskCompleted",
            NotificationType::DocumentAdded => "DocumentAdded",
            NotificationType::NewEmployee   => "NewEmployee",
        }
    }
}

// ─────────────────────────────────────────────
// Notification Struct
// One notification record
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Notification {
    pub notification_id: String,     // unique ID
    pub emp_id:          String,     // who receives this
    pub notification_type: NotificationType,
    pub title:           String,     // short title
    pub message:         String,     // full message
    pub is_read:         bool,       // has it been seen?
    pub created_at:      u128,       // when it was created
    pub related_id:      String,     // task_id or doc_id it relates to
}

// ─────────────────────────────────────────────
// Notification Store
// ─────────────────────────────────────────────

pub struct NotificationStore {
    notifications: Mutex<Vec<Notification>>,
    file_path:     String,
}

impl NotificationStore {

    pub fn new(file_path: &str) -> Self {
        println!("🔔 Loading notification store...");

        let existing = match Self::load_from_disk(file_path) {
            Ok(n) => {
                println!("  ✅ Loaded {} notifications", n.len());
                n
            }
            Err(_) => {
                println!("  ℹ️  No existing notifications");
                Vec::new()
            }
        };

        NotificationStore {
            notifications: Mutex::new(existing),
            file_path: file_path.to_string(),
        }
    }

    fn load_from_disk(file_path: &str) -> Result<Vec<Notification>, String> {
        let json = fs::read_to_string(file_path)
            .map_err(|e| format!("Read failed: {}", e))?;
        let notifications: Vec<Notification> = serde_json::from_str(&json)
            .map_err(|e| format!("Parse failed: {}", e))?;
        Ok(notifications)
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let notifications = self.notifications.lock().unwrap();
        let json = serde_json::to_string_pretty(&*notifications)
            .map_err(|e| format!("Serialize failed: {}", e))?;
        fs::write(&self.file_path, json)
            .map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    // Generate unique notification ID
    fn generate_id() -> String {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();
        format!("notif_{}", timestamp)
    }

    // Create and save a new notification
    pub fn create(
        &self,
        emp_id:            String,
        notification_type: NotificationType,
        title:             String,
        message:           String,
        related_id:        String,
    ) -> Result<(), String> {

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();

        let notification = Notification {
            notification_id: Self::generate_id(),
            emp_id,
            notification_type,
            title,
            message,
            is_read: false,
            created_at: timestamp,
            related_id,
        };

        {
            let mut notifications = self.notifications.lock().unwrap();
            notifications.push(notification);
        }

        self.save_to_disk()
    }

    // Get ALL notifications for one employee
    // Most recent first
    pub fn get_for_employee(&self, emp_id: &str) -> Vec<Notification> {
        let notifications = self.notifications.lock().unwrap();
        let mut result: Vec<Notification> = notifications
            .iter()
            .filter(|n| n.emp_id == emp_id)
            .cloned()
            .collect();

        // Sort by created_at descending (newest first)
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        result
    }

    // Get UNREAD count for one employee
    pub fn get_unread_count(&self, emp_id: &str) -> usize {
        let notifications = self.notifications.lock().unwrap();
        notifications
            .iter()
            .filter(|n| n.emp_id == emp_id && !n.is_read)
            .count()
    }

    // Mark ONE notification as read
    pub fn mark_as_read(&self, notification_id: &str) -> Result<(), String> {
        {
            let mut notifications = self.notifications.lock().unwrap();
            for notif in notifications.iter_mut() {
                if notif.notification_id == notification_id {
                    notif.is_read = true;
                    break;
                }
            }
        }
        self.save_to_disk()
    }

    // Mark ALL notifications as read for one employee
    pub fn mark_all_read(&self, emp_id: &str) -> Result<(), String> {
        {
            let mut notifications = self.notifications.lock().unwrap();
            for notif in notifications.iter_mut() {
                if notif.emp_id == emp_id {
                    notif.is_read = true;
                }
            }
        }
        self.save_to_disk()
    }
}