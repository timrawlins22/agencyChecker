-- Create Agents table
CREATE TABLE IF NOT EXISTS agents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Argon2 hash
    tenant_id VARCHAR(50),
    external_id VARCHAR(50),
    role VARCHAR(50) DEFAULT 'agent',
    email VARCHAR(255),
    name VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    webhook_url VARCHAR(255),
    max_leads_per_day INT DEFAULT 0,
    max_leads_per_week INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Agent States (many-to-many relationship usually, but here simplified as per usage)
CREATE TABLE IF NOT EXISTS agent_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    state VARCHAR(2) NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Create Agent Companies (Link table for enabled carriers)
CREATE TABLE IF NOT EXISTS agent_companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    agent_company_id VARCHAR(100), -- Internal ID for the agent at the carrier
    is_enabled BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(company_id),
    UNIQUE KEY unique_agent_company (agent_id, company_id)
);

-- Create Unified Policies table (Dashboard data)
CREATE TABLE IF NOT EXISTS unified_policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    policy_number VARCHAR(100) NOT NULL UNIQUE,
    carrier VARCHAR(100),
    agent_id INT NOT NULL,
    policy_status VARCHAR(100),
    product_type VARCHAR(100),
    product_name VARCHAR(255),
    insured_name VARCHAR(255),
    insured_birth DATE,
    owner_name VARCHAR(255),
    policy_face_amount DECIMAL(15, 2),
    premium DECIMAL(15, 2),
    billing_frequency VARCHAR(50),
    date_of_issue DATE,
    effective_date DATE,
    term_duration VARCHAR(50),
    payment_method VARCHAR(50),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Create Policy Alerts table
CREATE TABLE IF NOT EXISTS policy_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    policy_number VARCHAR(100),
    alert_type VARCHAR(100), -- e.g., 'LAPSE_WARNING', 'MISSED_PAYMENT'
    alert_status VARCHAR(50) DEFAULT 'ACTIVE',
    start_date DATE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Create Job Status table (for carrier sync jobs)
CREATE TABLE IF NOT EXISTS jobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    company_id VARCHAR(50), -- e.g., 'FORESTERS', 'AMERICO'
    agent_company_id INT, -- Link to specific agent-carrier record
    run_date DATE,
    status VARCHAR(50), -- 'SUCCESS', 'FAILED', 'MFA_WAIT', 'RUNNING', 'PENDING'
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    error_message TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Create Companies table (Carriers)
CREATE TABLE IF NOT EXISTS companies (
    company_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create Agent Carrier Credentials
CREATE TABLE IF NOT EXISTS agent_carrier_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    agent_company_id VARCHAR(100), -- The agent's ID with the carrier
    login_username_encrypted TEXT,
    login_password_encrypted TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- Pre-populate companies
INSERT IGNORE INTO companies (company_id, name) VALUES 
('FORESTERS', 'Foresters Financial'),
('AMERICO', 'Americo'),
('FANDG', 'F&G'),
('COREBRIDGE', 'Corebridge Financial');

-- Login Patterns (Recorded browser automation steps per company)
CREATE TABLE IF NOT EXISTS login_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_company_id VARCHAR(50) NOT NULL UNIQUE,
    pattern_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_company_id) REFERENCES companies(company_id)
);

-- Foresters Certificates (Raw data table, simplified based on usage)
CREATE TABLE IF NOT EXISTS foresters_certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT,
    CertificateNbr VARCHAR(100) UNIQUE,
    ActionNeeded VARCHAR(255),
    FirstName VARCHAR(100),
    LastName VARCHAR(100),
    City VARCHAR(100),
    State VARCHAR(100),
    ZIP VARCHAR(20),
    Email VARCHAR(255),
    Status VARCHAR(100),
    PlanDescription VARCHAR(255),
    FaceAmount DECIMAL(15, 2),
    PremiumTermination DATE,
    CoverageTermination DATE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);
