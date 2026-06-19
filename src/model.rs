// model.rs
// This file talks to Groq's servers (free, fast AI inference)
// Same shape as OpenAI's API - they made it compatible on purpose

use reqwest::Client;
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────
// Shapes of data we SEND to Groq
// ─────────────────────────────────────────────

#[derive(Serialize)]
struct GroqRequest {
    model: String,
    messages: Vec<Message>,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

// ─────────────────────────────────────────────
// Shapes of data Groq SENDS BACK to us
// ─────────────────────────────────────────────

#[derive(Deserialize)]
struct GroqResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

// ─────────────────────────────────────────────
// The Main Function — Ask the AI a Question
// ─────────────────────────────────────────────

pub async fn ask_ai(query_text: &str) -> Result<String, String> {

    // Read the Groq key from .env (note the new variable name)
    let api_key = std::env::var("GROQ_API_KEY")
        .map_err(|_| "GROQ_API_KEY not found in .env file".to_string())?;

    let client = Client::new();

    let request_body = GroqRequest {
        // llama-3.1-8b-instant = a free, fast model hosted by Groq
        model: "llama-3.1-8b-instant".to_string(),
        messages: vec![
            Message {
                role: "user".to_string(),
                content: query_text.to_string(),
            }
        ],
    };

    println!(" Sending request to Groq...");

    // Only the URL is different from OpenAI
    let response = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(&api_key)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Groq API error: {}", error_text));
    }

    let parsed: GroqResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let answer = parsed.choices
        .get(0)
        .map(|choice| choice.message.content.clone())
        .ok_or_else(|| "No response from AI".to_string())?;

    println!(" Got response from Groq!");

    Ok(answer)
}