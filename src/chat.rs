// chat.rs
// Department-scoped direct messaging system
// Messages are permanent — recorded in MORK
// Only employees in the same department can message each other

use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────
// Message Struct
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_id:  String,
    pub from_emp_id: String,   // who sent it
    pub to_emp_id:   String,   // who receives it
    pub content:     String,   // the actual message text
    pub department:  String,   // which department this belongs to
    pub is_read:     bool,     // has receiver seen it?
    pub created_at:  u128,     // timestamp
}

// ─────────────────────────────────────────────
// Conversation Key
// Used to look up messages between two employees
// Always sorted so "0001_0002" == "0002_0001"
// ─────────────────────────────────────────────

pub fn conversation_key(emp_a: &str, emp_b: &str) -> String {
    let mut ids = vec![emp_a, emp_b];
    ids.sort(); // sort so order doesn't matter
    format!("{}_{}", ids[0], ids[1])
}

// ─────────────────────────────────────────────
// Chat Store
// ─────────────────────────────────────────────

pub struct ChatStore {
    messages:  Mutex<Vec<Message>>,
    file_path: String,
}

impl ChatStore {

    pub fn new(file_path: &str) -> Self {
        println!("💬 Loading chat store from disk...");

        let existing = match Self::load_from_disk(file_path) {
            Ok(msgs) => {
                println!("  ✅ Loaded {} messages", msgs.len());
                msgs
            }
            Err(_) => {
                println!("  ℹ️  No existing messages, starting fresh");
                Vec::new()
            }
        };

        ChatStore {
            messages: Mutex::new(existing),
            file_path: file_path.to_string(),
        }
    }

    fn load_from_disk(file_path: &str) -> Result<Vec<Message>, String> {
        let json = fs::read_to_string(file_path)
            .map_err(|e| format!("Read failed: {}", e))?;
        let messages: Vec<Message> = serde_json::from_str(&json)
            .map_err(|e| format!("Parse failed: {}", e))?;
        Ok(messages)
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let messages = self.messages.lock().unwrap();
        let json = serde_json::to_string_pretty(&*messages)
            .map_err(|e| format!("Serialize failed: {}", e))?;
        fs::write(&self.file_path, json)
            .map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    fn generate_id() -> String {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();
        format!("msg_{}", ts)
    }

    // Send a new message
    pub fn send_message(
        &self,
        from_emp_id: String,
        to_emp_id:   String,
        content:     String,
        department:  String,
    ) -> Result<Message, String> {

        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();

        let message = Message {
            message_id:  Self::generate_id(),
            from_emp_id: from_emp_id.clone(),
            to_emp_id:   to_emp_id.clone(),
            content:     content.clone(),
            department:  department.clone(),
            is_read:     false,
            created_at:  ts,
        };

        {
            let mut messages = self.messages.lock().unwrap();
            messages.push(message.clone());
        }

        self.save_to_disk()?;
        Ok(message)
    }

    // Get conversation between two employees
    // Returns messages in chronological order
    pub fn get_conversation(
        &self,
        emp_a: &str,
        emp_b: &str,
    ) -> Vec<Message> {
        let messages = self.messages.lock().unwrap();
        let mut result: Vec<Message> = messages
            .iter()
            .filter(|m| {
                (m.from_emp_id == emp_a && m.to_emp_id == emp_b)
                || (m.from_emp_id == emp_b && m.to_emp_id == emp_a)
            })
            .cloned()
            .collect();

        // Sort chronologically (oldest first)
        result.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        result
    }

    // Get unread message count for an employee
    pub fn get_unread_count(&self, emp_id: &str) -> usize {
        let messages = self.messages.lock().unwrap();
        messages
            .iter()
            .filter(|m| m.to_emp_id == emp_id && !m.is_read)
            .count()
    }

    // Get unread count from a specific sender
    pub fn get_unread_from(
        &self,
        from_emp_id: &str,
        to_emp_id:   &str,
    ) -> usize {
        let messages = self.messages.lock().unwrap();
        messages
            .iter()
            .filter(|m| {
                m.from_emp_id == from_emp_id
                && m.to_emp_id == to_emp_id
                && !m.is_read
            })
            .count()
    }

    // Mark all messages in a conversation as read
    pub fn mark_conversation_read(
        &self,
        reader_emp_id: &str,
        other_emp_id:  &str,
    ) -> Result<(), String> {
        {
            let mut messages = self.messages.lock().unwrap();
            for msg in messages.iter_mut() {
                if msg.to_emp_id == reader_emp_id
                    && msg.from_emp_id == other_emp_id
                {
                    msg.is_read = true;
                }
            }
        }
        self.save_to_disk()
    }

    // Get list of employees who have chatted with this employee
    // Used to show conversation list in sidebar
    pub fn get_conversation_partners(&self, emp_id: &str) -> Vec<String> {
        let messages = self.messages.lock().unwrap();
        let mut partners: Vec<String> = messages
            .iter()
            .filter(|m| {
                m.from_emp_id == emp_id || m.to_emp_id == emp_id
            })
            .map(|m| {
                if m.from_emp_id == emp_id {
                    m.to_emp_id.clone()
                } else {
                    m.from_emp_id.clone()
                }
            })
            .collect();

        // Deduplicate
        partners.sort();
        partners.dedup();
        partners
    }
}