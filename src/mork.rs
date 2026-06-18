// mork.rs
// This is MORK - our append-only event log
// Think of it as a notebook where we can only ADD pages, never tear them out

// "use" means "import this tool" - like picking up a tool from a toolbox
// std::fs = file system tools (reading/writing files on your computer)
// std::io = input/output tools (for error handling)
use std::fs::{File, OpenOptions};
use std::io::{self, Write, BufRead, BufReader};

// This is our MORK structure - it has one job:
// remember WHERE the log file is stored on your computer
pub struct Mork {
    file_path: String,  // the path to our log file e.g. "mork_log.txt"
}

// "impl" means "here are the functions that belong to Mork"
// Like writing the instruction manual for a specific machine
impl Mork {
    
    // This function CREATES a new Mork instance
    // "new" is a convention in Rust - like a factory that makes the thing
    pub fn new(file_path: &str) -> Self {
        // Self means "return a Mork"
        // String::from turns &str (borrowed text) into String (owned text)
        // Don't worry too much about this difference yet
        Mork {
            file_path: String::from(file_path),
        }
    }

    // This function WRITES one line to our log file
    // "&self" means "this function belongs to a Mork and can see its data"
    // "entry" is the text we want to write
    // "-> Result<(), io::Error>" means "either it works, or give me an error"
    pub fn append(&self, entry: &str) -> Result<(), io::Error> {
        
        // OpenOptions is like telling your computer HOW to open the file
        // .create(true) = create the file if it doesn't exist yet
        // .append(true) = add to the end, never overwrite
        // This is what makes MORK "append-only" - you can ONLY add to the end
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file_path)?;  // "?" means "if this fails, stop and return the error"

        // Write the entry + "\n" (new line) to the file
        writeln!(file, "{}", entry)?;
        
        // "()" means "nothing to return, it worked fine"
        Ok(())
    }

    // This function READS everything back from the log file
    // It returns a Vec<String> - a Vec is like a list/array
    // Vec<String> = a list of text lines
    pub fn read_all(&self) -> Result<Vec<String>, io::Error> {
        
        // Try to open the file for reading
        let file = File::open(&self.file_path)?;
        
        // BufReader reads the file line by line efficiently
        // Like reading a book page by page instead of all at once
        let reader = BufReader::new(file);
        
        // Create an empty list to store our lines
        let mut lines = Vec::new();
        
        // Go through each line in the file
        // "for line in reader.lines()" = "for each line in the file"
        for line in reader.lines() {
            // line? = "get the line or return error if something went wrong"
            lines.push(line?);  // push = add to end of list
        }
        
        // Return the complete list of lines
        Ok(lines)
    }
}