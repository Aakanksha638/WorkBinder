// embeddings.rs
// Converts text into embeddings using Jina AI (free tier)

use reqwest::Client;
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────
// Shapes of data we SEND to Jina
// ─────────────────────────────────────────────

#[derive(Serialize)]
struct JinaRequest {
    model: String,
    input: Vec<String>,
}

// ─────────────────────────────────────────────
// Shapes of data Jina SENDS BACK
// ─────────────────────────────────────────────

#[derive(Deserialize)]
struct JinaResponse {
    data: Vec<JinaEmbeddingData>,
}

#[derive(Deserialize)]
struct JinaEmbeddingData {
    embedding: Vec<f32>,
}

// ─────────────────────────────────────────────
// Convert ONE piece of text into an embedding
// ─────────────────────────────────────────────

// Note: "input_type" parameter kept for compatibility with
// how we call this function elsewhere, but Jina doesn't need it
pub async fn get_embedding(text: &str, _input_type: &str) -> Result<Vec<f32>, String> {

    let api_key = std::env::var("JINA_API_KEY")
        .map_err(|_| "JINA_API_KEY not found in .env file".to_string())?;

    let client = Client::new();

    let request_body = JinaRequest {
        model: "jina-embeddings-v2-base-en".to_string(),
        input: vec![text.to_string()],
    };

    println!("  🔢 Converting text to embedding...");

    let response = client
        .post("https://api.jina.ai/v1/embeddings")
        .bearer_auth(&api_key)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Jina API error: {}", error_text));
    }

    let parsed: JinaResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse embedding response: {}", e))?;

    let embedding = parsed.data
        .get(0)
        .map(|d| d.embedding.clone())
        .ok_or_else(|| "No embedding returned".to_string())?;

    println!("  ✅ Got embedding with {} dimensions", embedding.len());

    Ok(embedding)
}

// ─────────────────────────────────────────────
// Compare Two Embeddings — Cosine Similarity
// ─────────────────────────────────────────────

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {

    let dot_product: f32 = a.iter()
        .zip(b.iter())
        .map(|(x, y)| x * y)
        .sum();

    let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if magnitude_a == 0.0 || magnitude_b == 0.0 {
        return 0.0;
    }

    dot_product / (magnitude_a * magnitude_b)
}