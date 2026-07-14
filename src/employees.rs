// employees.rs
// Employee registry — stores employee IDs, names, and departments
// Think of this as the HR database of who works where

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
// HashMap = a lookup table
// like a dictionary: "0001" → Employee { name: "Priya", department: "HR" }

// ─────────────────────────────────────────────
// Department Enum
// Only these departments exist in the system
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
// Debug = can be printed for debugging
// PartialEq = can be compared with == operator
pub enum Department {
    HR,
    Finance,
    Legal,
    Engineering,
    CEO,  // CEO sees everything, always
}

impl Department {
    // Convert a string like "HR" into a Department enum
    // Called when someone sends their department as text
    pub fn from_str(s: &str) -> Option<Department> {
        match s.to_uppercase().as_str() {
            "HR" => Some(Department::HR),
            "FINANCE" => Some(Department::Finance),
            "LEGAL" => Some(Department::Legal),
            "ENGINEERING" => Some(Department::Engineering),
            "CEO" => Some(Department::CEO),
            _ => None,  // None = not found, invalid department
        }
    }

    // Convert Department enum back to a string
    // Called when we want to display or store it
    pub fn to_str(&self) -> &str {
        match self {
            Department::HR => "HR",
            Department::Finance => "Finance",
            Department::Legal => "Legal",
            Department::Engineering => "Engineering",
            Department::CEO => "CEO",
        }
    }
}

// ─────────────────────────────────────────────
// Employee Struct
// One employee record
// ─────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Employee {
    pub emp_id: String,        // "0001"
    pub name: String,          // "Priya Sharma"
    pub department: Department, // HR, Finance etc
    pub role: String,          // "HR Manager", "Finance Assistant" etc
}

// ─────────────────────────────────────────────
// Employee Registry
// Holds ALL employees in the system
// ─────────────────────────────────────────────

pub struct EmployeeRegistry {
    // HashMap<String, Employee> = lookup table
    // key = emp_id ("0001")
    // value = the Employee record
    employees: HashMap<String, Employee>,
}

impl EmployeeRegistry {

    // Create registry with hardcoded demo employees
    // In production this would load from a database
    pub fn new() -> Self {
        let mut employees = HashMap::new();

        // Helper closure to add employees cleanly
        // A closure is like a mini function defined inline
        let mut add = |id: &str, name: &str, dept: Department, role: &str| {
            employees.insert(id.to_string(), Employee {
                emp_id: id.to_string(),
                name: name.to_string(),
                department: dept,
                role: role.to_string(),
            });
        };

        // ── Demo Employees ───────────────────
        // CEO — sees everything
        add("0000", "Aakanksha",      Department::CEO,         "CEO & Founder");

        // HR Department
        add("0001", "Priya Sharma",   Department::HR,          "HR Manager");
        add("0002", "Rahul Verma",    Department::HR,          "HR Assistant");

        // Finance Department
        add("0003", "Sneha Patil",    Department::Finance,     "Finance Manager");
        add("0004", "Amit Kumar",     Department::Finance,     "Finance Assistant");

        // Legal Department
        add("0005", "Vikram Mehta",   Department::Legal,       "Legal Manager");
        add("0006", "Pooja Singh",    Department::Legal,       "Legal Assistant");

        // Engineering Department
        add("0007", "Arjun Nair",     Department::Engineering, "Lead Engineer");
        add("0008", "Divya Reddy",    Department::Engineering, "Backend Engineer");

        println!("👥 Employee Registry loaded with {} employees", employees.len());

        EmployeeRegistry { employees }
    }

    // Look up an employee by their ID
    // Returns None if employee not found
    pub fn get_employee(&self, emp_id: &str) -> Option<&Employee> {
        self.employees.get(emp_id)
    }

    // Check if an employee can access a document
    // from a specific department
    pub fn can_access(&self, emp_id: &str, doc_department: &Department) -> bool {
        match self.get_employee(emp_id) {
            // Employee not found = no access
            None => false,

            Some(employee) => {
                // CEO can access EVERYTHING
                if employee.department == Department::CEO {
                    return true;
                }

                // Everyone else can only access their OWN department
                &employee.department == doc_department
            }
        }
    }

    // Get all employees (for admin dashboard later)
    pub fn get_all_employees(&self) -> Vec<&Employee> {
        self.employees.values().collect()
    }
}