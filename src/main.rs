// main.rs
// Complete WorkBindr backend with RAG

#[macro_use] extern crate rocket;

mod events;
mod mork;
mod storage;
mod model;
mod embeddings;

use events::Event;
use storage::{StorageLayer, StoredDocument};
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

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct QueryRequest {
    query_text: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct QueryResponseBody {
    query_id: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentRequest {
    title: String,
    content: String,
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct AddDocumentResponse {
    doc_id: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct DeleteDocumentRequest {
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

// ─────────────────────────────────────────────
// Endpoint 1: Homepage
// ─────────────────────────────────────────────

#[get("/")]
fn index() -> &'static str {
    "WorkBindr API is alive! 🚀

Available endpoints:
    GET  /                  - This page
    POST /query             - Ask the AI (with RAG)
    POST /add_document      - Upload a document
    POST /delete_document   - Delete a document
    GET  /history           - See all MORK events"
}

// ─────────────────────────────────────────────
// Endpoint 2: /query — Ask AI with RAG
// ─────────────────────────────────────────────

#[post("/query", format = "json", data = "<request>")]
async fn query(
    request: Json<QueryRequest>,
    storage: &State<StorageLayer>,
) -> Json<QueryResponseBody> {

    let query_id = generate_id();
    println!("\n📨 New /query request received!");
    println!("  Question: {}", request.query_text);

    // Step 1 — Record user question in MORK
    storage.inner().record_event(Event::UserInput {
        query_id: query_id.clone(),
        query_text: request.query_text.clone(),
    }).expect("Failed to record UserInput");

    // Step 2 — Convert question to embedding for searching
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

    // Step 3 — Search documents for best match
    let best_match = if !query_embedding.is_empty() {
        let docs = storage.inner().doc_store.get_all();

        docs.iter()
            .filter(|doc| !doc.embedding.is_empty())
            .map(|doc| {
                let similarity = embeddings::cosine_similarity(
                    &query_embedding,
                    &doc.embedding
                );
                (doc.title.clone(), doc.content.clone(), similarity)
            })
            .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap())
    } else {
        None
    };

    // Step 4 — Build prompt with or without document context
    let final_prompt = match &best_match {
        Some((title, content, similarity)) if *similarity > 0.3 => {
            println!(
                "  📄 Found relevant document: '{}' (similarity: {:.2})",
                title, similarity
            );
            format!(
                "You are a helpful business assistant for WorkBindr.\n\
                Use this document to answer the question:\n\n\
                Document Title: {}\n\
                Document Content: {}\n\n\
                Question: {}\n\n\
                Answer based on the document above.",
                title, content, request.query_text
            )
        }
        _ => {
            println!("  ℹ️  No relevant document found, using general knowledge");
            request.query_text.clone()
        }
    };

    // Step 5 — Ask the AI
    let ai_answer = match model::ask_ai(&final_prompt).await {
        Ok(answer) => answer,
        Err(error) => {
            println!("  ❌ AI Error: {}", error);
            format!("Sorry, something went wrong: {}", error)
        }
    };

    // Step 6 — Record AI response in MORK
    storage.inner().record_event(Event::QueryResponse {
        query_id: query_id.clone(),
        response_text: ai_answer.clone(),
    }).expect("Failed to record QueryResponse");

    println!("  ✅ Response sent!");

    Json(QueryResponseBody {
        query_id,
        message: ai_answer,
    })
}

// ─────────────────────────────────────────────
// Endpoint 3: /add_document
// ─────────────────────────────────────────────

#[post("/add_document", format = "json", data = "<request>")]
async fn add_document(
    request: Json<AddDocumentRequest>,
    storage: &State<StorageLayer>,
) -> Json<AddDocumentResponse> {

    let doc_id = generate_id();

    println!("\n📄 New /add_document request received!");
    println!("  Title: {}", request.title);

    // Record in MORK (permanent history)
    let full_content = format!(
        "TITLE: {} | CONTENT: {}",
        request.title,
        request.content
    );

    storage.inner().record_event(Event::DocumentAdded {
        doc_id: doc_id.clone(),
        content: full_content,
    }).expect("Failed to record DocumentAdded");

    // Convert document to embedding
    println!("  🔢 Generating embedding for RAG...");

    let embedding = match embeddings::get_embedding(
        &request.content,
        "search_document"
    ).await {
        Ok(emb) => {
            println!("  ✅ Embedding generated successfully!");
            emb
        }
        Err(e) => {
            println!("  ⚠️ Embedding failed: {} — document saved without RAG", e);
            vec![]
        }
    };

    // Save document + embedding to disk
    storage.inner().doc_store.add_document(StoredDocument {
        doc_id: doc_id.clone(),
        title: request.title.clone(),
        content: request.content.clone(),
        embedding,
    }).expect("Failed to save document");

    println!("  ✅ Document saved with ID: {}", doc_id);

    Json(AddDocumentResponse {
        doc_id: doc_id.clone(),
        message: format!(
            "✅ Document '{}' saved and indexed for AI search! \
            doc_id: {} \
            Keep this to delete the document later.",
            request.title,
            doc_id
        ),
    })
}

// ─────────────────────────────────────────────
// Endpoint 4: /delete_document
// ─────────────────────────────────────────────

#[post("/delete_document", format = "json", data = "<request>")]
fn delete_document(
    request: Json<DeleteDocumentRequest>,
    storage: &State<StorageLayer>,
) -> Json<DeleteDocumentResponse> {

    println!("\n🪦  New /delete_document request received!");
    println!("  Deleting doc_id: {}", request.doc_id);

    storage.inner().record_event(Event::Tombstone {
        doc_id: request.doc_id.clone(),
    }).expect("Failed to record Tombstone");

    println!("  ✅ Tombstone recorded in MORK");

    Json(DeleteDocumentResponse {
        doc_id: request.doc_id.clone(),
        message: format!(
            "Document {} marked as deleted. History preserved in MORK forever.",
            request.doc_id
        ),
    })
}

// ─────────────────────────────────────────────
// Endpoint 5: /history
// ─────────────────────────────────────────────

#[get("/history")]
fn history(storage: &State<StorageLayer>) -> Json<HistoryResponse> {

    println!("\n📚 /history requested...");

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

    // CORS setup — allows frontend to talk to backend
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
        .manage(storage)
        .attach(cors)
        .mount("/", routes![
            index,
            query,
            add_document,
            delete_document,
            history,
        ])
}