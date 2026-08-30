// logger.rs
// Structured logging for WorkBindr
// Think of this as the difference between:
//   println!("User logged in") ← useless in production
// and:
//   log_auth_success("0001", "HR", "192.168.1.1") ← searchable, structured
//
// In production these logs go to:
// - Datadog
// - AWS CloudWatch
// - Grafana Loki
// - Elasticsearch
// For now we write to a log file AND console

use std::fs::OpenOptions;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────
// Log Levels
// ─────────────────────────────────────────────

pub enum LogLevel {
    Info,    // normal operations
    Warn,    // something unusual but not breaking
    Error,   // something broke but server still runs
    Security, // security-relevant events (login, access denied)
    Audit,   // compliance-relevant (who did what when)
}

impl LogLevel {
    fn as_str(&self) -> &str {
        match self {
            LogLevel::Info     => "INFO",
            LogLevel::Warn     => "WARN",
            LogLevel::Error    => "ERROR",
            LogLevel::Security => "SECURITY",
            LogLevel::Audit    => "AUDIT",
        }
    }

    fn emoji(&self) -> &str {
        match self {
            LogLevel::Info     => "ℹ️",
            LogLevel::Warn     => "⚠️",
            LogLevel::Error    => "❌",
            LogLevel::Security => "🔐",
            LogLevel::Audit    => "📋",
        }
    }
}

// ─────────────────────────────────────────────
// Core Logger
// ─────────────────────────────────────────────

pub struct Logger {
    log_file: String,
}

impl Logger {
    pub fn new(log_file: &str) -> Self {
        Logger { log_file: log_file.to_string() }
    }

    // Core logging function
    // Every log entry has: timestamp, level, category, message, data
    fn log(
        &self,
        level:    LogLevel,
        category: &str,
        message:  &str,
        data:     Option<&str>,
    ) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();

        // Build structured log entry as JSON-like string
        // In production this would be actual JSON for log parsers
        let entry = match data {
            Some(d) => format!(
                "[{}] {} {} | {} | {} | data={}",
                timestamp,
                level.emoji(),
                level.as_str(),
                category,
                message,
                d
            ),
            None => format!(
                "[{}] {} {} | {} | {}",
                timestamp,
                level.emoji(),
                level.as_str(),
                category,
                message
            ),
        };

        // Print to console
        println!("{}", entry);

        // Write to log file
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_file)
        {
            let _ = writeln!(file, "{}", entry);
        }
    }

    // ── Specific Log Functions ────────────────
    // Each function is for a specific type of event
    // This makes logs searchable and consistent

    pub fn info(&self, category: &str, message: &str) {
        self.log(LogLevel::Info, category, message, None);
    }

    pub fn info_with_data(&self, category: &str, message: &str, data: &str) {
        self.log(LogLevel::Info, category, message, Some(data));
    }

    pub fn warn(&self, category: &str, message: &str) {
        self.log(LogLevel::Warn, category, message, None);
    }

    pub fn error(&self, category: &str, message: &str, error: &str) {
        self.log(LogLevel::Error, category, message, Some(error));
    }

    pub fn security(&self, category: &str, message: &str, data: &str) {
        self.log(LogLevel::Security, category, message, Some(data));
    }

    pub fn audit(&self, category: &str, message: &str, data: &str) {
        self.log(LogLevel::Audit, category, message, Some(data));
    }

    // ── Common Log Patterns ───────────────────

    pub fn log_login_success(&self, emp_id: &str, department: &str) {
        self.security(
            "AUTH",
            "Login successful",
            &format!("emp_id={} department={}", emp_id, department)
        );
    }

    pub fn log_login_failed(&self, emp_id: &str, reason: &str) {
        self.security(
            "AUTH",
            "Login failed",
            &format!("emp_id={} reason={}", emp_id, reason)
        );
    }

    pub fn log_access_denied(&self, emp_id: &str, resource: &str, reason: &str) {
        self.security(
            "ACCESS",
            "Access denied",
            &format!("emp_id={} resource={} reason={}", emp_id, resource, reason)
        );
    }

    pub fn log_event_recorded(&self, event_type: &str, actor: &str) {
        self.audit(
            "MORK",
            &format!("{} event recorded", event_type),
            &format!("actor={}", actor)
        );
    }

    pub fn log_document_uploaded(
        &self,
        emp_id:     &str,
        doc_id:     &str,
        department: &str,
    ) {
        self.audit(
            "DOCUMENT",
            "Document uploaded",
            &format!(
                "emp_id={} doc_id={} department={}",
                emp_id, doc_id, department
            )
        );
    }

    pub fn log_task_created(
        &self,
        created_by:  &str,
        assigned_to: &str,
        task_id:     &str,
        priority:    &str,
    ) {
        self.audit(
            "TASK",
            "Task created",
            &format!(
                "created_by={} assigned_to={} task_id={} priority={}",
                created_by, assigned_to, task_id, priority
            )
        );
    }

    pub fn log_ai_query(
        &self,
        emp_id:     &str,
        query_id:   &str,
        found_doc:  bool,
        similarity: f32,
    ) {
        self.info_with_data(
            "AI",
            "Query processed",
            &format!(
                "emp_id={} query_id={} found_doc={} similarity={:.2}",
                emp_id, query_id, found_doc, similarity
            )
        );
    }

    pub fn log_api_error(
        &self,
        endpoint: &str,
        emp_id:   &str,
        error:    &str,
    ) {
        self.error(
            "API",
            &format!("Error in {}", endpoint),
            &format!("emp_id={} error={}", emp_id, error)
        );
    }
}