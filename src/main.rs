// main.rs
// WorkBindr Enterprise — with Task Management

#[macro_use] extern crate rocket;

mod events;
mod mork;
mod storage;
mod model;
mod embeddings;
mod employees;
mod tasks;  
mod notifications;    // ← NEW

use events::Event;
use storage::{StorageLayer, StoredDocument};
use employees::EmployeeRegistry;
use tasks::{TaskStore, Task, Priority, TaskStatus};
use notifications::{NotificationStore, NotificationType};

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;

use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────
// Shared Application State
// ─────────────────────────────────────────────

struct AppState {
    storage: StorageLayer,
    registry: EmployeeRegistry,
    task_store: TaskStore,  
    notification_store: NotificationStore,   // ← NEW
}

// ─────────────────────────────────────────────
// ID Generator
// ─────────────────────────────────────────────

fn generate_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();
    format!("id_{}", timestamp)
}

fn generate_task_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();
    format!("task_{}", timestamp)
}

fn get_timestamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis()
}

// ─────────────────────────────────────────────
// Request / Response Shapes
// ─────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct QueryRequest {
    emp_id: String,
    query_text: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct QueryResponseBody {
    query_id: String,
    emp_id: String,
    department: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentRequest {
    emp_id: String,
    title: String,
    content: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentResponse {
    doc_id: String,
    department: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct DeleteDocumentRequest {
    emp_id: String,
    doc_id: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct DeleteDocumentResponse {
    doc_id: String,
    message: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct HistoryResponse {
    total_events: usize,
    events: Vec<String>,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct EmployeeInfoResponse {
    emp_id: String,
    name: String,
    department: String,
    role: String,
}

// ── Notification Shapes ───────────────────────

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct NotificationResponse {
    notification_id:   String,
    emp_id:            String,
    notification_type: String,
    emoji:             String,
    title:             String,
    message:           String,
    is_read:           bool,
    created_at:        u128,
    related_id:        String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct NotificationListResponse {
    total:  usize,
    unread: usize,
    notifications: Vec<NotificationResponse>,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct MarkReadRequest {
    notification_id: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct UnreadCountResponse {
    emp_id: String,
    unread: usize,
}

// Task request shapes
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct CreateTaskRequest {
    emp_id: String,        // who is creating
    assigned_to: String,   // who it's assigned to
    title: String,
    description: String,
    priority: String,      // "Low", "Medium", "High", "Urgent"
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct TaskResponse {
    task_id: String,
    title: String,
    description: String,
    priority: String,
    priority_emoji: String,
    status: String,
    status_emoji: String,
    created_by: String,
    assigned_to: String,
    department: String,
    created_at: u128,
    updated_at: u128,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct UpdateTaskRequest {
    emp_id: String,    // who is updating
    task_id: String,
    new_status: String, // "Todo", "InProgress", "Done"
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct UpdateTaskResponse {
    success: bool,
    message: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct TaskListResponse {
    total: usize,
    tasks: Vec<TaskResponse>,
}

// Helper to convert Task to TaskResponse
fn task_to_response(task: &Task) -> TaskResponse {
    TaskResponse {
        task_id: task.task_id.clone(),
        title: task.title.clone(),
        description: task.description.clone(),
        priority: task.priority.to_str().to_string(),
        priority_emoji: task.priority.emoji().to_string(),
        status: task.status.to_str().to_string(),
        status_emoji: task.status.emoji().to_string(),
        created_by: task.created_by.clone(),
        assigned_to: task.assigned_to.clone(),
        department: task.department.clone(),
        created_at: task.created_at,
        updated_at: task.updated_at,
    }
}
fn notif_to_response(
    n: &notifications::Notification
) -> NotificationResponse {
    NotificationResponse {
        notification_id:   n.notification_id.clone(),
        emp_id:            n.emp_id.clone(),
        notification_type: n.notification_type.to_str().to_string(),
        emoji:             n.notification_type.emoji().to_string(),
        title:             n.title.clone(),
        message:           n.message.clone(),
        is_read:           n.is_read,
        created_at:        n.created_at,
        related_id:        n.related_id.clone(),
    }
}

// ─────────────────────────────────────────────
// Endpoint 1: Homepage
// ─────────────────────────────────────────────

#[get("/")]
fn index() -> &'static str {
    "WorkBindr Enterprise API 🚀

Endpoints:
    GET  /                          - This page
    GET  /employee/<emp_id>         - Get employee info
    POST /query                     - Ask AI (dept filtered)
    POST /add_document              - Upload document
    POST /delete_document           - Delete document
    GET  /history                   - Full MORK log
    POST /tasks/create              - Create a task
    POST /tasks/update              - Update task status
    GET  /tasks/mine/<emp_id>       - My assigned tasks
    GET  /tasks/created/<emp_id>    - Tasks I created
    GET  /tasks/department/<dept>   - All dept tasks
    GET  /tasks/all                 - All tasks (CEO only)"
}

// ─────────────────────────────────────────────
// Endpoint 2: Get Employee
// ─────────────────────────────────────────────

#[get("/employee/<emp_id>")]
fn get_employee(
    emp_id: String,
    state: &State<AppState>,
) -> Json<EmployeeInfoResponse> {
    match state.registry.get_employee(&emp_id) {
        Some(emp) => Json(EmployeeInfoResponse {
            emp_id: emp.emp_id.clone(),
            name: emp.name.clone(),
            department: emp.department.to_str().to_string(),
            role: emp.role.clone(),
        }),
        None => Json(EmployeeInfoResponse {
            emp_id: emp_id,
            name: "Unknown".to_string(),
            department: "None".to_string(),
            role: "Employee not found".to_string(),
        }),
    }
}

// ─────────────────────────────────────────────
// Endpoint 3: /query — AI with permissions
// ─────────────────────────────────────────────

#[post("/query", format = "json", data = "<request>")]
async fn query(
    request: Json<QueryRequest>,
    state: &State<AppState>,
) -> Json<QueryResponseBody> {

    let query_id = generate_id();
    println!("\n📨 Query from emp: {}", request.emp_id);

    // Verify employee
    let employee = match state.registry.get_employee(&request.emp_id) {
        Some(emp) => emp.clone(),
        None => {
            return Json(QueryResponseBody {
                query_id,
                emp_id: request.emp_id.clone(),
                department: "Unknown".to_string(),
                message: format!(
                    "❌ Employee ID '{}' not found.",
                    request.emp_id
                ),
            });
        }
    };

    // Record in MORK
    state.storage.record_event(Event::UserInput {
        query_id: query_id.clone(),
        query_text: format!(
            "[EMP:{}|DEPT:{}] {}",
            employee.emp_id,
            employee.department.to_str(),
            request.query_text
        ),
    }).expect("Failed to record UserInput");

    // Get embedding
    let query_embedding = match embeddings::get_embedding(
        &request.query_text, "search_query"
    ).await {
        Ok(emb) => emb,
        Err(_) => vec![],
    };

    // Search with permission filter
    let best_match = if !query_embedding.is_empty() {
        let docs = state.storage.doc_store.get_all();
        docs.iter()
            .filter(|doc| {
                match employees::Department::from_str(&doc.department) {
                    Some(doc_dept) => state.registry.can_access(
                        &employee.emp_id, &doc_dept
                    ),
                    None => false,
                }
            })
            .filter(|doc| !doc.embedding.is_empty())
            .map(|doc| {
                let sim = embeddings::cosine_similarity(
                    &query_embedding, &doc.embedding
                );
                (doc.title.clone(), doc.content.clone(), doc.department.clone(), sim)
            })
            .max_by(|a, b| a.3.partial_cmp(&b.3).unwrap())
    } else {
        None
    };

    // Build prompt
    let final_prompt = match &best_match {
        Some((title, content, dept, sim)) if *sim > 0.3 => {
            println!("  📄 Using doc: '{}' [{}] ({:.2})", title, dept, sim);
            format!(
                "You are WorkBindr AI assistant.\n\
                Employee: {} ({})\n\
                Document: {}\n\
                Content: {}\n\
                Question: {}\n\
                Answer based on the document.",
                employee.name, employee.department.to_str(),
                title, content, request.query_text
            )
        }
        _ => {
            println!("  ℹ️  No matching doc found");
            format!(
                "You are WorkBindr AI. Answer this from {} in {} dept: {}",
                employee.name, employee.department.to_str(), request.query_text
            )
        }
    };

    // Ask AI
    let ai_answer = match model::ask_ai(&final_prompt).await {
        Ok(a) => a,
        Err(e) => format!("Error: {}", e),
    };

    // Record response
    state.storage.record_event(Event::QueryResponse {
        query_id: query_id.clone(),
        response_text: ai_answer.clone(),
    }).expect("Failed to record QueryResponse");

    Json(QueryResponseBody {
        query_id,
        emp_id: employee.emp_id,
        department: employee.department.to_str().to_string(),
        message: ai_answer,
    })
}

// ─────────────────────────────────────────────
// Endpoint 4: /add_document
// ─────────────────────────────────────────────

#[post("/add_document", format = "json", data = "<request>")]
async fn add_document(
    request: Json<AddDocumentRequest>,
    state: &State<AppState>,
) -> Json<AddDocumentResponse> {

    let doc_id = generate_id();
    println!("\n📄 Add document from emp: {}", request.emp_id);

    let employee = match state.registry.get_employee(&request.emp_id) {
        Some(emp) => emp.clone(),
        None => {
            return Json(AddDocumentResponse {
                doc_id: "none".to_string(),
                department: "none".to_string(),
                message: format!("❌ Employee '{}' not found.", request.emp_id),
            });
        }
    };

    let department = employee.department.to_str().to_string();

    state.storage.record_event(Event::DocumentAdded {
        doc_id: doc_id.clone(),
        content: format!(
            "TITLE: {} | DEPT: {} | BY: {} | CONTENT: {}",
            request.title, department, employee.name, request.content
        ),
    }).expect("Failed to record DocumentAdded");

    let embedding = match embeddings::get_embedding(
        &request.content, "search_document"
    ).await {
        Ok(emb) => emb,
        Err(e) => { println!("  ⚠️ Embedding failed: {}", e); vec![] }
    };

    state.storage.doc_store.add_document(StoredDocument {
        doc_id: doc_id.clone(),
        title: request.title.clone(),
        content: request.content.clone(),
        embedding,
        department: department.clone(),
        uploaded_by: employee.emp_id.clone(),
    }).expect("Failed to save document");

    // Notify all employees in the same department
    let dept_employees = state.registry.get_by_department(&department);
    for dept_emp in dept_employees {
        // Don't notify the uploader themselves
        if dept_emp.emp_id != employee.emp_id {
            state.notification_store.create(
                dept_emp.emp_id.clone(),
                NotificationType::DocumentAdded,
                format!("New document in {}", department),
                format!(
                    "{} added a new document: '{}'",
                    employee.name,
                    request.title
                ),
                doc_id.clone(),
            ).ok();
        }
    }
    println!("  🔔 Department notified about new document");

    Json(AddDocumentResponse {
        doc_id: doc_id.clone(),
        department: department.clone(),
        message: format!(
            "✅ '{}' saved to {} department! doc_id: {}",
            request.title, department, doc_id
        ),

        
    })

    
}

// ─────────────────────────────────────────────
// Endpoint 5: /delete_document
// ─────────────────────────────────────────────

#[post("/delete_document", format = "json", data = "<request>")]
fn delete_document(
    request: Json<DeleteDocumentRequest>,
    state: &State<AppState>,
) -> Json<DeleteDocumentResponse> {

    match state.registry.get_employee(&request.emp_id) {
        None => Json(DeleteDocumentResponse {
            doc_id: request.doc_id.clone(),
            message: format!("❌ Employee '{}' not found.", request.emp_id),
        }),
        Some(_) => {
            state.storage.record_event(Event::Tombstone {
                doc_id: request.doc_id.clone(),
            }).expect("Failed to record Tombstone");

            Json(DeleteDocumentResponse {
                doc_id: request.doc_id.clone(),
                message: format!(
                    "✅ Document {} deleted. History in MORK forever.",
                    request.doc_id
                ),
            })
        }
    }
}

// ─────────────────────────────────────────────
// Endpoint 6: /history
// ─────────────────────────────────────────────

#[get("/history")]
fn history(state: &State<AppState>) -> Json<HistoryResponse> {
    let all_events = state.storage.get_history();
    Json(HistoryResponse {
        total_events: all_events.len(),
        events: all_events,
    })
}

// ─────────────────────────────────────────────
// TASK ENDPOINTS
// ─────────────────────────────────────────────

// ── Create Task ──────────────────────────────

#[post("/tasks/create", format = "json", data = "<request>")]
fn create_task(
    request: Json<CreateTaskRequest>,
    state: &State<AppState>,
) -> Json<UpdateTaskResponse> {

    println!("\n📋 Create task from emp: {}", request.emp_id);

    

    // Verify creator exists
    let creator = match state.registry.get_employee(&request.emp_id) {
        Some(emp) => emp.clone(),
        None => {
            return Json(UpdateTaskResponse {
                success: false,
                message: format!("❌ Employee '{}' not found.", request.emp_id),
            });
        }
    };

    // Verify assignee exists
    let assignee = match state.registry.get_employee(&request.assigned_to) {
        Some(emp) => emp.clone(),
        None => {
            return Json(UpdateTaskResponse {
                success: false,
                message: format!(
                    "❌ Assignee '{}' not found.",
                    request.assigned_to
                ),
            });
        }
    };

    // Parse priority
    let priority = match Priority::from_str(&request.priority) {
        Some(p) => p,
        None => {
            return Json(UpdateTaskResponse {
                success: false,
                message: "❌ Invalid priority. Use: Low, Medium, High, Urgent".to_string(),
            });
        }
    };

    let task_id = generate_task_id();
    let now = get_timestamp();

    // Build the task
    let task = Task {
        task_id: task_id.clone(),
        title: request.title.clone(),
        description: request.description.clone(),
        priority: priority.clone(),
        status: TaskStatus::Todo,  // always starts as Todo
        created_by: creator.emp_id.clone(),
        assigned_to: assignee.emp_id.clone(),
        department: creator.department.to_str().to_string(),
        created_at: now,
        updated_at: now,
    };

    // Save to TaskStore
    state.task_store.add_task(task)
        .expect("Failed to save task");

    // Record in MORK permanently
    state.storage.record_event(Event::TaskCreated {
        task_id: task_id.clone(),
        title: request.title.clone(),
        assigned_to: assignee.name.clone(),
        priority: priority.to_str().to_string(),
        department: creator.department.to_str().to_string(),
    }).expect("Failed to record TaskCreated");

    println!(
        "  ✅ Task created: {} → assigned to {}",
        request.title, assignee.name
    );

    // Send notification to the assignee
    state.notification_store.create(
        assignee.emp_id.clone(),
        NotificationType::TaskAssigned,
        format!("New task assigned to you"),
        format!(
            "{} assigned you a task: '{}' — Priority: {}",
            creator.name,
            request.title,
            priority.to_str()
        ),
        task_id.clone(),
    ).ok(); // .ok() means ignore error if notification fails

    println!("  🔔 Notification sent to {}", assignee.name);

    Json(UpdateTaskResponse {
        success: true,
        message: format!(
            "✅ Task '{}' created! {} priority. \
            Assigned to {} ({}). task_id: {}",
            request.title,
            priority.to_str(),
            assignee.name,
            assignee.role,
            task_id
        ),
    })
}

// ── Update Task Status ───────────────────────

#[post("/tasks/update", format = "json", data = "<request>")]
fn update_task(
    request: Json<UpdateTaskRequest>,
    state: &State<AppState>,
) -> Json<UpdateTaskResponse> {

    println!("\n🔄 Update task: {} by emp: {}", request.task_id, request.emp_id);

    // Verify employee
    match state.registry.get_employee(&request.emp_id) {
        None => {
            return Json(UpdateTaskResponse {
                success: false,
                message: format!("❌ Employee '{}' not found.", request.emp_id),
            });
        }
        Some(emp) => println!("  Employee: {}", emp.name),
    }

    // Get old status before updating
    let old_status = match state.task_store.get_task(&request.task_id) {
        Some(task) => task.status.to_str().to_string(),
        None => {
            return Json(UpdateTaskResponse {
                success: false,
                message: format!("❌ Task '{}' not found.", request.task_id),
            });
        }
    };

    // Parse new status
    let new_status = match TaskStatus::from_str(&request.new_status) {
        Some(s) => s,
        None => {
            return Json(UpdateTaskResponse {
                success: false,
                message: "❌ Invalid status. Use: Todo, InProgress, Done".to_string(),
            });
        }
    };

    let new_status_str = new_status.to_str().to_string();
    let now = get_timestamp();

    // Update the task
    let updated = state.task_store.update_status(
        &request.task_id,
        new_status,
        &request.emp_id,
        now,
    );

    if !updated {
        return Json(UpdateTaskResponse {
            success: false,
            message: "❌ Access denied. Only the assigned employee can update this task.".to_string(),
        });
    }

    // Record in MORK
    state.storage.record_event(Event::TaskUpdated {
        task_id: request.task_id.clone(),
        old_status: old_status.clone(),
        new_status: new_status_str.clone(),
        updated_by: request.emp_id.clone(),
    }).expect("Failed to record TaskUpdated");

    println!("  ✅ Task updated: {} → {}", old_status, new_status_str);

    // If task is marked Done, notify the creator
    if new_status_str == "Done" {
        if let Some(task) = state.task_store.get_task(&request.task_id) {
            if let Some(creator) = state.registry.get_employee(&task.created_by) {
                if let Some(updater) = state.registry.get_employee(&request.emp_id) {
                    state.notification_store.create(
                        creator.emp_id.clone(),
                        NotificationType::TaskCompleted,
                        format!("Task completed!"),
                        format!(
                            "{} completed the task: '{}'",
                            updater.name,
                            task.title
                        ),
                        request.task_id.clone(),
                    ).ok();
                    println!("  🔔 Completion notification sent to {}", creator.name);
                }
            }
        }
    }

    Json(UpdateTaskResponse {
        success: true,
        message: format!(
            "✅ Task updated! {} → {}",
            old_status,
            new_status_str
        ),
    })
}

// ── Admin Shapes ─────────────────────────────

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct AddEmployeeRequest {
    admin_emp_id: String,   // must be CEO (0000)
    emp_id: String,         // new employee's ID
    name: String,
    department: String,
    role: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct AddEmployeeResponse {
    success: bool,
    message: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct EmployeeListResponse {
    total: usize,
    employees: Vec<EmployeeInfoResponse>,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct PlatformStatsResponse {
    total_employees: usize,
    total_events: usize,
    total_tasks: usize,
    total_tasks_done: usize,
    departments: Vec<DeptStat>,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct DeptStat {
    name: String,
    employee_count: usize,
    task_count: usize,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct DeactivateRequest {
    admin_emp_id: String,
    emp_id: String,
}

// ── Get My Tasks (assigned to me) ────────────

#[get("/tasks/mine/<emp_id>")]
fn get_my_tasks(
    emp_id: String,
    state: &State<AppState>,
) -> Json<TaskListResponse> {

    println!("\n📋 Get tasks for emp: {}", emp_id);

    match state.registry.get_employee(&emp_id) {
        None => Json(TaskListResponse { total: 0, tasks: vec![] }),
        Some(_) => {
            let tasks = state.task_store.get_tasks_for_employee(&emp_id);
            let total = tasks.len();
            println!("  Found {} tasks assigned to {}", total, emp_id);
            Json(TaskListResponse {
                total,
                tasks: tasks.iter().map(task_to_response).collect(),
            })
        }
    }
}

// ── Get Tasks I Created ──────────────────────

#[get("/tasks/created/<emp_id>")]
fn get_created_tasks(
    emp_id: String,
    state: &State<AppState>,
) -> Json<TaskListResponse> {

    match state.registry.get_employee(&emp_id) {
        None => Json(TaskListResponse { total: 0, tasks: vec![] }),
        Some(_) => {
            let tasks = state.task_store.get_tasks_created_by(&emp_id);
            let total = tasks.len();
            Json(TaskListResponse {
                total,
                tasks: tasks.iter().map(task_to_response).collect(),
            })
        }
    }
}

// ── Get Department Tasks ─────────────────────

#[get("/tasks/department/<dept>")]
fn get_department_tasks(
    dept: String,
    state: &State<AppState>,
) -> Json<TaskListResponse> {

    let tasks = state.task_store.get_tasks_by_department(&dept);
    let total = tasks.len();
    Json(TaskListResponse {
        total,
        tasks: tasks.iter().map(task_to_response).collect(),
    })
}

// ── Get All Tasks (CEO only) ─────────────────

#[get("/tasks/all")]
fn get_all_tasks(state: &State<AppState>) -> Json<TaskListResponse> {
    let tasks = state.task_store.get_all_tasks();
    let total = tasks.len();
    Json(TaskListResponse {
        total,
        tasks: tasks.iter().map(task_to_response).collect(),
    })
}
// ─────────────────────────────────────────────
// ADMIN ENDPOINTS (CEO only)
// ─────────────────────────────────────────────

// ── Add New Employee ─────────────────────────

#[post("/admin/add_employee", format = "json", data = "<request>")]
fn add_employee(
    request: Json<AddEmployeeRequest>,
    state: &State<AppState>,
) -> Json<AddEmployeeResponse> {

    println!("\n👤 Add employee request from: {}", request.admin_emp_id);

    // Only CEO can add employees
    match state.registry.get_employee(&request.admin_emp_id) {
        None => {
            return Json(AddEmployeeResponse {
                success: false,
                message: "❌ Admin not found.".to_string(),
            });
        }
        Some(admin) => {
            if admin.department.to_str() != "CEO" {
                return Json(AddEmployeeResponse {
                    success: false,
                    message: "❌ Access Denied. Only CEO can add employees.".to_string(),
                });
            }
        }
    }

    // Parse department
    let department = match employees::Department::from_str(&request.department) {
        Some(d) => d,
        None => {
            return Json(AddEmployeeResponse {
                success: false,
                message: format!(
                    "❌ Invalid department '{}'. Use: HR, Finance, Legal, Engineering, CEO",
                    request.department
                ),
            });
        }
    };

    let now = get_timestamp();

    // Add the employee
    match state.registry.add_employee(
        request.emp_id.clone(),
        request.name.clone(),
        department.clone(),
        request.role.clone(),
        now,
    ) {
        Ok(_) => {
            println!(
                "  ✅ New employee added: {} ({}) - {}",
                request.name,
                request.emp_id,
                department.to_str()
            );

            // Record in MORK
            state.storage.record_event(Event::UserInput {
                query_id: generate_id(),
                query_text: format!(
                    "[ADMIN] New employee added: {} ({}) dept: {}",
                    request.name,
                    request.emp_id,
                    department.to_str()
                ),
            }).ok();
            // Notify CEO about new employee
            state.notification_store.create(
                request.admin_emp_id.clone(),
                NotificationType::NewEmployee,
                format!("New employee added"),
                format!(
                    "Successfully added {} ({}) to {} department",
                    request.name,
                    request.emp_id,
                    request.department
                ),
                request.emp_id.clone(),
            ).ok();
            Json(AddEmployeeResponse {
                success: true,
                message: format!(
                    "✅ Employee '{}' added successfully! \
                    ID: {} | Department: {} | Role: {}",
                    request.name,
                    request.emp_id,
                    department.to_str(),
                    request.role
                ),
            })
        }
        Err(e) => Json(AddEmployeeResponse {
            success: false,
            message: format!("❌ Failed to add employee: {}", e),
        }),
    }
}

// ── Get All Employees ────────────────────────

#[get("/admin/employees")]
fn get_all_employees(state: &State<AppState>) -> Json<EmployeeListResponse> {

    let employees = state.registry.get_all_employees();
    let total = employees.len();

    let list = employees.iter().map(|emp| EmployeeInfoResponse {
        emp_id:     emp.emp_id.clone(),
        name:       emp.name.clone(),
        department: emp.department.to_str().to_string(),
        role:       emp.role.clone(),
    }).collect();

    Json(EmployeeListResponse { total, employees: list })
}

// ── Platform Statistics ──────────────────────

#[get("/admin/stats")]
fn get_stats(state: &State<AppState>) -> Json<PlatformStatsResponse> {

    println!("\n📊 Stats requested");

    let all_employees = state.registry.get_all_employees();
    let all_events    = state.storage.get_history();
    let all_tasks     = state.task_store.get_all_tasks();

    let total_tasks_done = all_tasks.iter()
        .filter(|t| t.status.to_str() == "Done")
        .count();

    // Build department stats
    let dept_names = ["HR", "Finance", "Legal", "Engineering", "CEO"];
    let departments = dept_names.iter().map(|dept| {
        let emp_count = all_employees.iter()
            .filter(|e| e.department.to_str() == *dept)
            .count();
        let task_count = all_tasks.iter()
            .filter(|t| t.department == *dept)
            .count();
        DeptStat {
            name:           dept.to_string(),
            employee_count: emp_count,
            task_count,
        }
    }).collect();

    Json(PlatformStatsResponse {
        total_employees: all_employees.len(),
        total_events:    all_events.len(),
        total_tasks:     all_tasks.len(),
        total_tasks_done,
        departments,
    })
}

// ── Deactivate Employee ──────────────────────

#[post("/admin/deactivate", format = "json", data = "<request>")]
fn deactivate_employee(
    request: Json<DeactivateRequest>,
    state: &State<AppState>,
) -> Json<AddEmployeeResponse> {

    // Only CEO can deactivate
    match state.registry.get_employee(&request.admin_emp_id) {
        None => {
            return Json(AddEmployeeResponse {
                success: false,
                message: "❌ Admin not found.".to_string(),
            });
        }
        Some(admin) => {
            if admin.department.to_str() != "CEO" {
                return Json(AddEmployeeResponse {
                    success: false,
                    message: "❌ Only CEO can deactivate employees.".to_string(),
                });
            }
        }
    }

    // Can't deactivate yourself
    if request.emp_id == request.admin_emp_id {
        return Json(AddEmployeeResponse {
            success: false,
            message: "❌ Cannot deactivate yourself.".to_string(),
        });
    }

    match state.registry.deactivate_employee(&request.emp_id) {
        Ok(_) => Json(AddEmployeeResponse {
            success: true,
            message: format!(
                "✅ Employee {} deactivated. They can no longer access the platform.",
                request.emp_id
            ),
        }),
        Err(e) => Json(AddEmployeeResponse {
            success: false,
            message: format!("❌ {}", e),
        }),
    }
}
// ─────────────────────────────────────────────
// NOTIFICATION ENDPOINTS
// ─────────────────────────────────────────────

// ── Get My Notifications ─────────────────────

#[get("/notifications/<emp_id>")]
fn get_notifications(
    emp_id: String,
    state: &State<AppState>,
) -> Json<NotificationListResponse> {

    // Verify employee exists
    match state.registry.get_employee(&emp_id) {
        None => Json(NotificationListResponse {
            total: 0,
            unread: 0,
            notifications: vec![],
        }),
        Some(_) => {
            let notifications = state.notification_store
                .get_for_employee(&emp_id);

            let unread = state.notification_store
                .get_unread_count(&emp_id);

            let total = notifications.len();

            Json(NotificationListResponse {
                total,
                unread,
                notifications: notifications
                    .iter()
                    .map(notif_to_response)
                    .collect(),
            })
        }
    }
}

// ── Get Unread Count ─────────────────────────
// This is polled every 10 seconds by the frontend
// Lightweight — just returns a number

#[get("/notifications/count/<emp_id>")]
fn get_unread_count(
    emp_id: String,
    state: &State<AppState>,
) -> Json<UnreadCountResponse> {
    let unread = state.notification_store.get_unread_count(&emp_id);
    Json(UnreadCountResponse { emp_id, unread })
}

// ── Mark One as Read ─────────────────────────

#[post("/notifications/read", format = "json", data = "<request>")]
fn mark_notification_read(
    request: Json<MarkReadRequest>,
    state: &State<AppState>,
) -> Json<UpdateTaskResponse> {
    match state.notification_store
        .mark_as_read(&request.notification_id) {
        Ok(_) => Json(UpdateTaskResponse {
            success: true,
            message: "✅ Notification marked as read".to_string(),
        }),
        Err(e) => Json(UpdateTaskResponse {
            success: false,
            message: format!("❌ {}", e),
        }),
    }
}

// ── Mark All as Read ─────────────────────────

#[get("/notifications/read_all/<emp_id>")]
fn mark_all_read(
    emp_id: String,
    state: &State<AppState>,
) -> Json<UpdateTaskResponse> {
    match state.notification_store.mark_all_read(&emp_id) {
        Ok(_) => Json(UpdateTaskResponse {
            success: true,
            message: "✅ All notifications marked as read".to_string(),
        }),
        Err(e) => Json(UpdateTaskResponse {
            success: false,
            message: format!("❌ {}", e),
        }),
    }
}
// ─────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────

#[launch]
fn rocket() -> _ {
    println!("=================================");
    println!("  WorkBindr Enterprise 🚀");
    println!("=================================\n");

    dotenvy::dotenv().ok();

    let state = AppState {
        storage: StorageLayer::new("workbinder_events.log"),
        registry: EmployeeRegistry::new("workbinder_employees.json"),
        task_store: TaskStore::new("workbinder_tasks.json"),
        notification_store: NotificationStore::new("workbinder_notifications.json"),
    };

    let cors = rocket_cors::CorsOptions {
        allowed_origins: rocket_cors::AllowedOrigins::all(),
        allowed_methods: vec![
            rocket::http::Method::Get,
            rocket::http::Method::Post,
        ]
        .into_iter()
        .map(From::from)
        .collect(),
        allowed_headers: rocket_cors::AllowedHeaders::all(),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .expect("CORS configuration failed");

    rocket::build()
        .manage(state)
        .attach(cors)
        .mount("/", routes![
            index,
            get_employee,
            query,
            add_document,
            delete_document,
            history,
            create_task,
            update_task,
            get_my_tasks,
            get_created_tasks,
            get_department_tasks,
            get_all_tasks,
            add_employee,
            get_all_employees,
            get_stats,
            deactivate_employee,
             get_notifications,        // ← NEW
            get_unread_count,         // ← NEW
            mark_notification_read,   // ← NEW
            mark_all_read, 
        ])
}