// main.rs
// WorkBindr with Employee ID based Department Permissions

#[macro_use] extern crate rocket;

mod events;
mod mork;
mod storage;
mod model;
mod embeddings;
mod employees;  // ← NEW

use events::Event;
use storage::{StorageLayer, StoredDocument};
use employees::EmployeeRegistry;

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;

use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────
// Shared Application State
// Both StorageLayer and EmployeeRegistry need
// to be shared across all requests
// ─────────────────────────────────────────────

struct AppState {
    storage: StorageLayer,
    registry: EmployeeRegistry,
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

// ─────────────────────────────────────────────
// Request and Response Shapes
// ─────────────────────────────────────────────

// Query request now includes emp_id
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct QueryRequest {
    emp_id: String,       // who is asking e.g. "0001"
    query_text: String,   // what they're asking
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct QueryResponseBody {
    query_id: String,
    emp_id: String,
    department: String,
    message: String,
}

// Add document request now includes emp_id
// Department is automatically determined from emp_id
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentRequest {
    emp_id: String,    // who is uploading
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
    emp_id: String,   // who is deleting
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

// Employee info response
#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct EmployeeInfoResponse {
    emp_id: String,
    name: String,
    department: String,
    role: String,
}

// ─────────────────────────────────────────────
// Endpoint 1: Homepage
// ─────────────────────────────────────────────

#[get("/")]
fn index() -> &'static str {
    "WorkBindr API 🚀 — Enterprise Edition

Available endpoints:
    GET  /                          - This page
    GET  /employee/<emp_id>         - Get employee info
    POST /query                     - Ask AI (department filtered)
    POST /add_document              - Upload document (auto-tagged)
    POST /delete_document           - Delete document
    GET  /history                   - Full MORK event log"
}

// ─────────────────────────────────────────────
// Endpoint 2: Get Employee Info
// ─────────────────────────────────────────────

#[get("/employee/<emp_id>")]
fn get_employee(
    emp_id: String,
    state: &State<AppState>,
) -> Json<EmployeeInfoResponse> {

    match state.registry.get_employee(&emp_id) {
        Some(emp) => {
            println!("\n👤 Employee lookup: {} ({})", emp.name, emp_id);
            Json(EmployeeInfoResponse {
                emp_id: emp.emp_id.clone(),
                name: emp.name.clone(),
                department: emp.department.to_str().to_string(),
                role: emp.role.clone(),
            })
        }
        None => {
            println!("\n❌ Employee not found: {}", emp_id);
            Json(EmployeeInfoResponse {
                emp_id: emp_id.clone(),
                name: "Unknown".to_string(),
                department: "None".to_string(),
                role: "Employee not found".to_string(),
            })
        }
    }
}

// ─────────────────────────────────────────────
// Endpoint 3: /query — Ask AI with Permissions
// ─────────────────────────────────────────────

#[post("/query", format = "json", data = "<request>")]
async fn query(
    request: Json<QueryRequest>,
    state: &State<AppState>,
) -> Json<QueryResponseBody> {

    let query_id = generate_id();

    println!("\n📨 New /query request!");
    println!("  Employee ID: {}", request.emp_id);
    println!("  Question: {}", request.query_text);

    // Step 1 — Verify employee exists
    let employee = match state.registry.get_employee(&request.emp_id) {
        Some(emp) => {
            println!("  ✅ Employee verified: {} ({})",
                emp.name,
                emp.department.to_str()
            );
            emp.clone()
        }
        None => {
            println!("  ❌ Unknown employee ID: {}", request.emp_id);
            return Json(QueryResponseBody {
                query_id,
                emp_id: request.emp_id.clone(),
                department: "Unknown".to_string(),
                message: format!(
                    "❌ Access Denied: Employee ID '{}' not found in the system. \
                    Please contact your administrator.",
                    request.emp_id
                ),
            });
        }
    };

    // Step 2 — Record question in MORK
    state.storage.record_event(Event::UserInput {
        query_id: query_id.clone(),
        query_text: format!(
            "[EMP:{}|DEPT:{}] {}",
            employee.emp_id,
            employee.department.to_str(),
            request.query_text
        ),
    }).expect("Failed to record UserInput");

    // Step 3 — Convert question to embedding
    let query_embedding = match embeddings::get_embedding(
        &request.query_text,
        "search_query"
    ).await {
        Ok(emb) => emb,
        Err(e) => {
            println!("  ⚠️ Embedding failed: {}", e);
            vec![]
        }
    };

    // Step 4 — Search documents filtered by department permission
    let best_match = if !query_embedding.is_empty() {
        let docs = state.storage.doc_store.get_all();

        println!("  🔍 Searching {} documents with permission filter...", docs.len());

        docs.iter()
            .filter(|doc| {
                // Only search documents this employee CAN ACCESS
                // Convert department string back to Department enum
                match employees::Department::from_str(&doc.department) {
                    Some(doc_dept) => {
                        let can_access = state.registry.can_access(
                            &employee.emp_id,
                            &doc_dept
                        );
                        if !can_access {
                            println!(
                                "  🚫 Skipping doc '{}' (dept: {}) — no permission",
                                doc.title,
                                doc.department
                            );
                        }
                        can_access
                    }
                    None => false,
                }
            })
            .filter(|doc| !doc.embedding.is_empty())
            .map(|doc| {
                let similarity = embeddings::cosine_similarity(
                    &query_embedding,
                    &doc.embedding
                );
                (doc.title.clone(), doc.content.clone(), doc.department.clone(), similarity)
            })
            .max_by(|a, b| a.3.partial_cmp(&b.3).unwrap())
    } else {
        None
    };

    // Step 5 — Build prompt with department-filtered results
    let final_prompt = match &best_match {
        Some((title, content, dept, similarity)) if *similarity > 0.3 => {
            println!(
                "  📄 Found relevant doc: '{}' [{}] (similarity: {:.2})",
                title, dept, similarity
            );
            format!(
                "You are a helpful business assistant for WorkBindr.\n\
                The employee asking is {} from the {} department.\n\
                Use this document to answer their question:\n\n\
                Document Title: {}\n\
                Document Content: {}\n\n\
                Question: {}\n\n\
                Answer based on the document above.",
                employee.name,
                employee.department.to_str(),
                title,
                content,
                request.query_text
            )
        }
        _ => {
            println!("  ℹ️  No accessible document found for this query");
            format!(
                "You are a helpful business assistant. \
                Answer this question from {} in the {} department: {}",
                employee.name,
                employee.department.to_str(),
                request.query_text
            )
        }
    };

    // Step 6 — Ask the AI
    let ai_answer = match model::ask_ai(&final_prompt).await {
        Ok(answer) => answer,
        Err(error) => {
            println!("  ❌ AI Error: {}", error);
            format!("Sorry, something went wrong: {}", error)
        }
    };

    // Step 7 — Record response in MORK
    state.storage.record_event(Event::QueryResponse {
        query_id: query_id.clone(),
        response_text: ai_answer.clone(),
    }).expect("Failed to record QueryResponse");

    println!("  ✅ Response sent to {}", employee.name);

    Json(QueryResponseBody {
        query_id,
        emp_id: employee.emp_id,
        department: employee.department.to_str().to_string(),
        message: ai_answer,
    })
}

// ─────────────────────────────────────────────
// Endpoint 4: /add_document
// Department automatically tagged from emp_id
// ─────────────────────────────────────────────

#[post("/add_document", format = "json", data = "<request>")]
async fn add_document(
    request: Json<AddDocumentRequest>,
    state: &State<AppState>,
) -> Json<AddDocumentResponse> {

    let doc_id = generate_id();

    println!("\n📄 New /add_document request!");
    println!("  Uploaded by: {}", request.emp_id);

    // Step 1 — Verify employee exists
    let employee = match state.registry.get_employee(&request.emp_id) {
        Some(emp) => emp.clone(),
        None => {
            return Json(AddDocumentResponse {
                doc_id: "none".to_string(),
                department: "none".to_string(),
                message: format!(
                    "❌ Access Denied: Employee ID '{}' not found.",
                    request.emp_id
                ),
            });
        }
    };

    // Department is AUTOMATICALLY set from employee's department
    let department = employee.department.to_str().to_string();
    println!("  Auto-tagged to department: {}", department);

    // Step 2 — Record in MORK
    let full_content = format!(
        "TITLE: {} | DEPT: {} | UPLOADED_BY: {} | CONTENT: {}",
        request.title,
        department,
        employee.name,
        request.content
    );

    state.storage.record_event(Event::DocumentAdded {
        doc_id: doc_id.clone(),
        content: full_content,
    }).expect("Failed to record DocumentAdded");

    // Step 3 — Generate embedding
    println!("  🔢 Generating embedding...");
    let embedding = match embeddings::get_embedding(
        &request.content,
        "search_document"
    ).await {
        Ok(emb) => {
            println!("  ✅ Embedding generated!");
            emb
        }
        Err(e) => {
            println!("  ⚠️ Embedding failed: {}", e);
            vec![]
        }
    };

    // Step 4 — Save with department tag
    state.storage.doc_store.add_document(StoredDocument {
        doc_id: doc_id.clone(),
        title: request.title.clone(),
        content: request.content.clone(),
        embedding,
        department: department.clone(),      // ← department tag
        uploaded_by: employee.emp_id.clone(), // ← who uploaded it
    }).expect("Failed to save document");

    println!("  ✅ Document saved: {} [{}]", request.title, department);

    Json(AddDocumentResponse {
        doc_id: doc_id.clone(),
        department: department.clone(),
        message: format!(
            "✅ Document '{}' saved and tagged to {} department! \
            Only {} employees (and CEO) can access this. \
            doc_id: {}",
            request.title,
            department,
            department,
            doc_id
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

    println!("\n🪦  Delete request from emp: {}", request.emp_id);

    // Verify employee exists
    match state.registry.get_employee(&request.emp_id) {
        None => {
            return Json(DeleteDocumentResponse {
                doc_id: request.doc_id.clone(),
                message: format!(
                    "❌ Access Denied: Employee ID '{}' not found.",
                    request.emp_id
                ),
            });
        }
        Some(emp) => {
            println!("  Employee: {} ({})", emp.name, emp.department.to_str());
        }
    }

    state.storage.record_event(Event::Tombstone {
        doc_id: request.doc_id.clone(),
    }).expect("Failed to record Tombstone");

    Json(DeleteDocumentResponse {
        doc_id: request.doc_id.clone(),
        message: format!(
            "✅ Document {} marked as deleted. History preserved in MORK.",
            request.doc_id
        ),
    })
}

// ─────────────────────────────────────────────
// Endpoint 6: /history
// ─────────────────────────────────────────────

#[get("/history")]
fn history(state: &State<AppState>) -> Json<HistoryResponse> {
    let all_events = state.storage.get_history();
    let total = all_events.len();
    Json(HistoryResponse {
        total_events: total,
        events: all_events,
    })
}

// ─────────────────────────────────────────────
// Launch the Server
// ─────────────────────────────────────────────

#[launch]
fn rocket() -> _ {
    println!("=================================");
    println!("  WorkBindr Enterprise 🚀");
    println!("=================================\n");

    dotenvy::dotenv().ok();

    // Create our shared application state
    let state = AppState {
        storage: StorageLayer::new("workbinder_events.log"),
        registry: EmployeeRegistry::new(),
    };

    // CORS setup
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
        ])
}