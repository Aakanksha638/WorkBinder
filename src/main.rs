// main.rs
// Now with document upload, delete, and history endpoints

#[macro_use] extern crate rocket;

mod events;
mod mork;
mod storage;
mod model;
mod embeddings;

use events::Event;
use storage::StorageLayer;
use model::ask_ai;

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;

use std::time::{SystemTime, UNIX_EPOCH};

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

// Shape of incoming /query request
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct QueryRequest {
    query_text: String,
}

// Shape of response we send back from /query
#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct QueryResponseBody {
    query_id: String,
    message: String,
}

// Shape of incoming /add_document request
// "content" = the actual text of the document
// "title" = a human readable name for it
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentRequest {
    title: String,
    content: String,
}

// Shape of response from /add_document
#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentResponse {
    doc_id: String,
    message: String,
}

// Shape of incoming /delete_document request
// We only need the doc_id to delete something
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct DeleteDocumentRequest {
    doc_id: String,
}

// Shape of response from /delete_document
#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct DeleteDocumentResponse {
    doc_id: String,
    message: String,
}

// Shape of response from /history
// Just a list of all events as strings
#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct HistoryResponse {
    total_events: usize,
    events: Vec<String>,
}

// ─────────────────────────────────────────────
// Endpoint 1: Homepage
// ─────────────────────────────────────────────

#[get("/")]
fn index() -> &'static str {
    "WorkBindr API is alive! 🚀
    
Available endpoints:
    GET  /              - This page
    POST /query         - Ask the AI a question
    POST /add_document  - Upload a document
    POST /delete_document - Delete a document
    GET  /history       - See all events ever recorded"
}

// ─────────────────────────────────────────────
// Endpoint 2: /query — Ask the AI
// ─────────────────────────────────────────────

#[post("/query", format = "json", data = "<request>")]
async fn query(
    request: Json<QueryRequest>,
    storage: &State<StorageLayer>,
) -> Json<QueryResponseBody> {

    let query_id = generate_id();
    println!("\n📨 New /query request received!");

    // Record the question
    storage.inner().record_event(Event::UserInput {
        query_id: query_id.clone(),
        query_text: request.query_text.clone(),
    }).expect("Failed to record UserInput");

    // Ask the AI
    let ai_answer = match ask_ai(&request.query_text).await {
        Ok(answer) => answer,
        Err(error) => {
            println!("  ❌ AI Error: {}", error);
            format!("Sorry, something went wrong: {}", error)
        }
    };

    // Record the AI's answer
    storage.inner().record_event(Event::QueryResponse {
        query_id: query_id.clone(),
        response_text: ai_answer.clone(),
    }).expect("Failed to record QueryResponse");

    Json(QueryResponseBody {
        query_id,
        message: ai_answer,
    })
}

// ─────────────────────────────────────────────
// Endpoint 3: /add_document — Upload a Document
// ─────────────────────────────────────────────

#[post("/add_document", format = "json", data = "<request>")]
fn add_document(
    request: Json<AddDocumentRequest>,
    storage: &State<StorageLayer>,
) -> Json<AddDocumentResponse> {

    // Generate a unique ID for this document
    let doc_id = generate_id();

    println!("\n📄 New /add_document request received!");
    println!("  Title: {}", request.title);

    // Combine title and content so we store both together
    // format! builds a String with variables inserted
    let full_content = format!(
        "TITLE: {} | CONTENT: {}",
        request.title,
        request.content
    );

    // Record the document in MORK permanently
    storage.inner().record_event(Event::DocumentAdded {
        doc_id: doc_id.clone(),
        content: full_content,
    }).expect("Failed to record DocumentAdded");

    println!("  ✅ Document saved with ID: {}", doc_id);

    // Send back confirmation + the new doc_id
    // The user needs this doc_id to delete the document later
    Json(AddDocumentResponse {
        doc_id: doc_id.clone(),
        message: format!(
            "Document '{}' saved successfully! Your doc_id is: {}. Keep this safe — you'll need it to delete this document later.",
            request.title,
            doc_id
        ),
    })
}

// ─────────────────────────────────────────────
// Endpoint 4: /delete_document — Delete a Document
// ─────────────────────────────────────────────

#[post("/delete_document", format = "json", data = "<request>")]
fn delete_document(
    request: Json<DeleteDocumentRequest>,
    storage: &State<StorageLayer>,
) -> Json<DeleteDocumentResponse> {

    println!("\n🪦 New /delete_document request received!");
    println!("  Deleting doc_id: {}", request.doc_id);

    // Record the TOMBSTONE event
    // Remember: we never actually delete anything
    // We just write "this was deleted" into MORK
    // The full history of the document still exists forever
    storage.inner().record_event(Event::Tombstone {
        doc_id: request.doc_id.clone(),
    }).expect("Failed to record Tombstone");

    println!("  ✅ Tombstone recorded — document marked as deleted");

    Json(DeleteDocumentResponse {
        doc_id: request.doc_id.clone(),
        message: format!(
            "Document {} marked as deleted. Note: history preserved forever in MORK.",
            request.doc_id
        ),
    })
}

// ─────────────────────────────────────────────
// Endpoint 5: /history — See Everything in MORK
// ─────────────────────────────────────────────

// This is a GET endpoint — no data sent, just asking for information
#[get("/history")]
fn history(storage: &State<StorageLayer>) -> Json<HistoryResponse> {

    println!("\n📚 /history requested — reading full MORK log...");

    // Get every event ever recorded
    let all_events = storage.inner().get_history();
    let total = all_events.len();

    println!("  ✅ Found {} total events", total);

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
    println!("  WorkBindr API Starting Up... 🚀");
    println!("=================================\n");

    dotenvy::dotenv().ok();

    let storage = StorageLayer::new("workbinder_events.log");

    // CORS = Cross Origin Resource Sharing
    // This tells the browser "yes, the frontend is allowed to talk to us"
    // Without this, browsers BLOCK frontend requests to our backend
    let cors = rocket_cors::CorsOptions {
        
        // AllowedOrigins = which websites are allowed to call our API
        // "all()" means anyone can call it — fine for development
        // In production you'd list specific URLs like "https://workbindr.com"
        allowed_origins: rocket_cors::AllowedOrigins::all(),
        
        // AllowedMethods = which HTTP methods are allowed
        // We use GET and POST so we allow both
        allowed_methods: vec![
            rocket::http::Method::Get,
            rocket::http::Method::Post,
        ]
        .into_iter()
        .map(From::from)
        .collect(),
        
        // AllowedHeaders = which headers are allowed in requests
        // "All" means we accept any headers — fine for now
        allowed_headers: rocket_cors::AllowedHeaders::all(),
        
        // allow_credentials = allow cookies/auth headers
        allow_credentials: true,
        
        ..Default::default()
    }
    // .to_cors() converts our options into actual CORS middleware
    // "expect" crashes with a message if something is wrong
    .to_cors()
    .expect("CORS configuration failed");

    rocket::build()
        .manage(storage)
        // .attach(cors) = "add CORS to every single request automatically"
        .attach(cors)
        .mount("/", routes![
            index,
            query,
            add_document,
            delete_document,
            history,
        ])
}