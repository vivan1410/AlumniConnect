/**
 * Automated Technical Verification Suite for AlumniConnect (DBMS DA3)
 * Tests all core operations, parameterized Cypher queries, filters, and write persistence.
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log('========================================================');
  console.log(' AlumniConnect Automated DA3 Verification Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL (${err.message})`);
      failed++;
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  // 1. Healthcheck & Neo4j Connectivity
  await test('GET /api/health (Database Connectivity)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.status === 'healthy', 'Expected status: healthy');
    assert(data.database?.connected === true, 'Neo4j is not connected');
  });

  // 2. Platform Statistics
  await test('GET /api/stats (Platform Totals)', async () => {
    const res = await fetch(`${BASE_URL}/api/stats`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(json.data.totalAlumni >= 2, `Expected >= 2 alumni, got ${json.data.totalAlumni}`);
    assert(json.data.totalCompanies >= 2, `Expected >= 2 companies, got ${json.data.totalCompanies}`);
  });

  // 3. Alumni Directory All
  await test('GET /api/alumni (Retrieve Verified Records)', async () => {
    const res = await fetch(`${BASE_URL}/api/alumni`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(Array.isArray(json.data) && json.data.length >= 2, 'No alumni returned');
  });

  // 4. Graduation Year 2022 Filter Inconsistency Verification
  await test('GET /api/alumni?graduationYear=2022 (Strict Year Filter)', async () => {
    const res = await fetch(`${BASE_URL}/api/alumni?graduationYear=2022`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(json.data.length > 0, 'No 2022 alumni returned');
    // Ensure NO alumni with graduationYear !== 2022 are returned!
    const non2022 = json.data.filter((a) => a.graduationYear !== 2022);
    assert(non2022.length === 0, `Found alumni with incorrect graduation year: ${JSON.stringify(non2022.map(a => ({ name: a.name, year: a.graduationYear })))}`);
  });

  // 5. Graduation Year 2023 Filter Inconsistency Verification
  await test('GET /api/alumni?graduationYear=2023 (Strict Year Filter)', async () => {
    const res = await fetch(`${BASE_URL}/api/alumni?graduationYear=2023`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(json.data.length > 0, 'No 2023 alumni returned');
    const non2023 = json.data.filter((a) => a.graduationYear !== 2023);
    assert(non2023.length === 0, `Found alumni with incorrect graduation year: ${JSON.stringify(non2023.map(a => ({ name: a.name, year: a.graduationYear })))}`);
  });

  // 6. Search Query including year string
  await test('GET /api/alumni/search?q=2022 (Search Keyword Matching Year)', async () => {
    const res = await fetch(`${BASE_URL}/api/alumni/search?q=2022`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(json.data.length > 0, 'Searching for 2022 returned 0 records');
    const matched = json.data.find((a) => a.graduationYear === 2022);
    assert(matched, 'Expected alumni from 2022 in results');
  });

  // 7. Company Filtering
  await test('GET /api/alumni?company=Google (Company-Specific Filter)', async () => {
    const res = await fetch(`${BASE_URL}/api/alumni?company=Google`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    const nonGoogle = json.data.filter((a) => a.company !== 'Google');
    assert(nonGoogle.length === 0, 'Returned non-Google alumni');
  });

  // 8. Companies Directory & Rosters
  await test('GET /api/companies (Company Aggregations)', async () => {
    const res = await fetch(`${BASE_URL}/api/companies`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(json.data.length >= 2, 'Expected companies');
    const google = json.data.find((c) => c.name === 'Google');
    assert(google && google.alumniCount >= 1, 'Google company alumni count incorrect');
  });

  // 9. Network Graph Data
  await test('GET /api/stats/graph (Nodes & Directed Links)', async () => {
    const res = await fetch(`${BASE_URL}/api/stats/graph`);
    const json = await res.json();
    assert(json.success === true, 'API failed');
    assert(Array.isArray(json.data.nodes) && json.data.nodes.length >= 3, 'Insufficient graph nodes');
    assert(Array.isArray(json.data.links) && json.data.links.length >= 2, 'Insufficient graph relationships');
  });

  // 10. Write Operation Persistence (POST /api/alumni)
  await test('POST /api/alumni (Persist New Record to Neo4j)', async () => {
    const testAlumni = {
      name: 'Verification Bot Test',
      department: 'CSE',
      graduationYear: 2024,
      company: 'Google',
      email: 'testbot@college.edu',
      role: 'Alumni',
    };
    const res = await fetch(`${BASE_URL}/api/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testAlumni),
    });
    assert(res.status === 201, `Expected status 201, got ${res.status}`);
    const json = await res.json();
    assert(json.success === true, 'Persistence failed');
    assert(json.data.name === 'Verification Bot Test', 'Node name mismatch');

    // Verify it is immediately retrievable via search
    const verifyRes = await fetch(`${BASE_URL}/api/alumni?q=Verification+Bot+Test`);
    const verifyJson = await verifyRes.json();
    assert(verifyJson.data.some((a) => a.name === 'Verification Bot Test'), 'Persisted record not found via query');
  });

  // 11. Write Relationship Persistence (POST /api/alumni/:id/interest)
  await test('POST /api/alumni/:id/interest (Persist :INTERESTED_IN Relationship)', async () => {
    const res = await fetch(`${BASE_URL}/api/alumni/Arun%20Kumar/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: 'Rahul',
        studentDept: 'CSE',
        studentYear: 2,
        message: 'Automated test interest message',
      }),
    });
    assert(res.status === 201, `Expected status 201, got ${res.status}`);
    const json = await res.json();
    assert(json.success === true, 'Failed to create interest relationship');
    assert(json.data.relationship === 'INTERESTED_IN', 'Relationship type mismatch');
  });

  console.log('\n========================================================');
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
