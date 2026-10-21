import { getDriver, getSession, closeDriver, verifyConnectivity } from '../config/neo4j.js';
import neo4j from 'neo4j-driver';

/**
 * AlumniConnect Neo4j Database Seed Script (DA3 Requirement #3)
 * Idempotently creates constraints, indexes, sample nodes, and relationships.
 * Safe to execute multiple times (MERGE statements preserve existing records).
 */

async function runSeed() {
  console.log('====================================================');
  console.log(' AlumniConnect — Neo4j Database Seeder (DBMS DA3)');
  console.log('====================================================\n');

  console.log('1. Verifying Neo4j Database Connectivity...');
  const conn = await verifyConnectivity();
  if (!conn.connected) {
    console.error('❌ Connection Failed:', conn.error);
    console.error('Please ensure Neo4j Desktop is running on port 7687 and check backend/.env');
    process.exit(1);
  }
  console.log(` Connected to Neo4j (${conn.agent}) at ${conn.uri}\n`);

  const session = getSession(neo4j.session.WRITE);

  try {
    console.log('2. Applying Constraints & Indexes...');
    const schemaQueries = [
      'CREATE CONSTRAINT alumni_name_unique IF NOT EXISTS FOR (a:Alumni) REQUIRE a.name IS UNIQUE',
      'CREATE CONSTRAINT company_name_unique IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE',
      'CREATE CONSTRAINT student_name_unique IF NOT EXISTS FOR (s:Student) REQUIRE s.name IS UNIQUE',
      'CREATE INDEX alumni_dept_idx IF NOT EXISTS FOR (a:Alumni) ON (a.department)',
      'CREATE INDEX alumni_grad_year_idx IF NOT EXISTS FOR (a:Alumni) ON (a.graduationYear)',
    ];

    for (const q of schemaQueries) {
      try {
        await session.run(q);
      } catch (err) {
        console.warn(`  - Notice on index/constraint: ${err.message}`);
      }
    }
    console.log(' Constraints and indexes established.\n');

    console.log('3. Seeding Sample Nodes & Relationships (Idempotent MERGE)...');
    
    // Seed Companies
    await session.run(`
      MERGE (c1:Company {name: 'Google'})
      ON CREATE SET c1.industry = 'Technology & Cloud', c1.location = 'Mountain View, CA / Bangalore'
      MERGE (c2:Company {name: 'Microsoft'})
      ON CREATE SET c2.industry = 'Enterprise Software & AI', c2.location = 'Redmond, WA / Hyderabad'
      MERGE (c3:Company {name: 'Amazon'})
      ON CREATE SET c3.industry = 'E-Commerce & AWS', c3.location = 'Seattle, WA / Chennai'
      MERGE (c4:Company {name: 'Apple'})
      ON CREATE SET c4.industry = 'Consumer Electronics & OS', c4.location = 'Cupertino, CA'
    `);
    console.log(' Company nodes verified.');

    // Seed Alumni (Preserving Arun Kumar & Priya Sharma, adding diverse years and depts)
    await session.run(`
      MERGE (a1:Alumni {name: 'Arun Kumar'})
      ON CREATE SET a1.department = 'CSE', a1.graduationYear = 2022, a1.company = 'Google'
      ON MATCH SET a1.department = 'CSE', a1.graduationYear = 2022, a1.company = 'Google'

      MERGE (a2:Alumni {name: 'Priya Sharma'})
      ON CREATE SET a2.department = 'CSE', a2.graduationYear = 2023, a2.company = 'Microsoft'
      ON MATCH SET a2.department = 'CSE', a2.graduationYear = 2023, a2.company = 'Microsoft'

      MERGE (a3:Alumni {name: 'Karthik Raja'})
      ON CREATE SET a3.department = 'ECE', a3.graduationYear = 2021, a3.company = 'Apple'
      ON MATCH SET a3.department = 'ECE', a3.graduationYear = 2021, a3.company = 'Apple'

      MERGE (a4:Alumni {name: 'Ananya Iyer'})
      ON CREATE SET a4.department = 'IT', a4.graduationYear = 2022, a4.company = 'Amazon'
      ON MATCH SET a4.department = 'IT', a4.graduationYear = 2022, a4.company = 'Amazon'

      MERGE (a5:Alumni {name: 'Vikram Seth'})
      ON CREATE SET a5.department = 'CSE', a5.graduationYear = 2020, a5.company = 'Google'
      ON MATCH SET a5.department = 'CSE', a5.graduationYear = 2020, a5.company = 'Google'
    `);
    console.log(' Alumni nodes verified.');

    // Seed WORKS_AT Relationships
    await session.run(`
      MATCH (a:Alumni {name: 'Arun Kumar'}), (c:Company {name: 'Google'}) MERGE (a)-[:WORKS_AT]->(c)
    `);
    await session.run(`
      MATCH (a:Alumni {name: 'Priya Sharma'}), (c:Company {name: 'Microsoft'}) MERGE (a)-[:WORKS_AT]->(c)
    `);
    await session.run(`
      MATCH (a:Alumni {name: 'Karthik Raja'}), (c:Company {name: 'Apple'}) MERGE (a)-[:WORKS_AT]->(c)
    `);
    await session.run(`
      MATCH (a:Alumni {name: 'Ananya Iyer'}), (c:Company {name: 'Amazon'}) MERGE (a)-[:WORKS_AT]->(c)
    `);
    await session.run(`
      MATCH (a:Alumni {name: 'Vikram Seth'}), (c:Company {name: 'Google'}) MERGE (a)-[:WORKS_AT]->(c)
    `);
    console.log(' WORKS_AT graph relationships verified.');

    // Seed Students & Mentorship Interests
    await session.run(`
      MERGE (s1:Student {name: 'Rahul'})
      ON CREATE SET s1.department = 'CSE', s1.year = 2
      ON MATCH SET s1.department = 'CSE', s1.year = 2

      MERGE (s2:Student {name: 'Sneha Patel'})
      ON CREATE SET s2.department = 'IT', s2.year = 3
      ON MATCH SET s2.department = 'IT', s2.year = 3
    `);
    await session.run(`
      MATCH (s:Student {name: 'Rahul'}), (c:Company {name: 'Google'}) MERGE (s)-[:INTERESTED_IN]->(c)
    `);
    await session.run(`
      MATCH (s:Student {name: 'Rahul'}), (a:Alumni {name: 'Arun Kumar'}) MERGE (s)-[:INTERESTED_IN]->(a)
    `);
    await session.run(`
      MATCH (s:Student {name: 'Sneha Patel'}), (a:Alumni {name: 'Priya Sharma'}) MERGE (s)-[:INTERESTED_IN]->(a)
    `);
    await session.run(`
      MATCH (s:Student {name: 'Sneha Patel'}), (a:Alumni {name: 'Ananya Iyer'}) MERGE (s)-[:INTERESTED_IN]->(a)
    `);
    console.log(' Student nodes and INTERESTED_IN graph relationships verified.\n');

    // 4. Summarize database contents
    const countRes = await session.run(`
      CALL { MATCH (a:Alumni) RETURN count(a) AS alumniCount }
      CALL { MATCH (c:Company) RETURN count(c) AS companyCount }
      CALL { MATCH (s:Student) RETURN count(s) AS studentCount }
      CALL { MATCH ()-[r]->() RETURN count(r) AS relCount }
      RETURN alumniCount, companyCount, studentCount, relCount
    `);

    const r = countRes.records[0];
    console.log('4. Live Database Verification Summary:');
    console.log(`   - Total Alumni Nodes:        ${r.get('alumniCount')}`);
    console.log(`   - Total Company Nodes:       ${r.get('companyCount')}`);
    console.log(`   - Total Student Nodes:       ${r.get('studentCount')}`);
    console.log(`   - Total Graph Relationships: ${r.get('relCount')}`);
    console.log('\n Seed completed successfully without data loss.');

  } catch (err) {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
  }
}

runSeed();
