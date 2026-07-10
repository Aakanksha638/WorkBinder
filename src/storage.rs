// storage.rs
// The brain of WorkBindr
// Receives events, routes them to MORK
// Also stores documents with embeddings for RAG search

use crate::events::Event;
use crate::mork::Mork;

use std::sync::Mutex;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

// We need serde for saving/loading JSON files
use serde::{Serialize, Deserialize};

// ─────────────────────────────────────────────
// Document Store — Stores Documents + Embeddings
// ─────────────────────────────────────────────

// One stored document with its embedding
// Serialize = can be saved to JSON file
// Deserialize = can be loaded from JSON file
// Clone = can be copied
#[derive(Serialize, Deserialize, Clone)]
pub struct StoredDocument {
    pub doc_id: String,
    pub title: String,
    pub content: String,
    pub embedding: Vec<f32>,  // the meaning-numbers from Jina
}

// Holds ALL documents in memory AND on disk
pub struct DocumentStore {
    pub docs: Mutex<Vec<StoredDocument>>,
    file_path: String,
}

impl DocumentStore {

    // Create a new DocumentStore
    // Automatically loads any previously saved documents from disk
    pub fn new(file_path: &str) -> Self {
        println!("📂 Loading document store from disk...");

        // Try to load existing documents
        let existing_docs = match Self::load_from_disk(file_path) {
            Ok(docs) => {
                println!("  ✅ Loaded {} documents from disk", docs.len());
                docs
            }
            Err(_) => {
                println!("  ℹ️  No existing documents found, starting fresh");
                Vec::new()
            }
        };

        DocumentStore {
            docs: Mutex::new(existing_docs),
            file_path: file_path.to_string(),
        }
    }

    // Load documents from JSON file on disk
    fn load_from_disk(file_path: &str) -> Result<Vec<StoredDocument>, String> {
        let json = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let docs: Vec<StoredDocument> = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse document store: {}", e))?;

        Ok(docs)
    }

    // Save all documents to JSON file on disk
    // Called every time a new document is added
    pub fn save_to_disk(&self) -> Result<(), String> {
        let docs = self.docs.lock().unwrap();

        let json = serde_json::to_string_pretty(&*docs)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        fs::write(&self.file_path, json)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        println!("  💾 Saved {} documents to disk", docs.len());
        Ok(())
    }

    // Add a new document and save to disk immediately
    pub fn add_document(&self, doc: StoredDocument) -> Result<(), String> {
        {
            let mut docs = self.docs.lock().unwrap();
            docs.push(doc);
        }
        self.save_to_disk()
    }

    // Get all documents for RAG searching
    pub fn get_all(&self) -> Vec<StoredDocument> {
        self.docs.lock().unwrap().clone()
    }
}

// ─────────────────────────────────────────────
// Storage Layer — The Main Brain
// ─────────────────────────────────────────────

pub struct StorageLayer {
    mork: Mork,
    pub doc_store: DocumentStore,
}

impl StorageLayer {

    // Create a new StorageLayer with MORK and DocumentStore
    pub fn new(log_path: &str) -> Self {
        println!("🗄️  Storage Layer initializing...");

        let mork = Mork::new(log_path);

        // Documents saved in a separate JSON file
        let doc_store = DocumentStore::new("workbinder_documents.json");

        println!("✅ Storage Layer ready!\n");

        StorageLayer { mork, doc_store }
    }

    // Helper: get current timestamp in milliseconds
    fn get_timestamp() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis()
    }

    // ── record_event ─────────────────────────
    // THE most important function
    // Called every time ANYTHING happens in WorkBindr
    pub fn record_event(&self, event: Event) -> Result<(), String> {

        let timestamp = Self::get_timestamp();

        match event {

            // ── UserInput ────────────────────
            Event::UserInput { query_id, query_text } => {
                println!("📨 Processing UserInput event...");

                let log_entry = format!(
                    "[{}] EVENT: UserInput | query_id: {} | text: {}",
                    timestamp,
                    query_id,
                    query_text
                );

                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;

                println!("  ✅ UserInput recorded in MORK");
            }

            // ── DocumentAdded ────────────────
            Event::DocumentAdded { doc_id, content } => {
                println!("📄 Processing DocumentAdded event...");

                let log_entry = format!(
                    "[{}] EVENT: DocumentAdded | doc_id: {} | content: {}",
                    timestamp,
                    doc_id,
                    content
                );

                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;

                println!("  ✅ Document recorded in MORK");
            }

            // ── Tombstone ────────────────────
            Event::Tombstone { doc_id } => {
                println!("🪦  Processing Tombstone event...");

                let log_entry = format!(
                    "[{}] EVENT: Tombstone | doc_id: {} | status: DELETED",
                    timestamp,
                    doc_id
                );

                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;

                println!("  ✅ Deletion recorded in MORK");
                println!("  ℹ️  Document history preserved forever");
            }

            // ── QueryResponse ────────────────
            Event::QueryResponse { query_id, response_text } => {
                println!("💬 Processing QueryResponse event...");

                let log_entry = format!(
                    "[{}] EVENT: QueryResponse | query_id: {} | response: {}",
                    timestamp,
                    query_id,
                    response_text
                );

                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;

                println!("  ✅ AI Response recorded in MORK");
            }
        }

        Ok(())
    }

    // ── get_history ──────────────────────────
    // Returns ALL events ever recorded in MORK
    pub fn get_history(&self) -> Vec<String> {
        self.mork.read_all().unwrap_or_default()
    }

    // ── get_event_count ──────────────────────
    // Returns total number of events in MORK
    pub fn get_event_count(&self) -> usize {
        self.get_history().len()
    }
}