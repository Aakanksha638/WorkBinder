// main.rs
// Now /query actually talks to a real AI!

#[macro_use] extern crate rocket;

mod events;
mod mork;
mod storage;
mod model;     // ← NEW: our AI connection file

use events::Event;
use storage::StorageLayer;
use model::ask_ai;   // ← NEW: bring in our AI function

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;

use std::time::{SystemTime, UNIX_EPOCH};

fn generate_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();
    format!("id_{}", timestamp)
}

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

// ─────────────────────────────────────────────
// The /query Endpoint — NOW WITH REAL AI
// ─────────────────────────────────────────────

// Notice: "async fn" now instead of just "fn"
// This is REQUIRED because we now wait for the internet (OpenAI)
#[post("/query", format = "json", data = "<request>")]
async fn query(
    request: Json<QueryRequest>,
    storage: &State<StorageLayer>,
) -> Json<QueryResponseBody> {

    let query_id = generate_id();

    println!("\n📨 New /query request received!");

    // Step 1 — Record that the user asked something
    let user_event = Event::UserInput {
        query_id: query_id.clone(),
        query_text: request.query_text.clone(),
    };

    storage.inner().record_event(user_event)
        .expect("Failed to record UserInput event");

    // Step 2 — Actually ask the AI the question
    // ".await" = wait here until OpenAI responds
    let ai_answer = match ask_ai(&request.query_text).await {
        Ok(answer) => answer,
        Err(error) => {
            println!("  ❌ AI Error: {}", error);
            format!("Sorry, something went wrong: {}", error)
        }
    };

    // Step 3 — Record the AI's real response in MORK
    let response_event = Event::QueryResponse {
        query_id: query_id.clone(),
        response_text: ai_answer.clone(),
    };

    storage.inner().record_event(response_event)
        .expect("Failed to record QueryResponse event");

    // Step 4 — Send the real AI answer back to the user
    Json(QueryResponseBody {
        query_id,
        message: ai_answer,
    })
}

#[get("/")]
fn index() -> &'static str {
    "WorkBindr API is alive! 🚀 Try POST /query"
}

#[launch]
fn rocket() -> _ {
    println!("=================================");
    println!("  WorkBindr API Starting Up... 🚀");
    println!("=================================\n");

    // Load the .env file so OPENAI_API_KEY becomes available
    // This MUST happen before anything tries to read the key
    dotenvy::dotenv().ok();

    let storage = StorageLayer::new("workbinder_events.log");

    rocket::build()
        .manage(storage)
        .mount("/", routes![index, query])
}