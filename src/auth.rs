// auth.rs
// Authentication system for WorkBindr
// Handles password hashing, JWT creation and verification

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::fs;
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use bcrypt::{hash, verify, DEFAULT_COST};

// ─────────────────────────────────────────────
// JWT Claims
// This is what gets stored INSIDE the token
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Claims {
    pub emp_id:     String,    // who this token belongs to
    pub department: String,    // their department
    pub exp:        usize,     // when token expires (unix timestamp)
    pub iat:        usize,     // when token was issued
}

// ─────────────────────────────────────────────
// User Credentials
// Stored on disk (never store plain passwords!)
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserCredential {
    pub emp_id:          String,
    pub password_hash:   String,   // bcrypt hash, NOT the real password
    pub created_at:      u128,
    pub last_login:      Option<u128>,
}

// ─────────────────────────────────────────────
// Auth Store
// Manages all credentials
// ─────────────────────────────────────────────

pub struct AuthStore {
    credentials: Mutex<HashMap<String, UserCredential>>,
    file_path:   String,
    jwt_secret:  String,
}

impl AuthStore {

    pub fn new(file_path: &str, jwt_secret: &str) -> Self {
        println!("🔐 Loading auth store...");

        let existing = match Self::load_from_disk(file_path) {
            Ok(creds) => {
                println!("  ✅ Loaded {} credentials", creds.len());
                creds
            }
            Err(_) => {
                println!("  ℹ️  No credentials found, starting fresh");
                HashMap::new()
            }
        };

        let store = AuthStore {
            credentials: Mutex::new(existing),
            file_path:   file_path.to_string(),
            jwt_secret:  jwt_secret.to_string(),
        };

        // Create default accounts if none exist
        store.ensure_default_accounts();
        store
    }

    // Create default accounts for all demo employees
    // Password for everyone = their emp_id + "Pass1!"
    // e.g. emp 0001 → password is "0001Pass1!"
    fn ensure_default_accounts(&self) {
        let defaults = vec![
            ("0000", "0000Pass1!"),
            ("0001", "0001Pass1!"),
            ("0002", "0002Pass1!"),
            ("0003", "0003Pass1!"),
            ("0004", "0004Pass1!"),
            ("0005", "0005Pass1!"),
            ("0006", "0006Pass1!"),
            ("0007", "0007Pass1!"),
            ("0008", "0008Pass1!"),
        ];

        let mut created_any = false;
        {
            let credentials = self.credentials.lock().unwrap();
            for (emp_id, _) in &defaults {
                if !credentials.contains_key(*emp_id) {
                    drop(credentials);
                    // Need to create this account
                    created_any = true;
                    break;
                }
            }
        }

        if created_any {
            println!("  🔑 Creating default accounts...");
            for (emp_id, password) in defaults {
                let creds = self.credentials.lock().unwrap();
                if !creds.contains_key(emp_id) {
                    drop(creds);
                    self.create_account(
                        emp_id.to_string(),
                        password.to_string(),
                    ).ok();
                }
            }
            println!("  ✅ Default accounts created");
        }
    }

    fn load_from_disk(
        file_path: &str
    ) -> Result<HashMap<String, UserCredential>, String> {
        let json = fs::read_to_string(file_path)
            .map_err(|e| format!("Read failed: {}", e))?;
        let creds: HashMap<String, UserCredential> =
            serde_json::from_str(&json)
            .map_err(|e| format!("Parse failed: {}", e))?;
        Ok(creds)
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let credentials = self.credentials.lock().unwrap();
        let json = serde_json::to_string_pretty(&*credentials)
            .map_err(|e| format!("Serialize failed: {}", e))?;
        fs::write(&self.file_path, json)
            .map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    // Create a new account with hashed password
    pub fn create_account(
        &self,
        emp_id:   String,
        password: String,
    ) -> Result<(), String> {

        // Hash the password using bcrypt
        // DEFAULT_COST = 12 rounds of hashing
        // This makes brute force attacks very slow
        let password_hash = hash(&password, DEFAULT_COST)
            .map_err(|e| format!("Hashing failed: {}", e))?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();

        let credential = UserCredential {
            emp_id:        emp_id.clone(),
            password_hash,
            created_at:    now,
            last_login:    None,
        };

        {
            let mut credentials = self.credentials.lock().unwrap();
            credentials.insert(emp_id, credential);
        }

        self.save_to_disk()
    }

    // Change password for an employee
    pub fn change_password(
        &self,
        emp_id:       &str,
        old_password: &str,
        new_password: &str,
    ) -> Result<(), String> {

        // First verify the old password
        {
            let credentials = self.credentials.lock().unwrap();
            match credentials.get(emp_id) {
                None => return Err("Account not found".to_string()),
                Some(cred) => {
                    let valid = verify(old_password, &cred.password_hash)
                        .map_err(|e| format!("Verify failed: {}", e))?;
                    if !valid {
                        return Err("Current password is incorrect".to_string());
                    }
                }
            }
        }

        // Hash new password
        let new_hash = hash(new_password, DEFAULT_COST)
            .map_err(|e| format!("Hashing failed: {}", e))?;

        {
            let mut credentials = self.credentials.lock().unwrap();
            if let Some(cred) = credentials.get_mut(emp_id) {
                cred.password_hash = new_hash;
            }
        }

        self.save_to_disk()
    }

    // Verify password and generate JWT token
    pub fn login(
        &self,
        emp_id:     &str,
        password:   &str,
        department: &str,
    ) -> Result<String, String> {

        // Check credentials exist
        let password_hash = {
            let credentials = self.credentials.lock().unwrap();
            match credentials.get(emp_id) {
                None => return Err(
                    "Employee ID not found. Please contact your admin.".to_string()
                ),
                Some(cred) => cred.password_hash.clone(),
            }
        };

        // Verify password against hash
        let valid = verify(password, &password_hash)
            .map_err(|e| format!("Verification error: {}", e))?;

        if !valid {
            return Err("Incorrect password. Please try again.".to_string());
        }

        // Update last login timestamp
        {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("Time went backwards")
                .as_millis();

            let mut credentials = self.credentials.lock().unwrap();
            if let Some(cred) = credentials.get_mut(emp_id) {
                cred.last_login = Some(now);
            }
        }
        self.save_to_disk().ok();

        // Generate JWT token
        // Token expires in 8 hours
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs() as usize;

        let claims = Claims {
            emp_id:     emp_id.to_string(),
            department: department.to_string(),
            iat:        now_secs,
            exp:        now_secs + (8 * 60 * 60), // 8 hours
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        ).map_err(|e| format!("Token generation failed: {}", e))?;

        println!(
            "  ✅ Login successful for emp: {} ({})",
            emp_id, department
        );

        Ok(token)
    }

    // Verify a JWT token and extract claims
    pub fn verify_token(&self, token: &str) -> Result<Claims, String> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        ).map_err(|e| format!("Invalid token: {}", e))?;

        Ok(token_data.claims)
    }

    // Check if an account exists
    pub fn account_exists(&self, emp_id: &str) -> bool {
        let credentials = self.credentials.lock().unwrap();
        credentials.contains_key(emp_id)
    }
}