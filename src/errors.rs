// errors.rs
// Central error handling for WorkBindr
// Every possible error in the system is defined here
// This means:
// 1. Errors are consistent across all endpoints
// 2. The server NEVER crashes from an unhandled error
// 3. Users always get a clear error message
// 4. Developers can trace exactly what went wrong

use rocket::serde::json::Json;
use rocket::response::status;
use rocket::http::Status;
use serde::Serialize;

// ─────────────────────────────────────────────
// Standard Error Response
// Every error from every endpoint looks like this
// Consistent format = easier for frontend to handle
// ─────────────────────────────────────────────

#[derive(Serialize, Debug)]
pub struct ErrorResponse {
    pub success:    bool,      // always false for errors
    pub error_code: String,    // machine-readable code e.g. "AUTH_FAILED"
    pub message:    String,    // human-readable message
    pub details:    Option<String>, // optional extra info for debugging
}

impl ErrorResponse {
    pub fn new(error_code: &str, message: &str) -> Self {
        ErrorResponse {
            success:    false,
            error_code: error_code.to_string(),
            message:    message.to_string(),
            details:    None,
        }
    }

    pub fn with_details(error_code: &str, message: &str, details: &str) -> Self {
        ErrorResponse {
            success:    false,
            error_code: error_code.to_string(),
            message:    message.to_string(),
            details:    Some(details.to_string()),
        }
    }
}

// ─────────────────────────────────────────────
// WorkBindr Error Types
// Every possible error has a specific type
// Like a menu of all things that can go wrong
// ─────────────────────────────────────────────

#[derive(Debug)]
pub enum WorkBindrError {
    // Authentication errors
    EmployeeNotFound(String),      // emp_id not in registry
    InvalidPassword,               // wrong password
    InvalidToken,                  // JWT expired or tampered
    AccessDenied(String),          // no permission for this action

    // Storage errors
    MorkWriteFailed(String),       // failed to write to event log
    MorkReadFailed(String),        // failed to read from event log
    DocumentSaveFailed(String),    // failed to save document
    TaskSaveFailed(String),        // failed to save task

    // Validation errors
    EmptyField(String),            // required field is empty
    InvalidFormat(String),         // field has wrong format
    InvalidDepartment(String),     // department doesn't exist
    InvalidPriority(String),       // priority doesn't exist
    InvalidStatus(String),         // status doesn't exist

    // External service errors
    AIServiceFailed(String),       // Groq API failed
    EmbeddingFailed(String),       // Jina API failed

    // Business logic errors
    DuplicateEmployee(String),     // emp_id already exists
    SelfDeactivation,              // tried to deactivate yourself
    CrossDepartmentMessage,        // tried to message another dept
    TaskNotFound(String),          // task_id doesn't exist
    NotTaskAssignee,               // not assigned to this task
}

impl WorkBindrError {
    // Convert error to HTTP status code
    pub fn status(&self) -> Status {
        match self {
            WorkBindrError::EmployeeNotFound(_)  => Status::NotFound,
            WorkBindrError::InvalidPassword      => Status::Unauthorized,
            WorkBindrError::InvalidToken         => Status::Unauthorized,
            WorkBindrError::AccessDenied(_)      => Status::Forbidden,
            WorkBindrError::EmptyField(_)        => Status::BadRequest,
            WorkBindrError::InvalidFormat(_)     => Status::BadRequest,
            WorkBindrError::InvalidDepartment(_) => Status::BadRequest,
            WorkBindrError::InvalidPriority(_)   => Status::BadRequest,
            WorkBindrError::InvalidStatus(_)     => Status::BadRequest,
            WorkBindrError::DuplicateEmployee(_) => Status::Conflict,
            WorkBindrError::SelfDeactivation     => Status::BadRequest,
            WorkBindrError::CrossDepartmentMessage => Status::Forbidden,
            WorkBindrError::TaskNotFound(_)      => Status::NotFound,
            WorkBindrError::NotTaskAssignee      => Status::Forbidden,
            _ => Status::InternalServerError,
        }
    }

    // Convert error to machine-readable code
    pub fn code(&self) -> &str {
        match self {
            WorkBindrError::EmployeeNotFound(_)    => "EMPLOYEE_NOT_FOUND",
            WorkBindrError::InvalidPassword        => "INVALID_PASSWORD",
            WorkBindrError::InvalidToken           => "INVALID_TOKEN",
            WorkBindrError::AccessDenied(_)        => "ACCESS_DENIED",
            WorkBindrError::MorkWriteFailed(_)     => "STORAGE_WRITE_FAILED",
            WorkBindrError::MorkReadFailed(_)      => "STORAGE_READ_FAILED",
            WorkBindrError::DocumentSaveFailed(_)  => "DOCUMENT_SAVE_FAILED",
            WorkBindrError::TaskSaveFailed(_)      => "TASK_SAVE_FAILED",
            WorkBindrError::EmptyField(_)          => "EMPTY_FIELD",
            WorkBindrError::InvalidFormat(_)       => "INVALID_FORMAT",
            WorkBindrError::InvalidDepartment(_)   => "INVALID_DEPARTMENT",
            WorkBindrError::InvalidPriority(_)     => "INVALID_PRIORITY",
            WorkBindrError::InvalidStatus(_)       => "INVALID_STATUS",
            WorkBindrError::AIServiceFailed(_)     => "AI_SERVICE_FAILED",
            WorkBindrError::EmbeddingFailed(_)     => "EMBEDDING_FAILED",
            WorkBindrError::DuplicateEmployee(_)   => "DUPLICATE_EMPLOYEE",
            WorkBindrError::SelfDeactivation       => "SELF_DEACTIVATION",
            WorkBindrError::CrossDepartmentMessage => "CROSS_DEPT_MESSAGE",
            WorkBindrError::TaskNotFound(_)        => "TASK_NOT_FOUND",
            WorkBindrError::NotTaskAssignee        => "NOT_TASK_ASSIGNEE",
        }
    }

