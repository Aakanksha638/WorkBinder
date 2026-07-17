// events.rs
// Complete list of all things that can happen in WorkBindr
// Each variant is ONE specific event type

pub enum Event {

    // ── AI Events ────────────────────────────
    // Someone asked the AI a question
    UserInput {
        query_id: String,
        query_text: String,
    },

    // AI gave back an answer
    QueryResponse {
        query_id: String,
        response_text: String,
    },

    // ── Document Events ───────────────────────
    // Someone added a document
    DocumentAdded {
        doc_id: String,
        content: String,
    },

    // Someone deleted a document
    // We never actually delete — just record it happened
    Tombstone {
        doc_id: String,
    },

    // ── Task Events ───────────────────────────
    // Someone created a new task
    TaskCreated {
        task_id: String,
        title: String,
        assigned_to: String,
        priority: String,
        department: String,
    },

    // Someone updated a task's status
    TaskUpdated {
        task_id: String,
        old_status: String,
        new_status: String,
        updated_by: String,
    },
}