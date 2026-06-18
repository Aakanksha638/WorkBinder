//this is out enum - the list of all things that can happen in our app

pub enum Event {

//When a user types a question to the AI
UserInput { 
    query_id : String, //a unique ID for this question
    query_text : String, // the actual question
},
//When someone adds a document
DocumentAdded { 
    doc_id : String, //unoque ID for the document
    content : String,  // the actual text of the document
},
Tombstone {
    doc_id : String,  //which id was deleted
},
QueryResponse { 
    query_id : String,   //which question this answer
    response_text : String, //the answer from the AI
},
}