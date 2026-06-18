// storage.rs
// The brain of WorkBindr
// It receives events, understands them, and routes them correctly
//
// Think of this like a smart post office manager who:
// - Receives every piece of mail
// - Reads what type it is
// - Stamps it with time
// - Sends it to the right place
// - Keeps a record of everything

// We're bringing in our Event enum from events.rs
// "use" = "I want to use this thing from another file"
use crate::events::Event;

// We're bringing in MORK so we can record events
use crate::mork::Mork;

// std::time gives us the computer's clock
use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────
// The StorageLayer struct
// ─────────────────────────────────────────────
// A struct is like a form with fields
// This one has one field: a MORK instance
// Every StorageLayer HAS a MORK attached to it
pub struct StorageLayer {
    // This is our MORK black box
    // "mork" is the field name
    // "Mork" is the type (from mork.rs)
    mork: Mork,
}

// ─────────────────────────────────────────────
// Functions that belong to StorageLayer
// ─────────────────────────────────────────────
// "impl" = implementation
// Everything inside here is a function of StorageLayer
impl StorageLayer {

    // ── new() ────────────────────────────────
    // Creates a new StorageLayer
    // Like setting up a new post office with a fresh black box
    // "log_path" = where to store the MORK log file
    pub fn new(log_path: &str) -> Self {
        // Print a message so we can see it starting up
        println!("Storage Layer initializing...");
        
        // Create a new MORK instance at the given path
        let mork = Mork::new(log_path);
        
        println!("Storage Layer ready!");
        
        // Return a StorageLayer with this MORK attached
        // In Rust if the last line has no semicolon
        // it automatically gets returned
        StorageLayer { mork }
    }

    // ── get_timestamp() ──────────────────────
    // Private helper function
    // Gives us the current time as a number (milliseconds)
    // "private" means only THIS file can use it
    // (no "pub" in front = private)
    fn get_timestamp() -> u128 {
        // u128 = a very large positive number
        // big enough to hold milliseconds since 1970
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis()
    }

    // ── record_event() ───────────────────────
    // THE most important function in this file
    // This is called every time ANYTHING happens in WorkBindr
    //
    // "&self" = this function belongs to StorageLayer
    //           and can read its data (the mork field)
    // "event" = the Event we want to record
    //           it's our Event enum from events.rs
    // "-> Result<(), String>" = either works fine ()
    //                           or returns an error message String
    pub fn record_event(&self, event: Event) -> Result<(), String> {
        
        // Get the current timestamp
        // We'll attach this to every event
        let timestamp = Self::get_timestamp();
        
        // "match" is like a smart switch statement
        // It looks at what TYPE of event came in
        // and runs different code for each type
        // Think of it like a sorting machine at the post office
        match event {

            // ── Handle UserInput ──────────────
            // Someone asked the AI a question
            Event::UserInput { query_id, query_text } => {
                
                println!("Processing UserInput event...");
                
                // Build the log entry as a formatted string
                // This is what gets written to the MORK file
                let log_entry = format!(
                    "[{}] EVENT: UserInput | query_id: {} | text: {}",
                    timestamp,  // when it happened
                    query_id,   // unique ID for this query
                    query_text  // what the user asked
                );
                
                // Write to MORK
                // map_err converts the io::Error into a String error
                // so our function can return it cleanly
                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;
                
                println!("UserInput recorded in MORK");
                
                // In the future this is where we'll send
                // the query to the AI model
                // For now we just print a placeholder
                println!(" [Placeholder] Sending to AI model...");
                println!(" [Placeholder] AI would respond here");
            }

            // ── Handle DocumentAdded ──────────
            // Someone uploaded a document
            Event::DocumentAdded { doc_id, content } => {
                
                println!("Processing DocumentAdded event...");
                
                let log_entry = format!(
                    "[{}] EVENT: DocumentAdded | doc_id: {} | content: {}",
                    timestamp,
                    doc_id,
                    content
                );
                
                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;
                
                println!("Document recorded in MORK");
                
                // In the future this is where we'll
                // create embeddings for RAG
                // (embeddings = converting text to numbers
                //  so the AI can search it)
                println!("Creating embeddings for RAG...");
            }

            // ── Handle Tombstone ─────────────
            // Someone deleted a document
            // Remember: we never actually delete
            // We just record THAT it was deleted
            Event::Tombstone { doc_id } => {
                
                println!("Processing Tombstone event...");
                
                let log_entry = format!(
                    "[{}] EVENT: Tombstone | doc_id: {} | status: DELETED",
                    timestamp,
                    doc_id
                );
                
                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;
                
                println!("  Deletion recorded in MORK");
                println!("  Note: Document history preserved forever");
            }

            // ── Handle QueryResponse ──────────
            // The AI sent back an answer
            Event::QueryResponse { query_id, response_text } => {
                
                println!("Processing QueryResponse event...");
                
                let log_entry = format!(
                    "[{}] EVENT: QueryResponse | query_id: {} | response: {}",
                    timestamp,
                    query_id,
                    response_text
                );
                
                self.mork.append(&log_entry)
                    .map_err(|e| format!("MORK write failed: {}", e))?;
                
                println!(" AI Response recorded in MORK");
            }
        }

        // If we made it here everything worked fine
        // Ok(()) means "success, nothing to return"
        Ok(())
    }

    // ── get_history() ────────────────────────
    // Returns ALL events ever recorded
    // Like asking the post office for every letter ever sent
    pub fn get_history(&self) -> Vec<String> {
        
        // read_all() returns a Result
        // unwrap_or_default() means:
        // "if it works give me the data,
        //  if it fails give me an empty list"
        self.mork.read_all()
            .unwrap_or_default()
    }

    // ── get_event_count() ────────────────────
    // Returns how many events are in MORK
    // Like asking "how many letters have we ever processed?"
    pub fn get_event_count(&self) -> usize {
        // usize = a positive whole number
        // used for counts and lengths in Rust
        self.get_history().len()
    }
}