    // Convert error to human-readable message
    pub fn message(&self) -> String {
        match self {
            WorkBindrError::EmployeeNotFound(id) =>
                format!("Employee '{}' not found. Please check your ID.", id),
            WorkBindrError::InvalidPassword =>
                "Incorrect password. Please try again.".to_string(),
            WorkBindrError::InvalidToken =>
                "Your session has expired. Please login again.".to_string(),
            WorkBindrError::AccessDenied(reason) =>
                format!("Access denied: {}", reason),
            WorkBindrError::MorkWriteFailed(e) =>
                format!("Failed to record event: {}", e),
            WorkBindrError::MorkReadFailed(e) =>
                format!("Failed to read history: {}", e),
            WorkBindrError::DocumentSaveFailed(e) =>
                format!("Failed to save document: {}", e),
            WorkBindrError::TaskSaveFailed(e) =>
                format!("Failed to save task: {}", e),
            WorkBindrError::EmptyField(field) =>
                format!("'{}' cannot be empty.", field),
            WorkBindrError::InvalidFormat(msg) =>
                format!("Invalid format: {}", msg),
            WorkBindrError::InvalidDepartment(dept) =>
                format!("'{}' is not a valid department. Use: HR, Finance, Legal, Engineering, CEO", dept),
            WorkBindrError::InvalidPriority(p) =>
                format!("'{}' is not a valid priority. Use: Low, Medium, High, Urgent", p),
            WorkBindrError::InvalidStatus(s) =>
                format!("'{}' is not a valid status. Use: Todo, InProgress, Done", s),
            WorkBindrError::AIServiceFailed(e) =>
                format!("AI service temporarily unavailable: {}", e),
            WorkBindrError::EmbeddingFailed(e) =>
                format!("Embedding service temporarily unavailable: {}", e),
            WorkBindrError::DuplicateEmployee(id) =>
                format!("Employee ID '{}' already exists.", id),
            WorkBindrError::SelfDeactivation =>
                "You cannot deactivate your own account.".to_string(),
            WorkBindrError::CrossDepartmentMessage =>
                "You can only message employees in your own department.".to_string(),
            WorkBindrError::TaskNotFound(id) =>
                format!("Task '{}' not found.", id),
            WorkBindrError::NotTaskAssignee =>
                "Only the assigned employee can update this task.".to_string(),
        }
    }
}

// ─────────────────────────────────────────────
// ApiResult — Our Standard Return Type
// Every endpoint returns this instead of
// raw Json<SomeStruct>
// ─────────────────────────────────────────────

// "type" creates an alias — ApiResult<T> is shorthand
// for Result<T, WorkBindrError>
// T = the success data type (different for each endpoint)
pub type ApiResult<T> = Result<T, WorkBindrError>;

// ─────────────────────────────────────────────
// Convert WorkBindrError into a Rocket Response
// This is what Rocket calls automatically when
// an endpoint returns Err(WorkBindrError)
// ─────────────────────────────────────────────

// "impl" here tells Rocket how to turn our error
// into an HTTP response automatically
impl<'r> rocket::response::Responder<'r, 'static> for WorkBindrError {
    fn respond_to(
        self,
        req: &'r rocket::Request<'_>
    ) -> rocket::response::Result<'static> {

        let status = self.status();
        let error_response = ErrorResponse::new(self.code(), &self.message());

        // Build the JSON response with the correct HTTP status code
        status::Custom(
            status,
            Json(error_response)
        ).respond_to(req)
    }
}

// ─────────────────────────────────────────────
// Validation Helpers
// Reusable functions for checking input
// ─────────────────────────────────────────────

// Check a string field is not empty
// Returns Err if empty, Ok if has content
pub fn require_field(value: &str, field_name: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        Err(WorkBindrError::EmptyField(field_name.to_string()))
    } else {
        Ok(())
    }
}

// Validate employee ID format (must be 4 digits)
pub fn validate_emp_id(emp_id: &str) -> ApiResult<()> {
    if emp_id.len() != 4 || !emp_id.chars().all(|c| c.is_ascii_digit()) {
        return Err(WorkBindrError::InvalidFormat(
            format!("Employee ID '{}' must be exactly 4 digits e.g. 0001", emp_id)
        ));
    }
    Ok(())
}

// Validate password strength
pub fn validate_password(password: &str) -> ApiResult<()> {
    if password.len() < 8 {
        return Err(WorkBindrError::InvalidFormat(
            "Password must be at least 8 characters long".to_string()
        ));
    }
    Ok(())
}

// Validate content is not too long (prevent abuse)
pub fn validate_content_length(content: &str, max_chars: usize, field: &str) -> ApiResult<()> {
    if content.len() > max_chars {
        return Err(WorkBindrError::InvalidFormat(
            format!("{} cannot exceed {} characters", field, max_chars)
        ));
    }
    Ok(())
}