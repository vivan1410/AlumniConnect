// ==============================================================================
// AlumniConnect — Neo4j Graph Schema & Sample Dataset Seed Script
// College DBMS DA3 Modern Database Technology Demonstration
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. CONSTRAINTS & INDEXES
// Ensures data integrity and fast index-free adjacency graph lookups
// ------------------------------------------------------------------------------
CREATE CONSTRAINT alumni_name_unique IF NOT EXISTS
FOR (a:Alumni) REQUIRE a.name IS UNIQUE;

CREATE CONSTRAINT company_name_unique IF NOT EXISTS
FOR (c:Company) REQUIRE c.name IS UNIQUE;

CREATE CONSTRAINT student_name_unique IF NOT EXISTS
FOR (s:Student) REQUIRE s.name IS UNIQUE;

CREATE INDEX alumni_dept_idx IF NOT EXISTS
FOR (a:Alumni) ON (a.department);

CREATE INDEX alumni_grad_year_idx IF NOT EXISTS
FOR (a:Alumni) ON (a.graduationYear);

// ------------------------------------------------------------------------------
// 2. COMPANIES
// ------------------------------------------------------------------------------
MERGE (c1:Company {name: 'Google'})
ON CREATE SET c1.industry = 'Technology & Cloud', c1.location = 'Mountain View, CA / Bangalore';

MERGE (c2:Company {name: 'Microsoft'})
ON CREATE SET c2.industry = 'Enterprise Software & AI', c2.location = 'Redmond, WA / Hyderabad';

MERGE (c3:Company {name: 'Amazon'})
ON CREATE SET c3.industry = 'E-Commerce & AWS', c3.location = 'Seattle, WA / Chennai';

MERGE (c4:Company {name: 'Apple'})
ON CREATE SET c4.industry = 'Consumer Electronics & OS', c4.location = 'Cupertino, CA';

// ------------------------------------------------------------------------------
// 3. ALUMNI & WORKS_AT RELATIONSHIPS
// Preserves existing database records (Arun Kumar, Priya Sharma) and adds
// diverse departments and graduation years for query demonstration.
// ------------------------------------------------------------------------------
MERGE (a1:Alumni {name: 'Arun Kumar'})
ON CREATE SET a1.department = 'CSE', a1.graduationYear = 2022, a1.company = 'Google'
ON MATCH SET a1.department = 'CSE', a1.graduationYear = 2022, a1.company = 'Google';

MERGE (a2:Alumni {name: 'Priya Sharma'})
ON CREATE SET a2.department = 'CSE', a2.graduationYear = 2023, a2.company = 'Microsoft'
ON MATCH SET a2.department = 'CSE', a2.graduationYear = 2023, a2.company = 'Microsoft';

MERGE (a3:Alumni {name: 'Karthik Raja'})
ON CREATE SET a3.department = 'ECE', a3.graduationYear = 2021, a3.company = 'Apple'
ON MATCH SET a3.department = 'ECE', a3.graduationYear = 2021, a3.company = 'Apple';

MERGE (a4:Alumni {name: 'Ananya Iyer'})
ON CREATE SET a4.department = 'IT', a4.graduationYear = 2022, a4.company = 'Amazon'
ON MATCH SET a4.department = 'IT', a4.graduationYear = 2022, a4.company = 'Amazon';

MERGE (a5:Alumni {name: 'Vikram Seth'})
ON CREATE SET a5.department = 'CSE', a5.graduationYear = 2020, a5.company = 'Google'
ON MATCH SET a5.department = 'CSE', a5.graduationYear = 2020, a5.company = 'Google';

// Connect Alumni to Companies via WORKS_AT
MATCH (a:Alumni {name: 'Arun Kumar'}), (c:Company {name: 'Google'})
MERGE (a)-[:WORKS_AT]->(c);

MATCH (a:Alumni {name: 'Priya Sharma'}), (c:Company {name: 'Microsoft'})
MERGE (a)-[:WORKS_AT]->(c);

MATCH (a:Alumni {name: 'Karthik Raja'}), (c:Company {name: 'Apple'})
MERGE (a)-[:WORKS_AT]->(c);

MATCH (a:Alumni {name: 'Ananya Iyer'}), (c:Company {name: 'Amazon'})
MERGE (a)-[:WORKS_AT]->(c);

MATCH (a:Alumni {name: 'Vikram Seth'}), (c:Company {name: 'Google'})
MERGE (a)-[:WORKS_AT]->(c);

// ------------------------------------------------------------------------------
// 4. STUDENTS & INTERESTED_IN RELATIONSHIPS
// Preserves student Rahul and models mentorship connections
// ------------------------------------------------------------------------------
MERGE (s1:Student {name: 'Rahul'})
ON CREATE SET s1.department = 'CSE', s1.year = 2
ON MATCH SET s1.department = 'CSE', s1.year = 2;

MERGE (s2:Student {name: 'Sneha Patel'})
ON CREATE SET s2.department = 'IT', s2.year = 3
ON MATCH SET s2.department = 'IT', s2.year = 3;

// Connect Students to Alumni / Companies via INTERESTED_IN
MATCH (s:Student {name: 'Rahul'}), (c:Company {name: 'Google'})
MERGE (s)-[:INTERESTED_IN]->(c);

MATCH (s:Student {name: 'Rahul'}), (a:Alumni {name: 'Arun Kumar'})
MERGE (s)-[:INTERESTED_IN]->(a);

MATCH (s:Student {name: 'Sneha Patel'}), (a:Alumni {name: 'Priya Sharma'})
MERGE (s)-[:INTERESTED_IN]->(a);

MATCH (s:Student {name: 'Sneha Patel'}), (a:Alumni {name: 'Ananya Iyer'})
MERGE (s)-[:INTERESTED_IN]->(a);

// ------------------------------------------------------------------------------
// 5. CORE DA3 VERIFICATION QUERIES (FOR FACULTY DEMO)
// ------------------------------------------------------------------------------

// Query 1: Find all alumni who graduated in 2022 working in tech
// MATCH (a:Alumni)-[:WORKS_AT]->(c:Company)
// WHERE a.graduationYear = 2022
// RETURN a.name, a.department, c.name AS company;

// Query 2: Find all alumni colleagues at Google
// MATCH (a1:Alumni)-[:WORKS_AT]->(c:Company {name: 'Google'})<-[:WORKS_AT]-(a2:Alumni)
// WHERE elementId(a1) < elementId(a2)
// RETURN a1.name AS Alumni1, a2.name AS Alumni2, c.name AS Company;

// Query 3: Multi-hop graph recommendation - Find students interested in alumni through company affiliation
// MATCH (s:Student)-[:INTERESTED_IN]->(c:Company)<-[:WORKS_AT]-(a:Alumni)
// RETURN s.name AS Student, a.name AS PotentialMentor, c.name AS SharedCompany;
