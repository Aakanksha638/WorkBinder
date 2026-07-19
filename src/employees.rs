// employees.rs
// Employee registry with dynamic add support
// Persists to disk so new employees survive restarts

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::fs;

// ─────────────────────────────────────────────
// Department Enum
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum Department {
    HR,
    Finance,
    Legal,
    Engineering,
    CEO,
}

impl Department {
    pub fn from_str(s: &str) -> Option<Department> {
        match s.to_uppercase().as_str() {
            "HR"          => Some(Department::HR),
            "FINANCE"     => Some(Department::Finance),
            "LEGAL"       => Some(Department::Legal),
            "ENGINEERING" => Some(Department::Engineering),
            "CEO"         => Some(Department::CEO),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            Department::HR          => "HR",
            Department::Finance     => "Finance",
            Department::Legal       => "Legal",
            Department::Engineering => "Engineering",
            Department::CEO         => "CEO",
        }
    }
}

// ─────────────────────────────────────────────
// Employee Struct
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Employee {
    pub emp_id:     String,
    pub name:       String,
    pub department: Department,
    pub role:       String,
    pub is_active:  bool,       // can be deactivated by CEO
    pub created_at: u128,       // when they were added
}

// ─────────────────────────────────────────────
// Employee Registry
// ─────────────────────────────────────────────

pub struct EmployeeRegistry {
    employees: Mutex<HashMap<String, Employee>>,
    file_path: String,
}

impl EmployeeRegistry {

    // Create registry with default employees
    // Also loads any previously added employees from disk
    pub fn new(file_path: &str) -> Self {
        println!("👥 Loading employee registry...");

        // Start with default employees
        let mut default_employees = HashMap::new();

        let defaults = vec![
            ("0000", "Aakanksha",    Department::CEO,         "CEO & Founder"),
            ("0001", "Priya Sharma", Department::HR,          "HR Manager"),
            ("0002", "Rahul Verma",  Department::HR,          "HR Assistant"),
            ("0003", "Sneha Patil",  Department::Finance,     "Finance Manager"),
            ("0004", "Amit Kumar",   Department::Finance,     "Finance Assistant"),
            ("0005", "Vikram Mehta", Department::Legal,       "Legal Manager"),
            ("0006", "Pooja Singh",  Department::Legal,       "Legal Assistant"),
            ("0007", "Arjun Nair",   Department::Engineering, "Lead Engineer"),
            ("0008", "Divya Reddy",  Department::Engineering, "Backend Engineer"),
        ];

        for (id, name, dept, role) in defaults {
            default_employees.insert(id.to_string(), Employee {
                emp_id:     id.to_string(),
                name:       name.to_string(),
                department: dept,
                role:       role.to_string(),
                is_active:  true,
                created_at: 0, // default employees have no timestamp
            });
        }

        // Load any dynamically added employees from disk
        // and merge them with defaults
        if let Ok(json) = fs::read_to_string(file_path) {
            if let Ok(saved) = serde_json::from_str::<HashMap<String, Employee>>(&json) {
                for (id, emp) in saved {
                    // Only add if not already in defaults
                    // (prevents overwriting default employees)
                    if !default_employees.contains_key(&id) {
                        default_employees.insert(id, emp);
                    }
                }
            }
        }

        println!(
            "  ✅ Registry loaded with {} employees",
            default_employees.len()
        );

        EmployeeRegistry {
            employees: Mutex::new(default_employees),
            file_path: file_path.to_string(),
        }
    }

    // Save registry to disk
    fn save_to_disk(&self) -> Result<(), String> {
        let employees = self.employees.lock().unwrap();
        let json = serde_json::to_string_pretty(&*employees)
            .map_err(|e| format!("Serialize failed: {}", e))?;
        fs::write(&self.file_path, json)
            .map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    // Look up employee by ID
    pub fn get_employee(&self, emp_id: &str) -> Option<Employee> {
        let employees = self.employees.lock().unwrap();
        employees.get(emp_id).cloned()
    }

    // Check if employee can access a department's documents
    pub fn can_access(&self, emp_id: &str, doc_department: &Department) -> bool {
        match self.get_employee(emp_id) {
            None => false,
            Some(emp) => {
                if !emp.is_active { return false; }
                if emp.department == Department::CEO { return true; }
                &emp.department == doc_department
            }
        }
    }

    // Add a new employee (CEO only action)
    pub fn add_employee(
        &self,
        emp_id: String,
        name: String,
        department: Department,
        role: String,
        timestamp: u128,
    ) -> Result<(), String> {

        {
            let mut employees = self.employees.lock().unwrap();

            // Check if ID already exists
            if employees.contains_key(&emp_id) {
                return Err(format!(
                    "Employee ID '{}' already exists", emp_id
                ));
            }

            employees.insert(emp_id.clone(), Employee {
                emp_id,
                name,
                department,
                role,
                is_active: true,
                created_at: timestamp,
            });
        }

        self.save_to_disk()
            .map_err(|e| format!("Save failed: {}", e))?;

        Ok(())
    }

    // Deactivate an employee (soft delete)
    pub fn deactivate_employee(&self, emp_id: &str) -> Result<(), String> {
        let mut employees = self.employees.lock().unwrap();

        match employees.get_mut(emp_id) {
            None => Err(format!("Employee '{}' not found", emp_id)),
            Some(emp) => {
                emp.is_active = false;
                drop(employees);
                self.save_to_disk()
            }
        }
    }

    // Get ALL employees as a list
    pub fn get_all_employees(&self) -> Vec<Employee> {
        let employees = self.employees.lock().unwrap();
        let mut list: Vec<Employee> = employees.values().cloned().collect();
        // Sort by emp_id so display is consistent
        list.sort_by(|a, b| a.emp_id.cmp(&b.emp_id));
        list
    }

    // Get employees by department
    pub fn get_by_department(&self, dept: &str) -> Vec<Employee> {
        let employees = self.employees.lock().unwrap();
        employees.values()
            .filter(|e| e.department.to_str() == dept && e.is_active)
            .cloned()
            .collect()
    }

    // Get total count
    pub fn count(&self) -> usize {
        self.employees.lock().unwrap().len()
    }
}