/**
 * Automated Verification Suite for AlumniConnect Authentication Security
 * Tests:
 * 1. Health check & database connectivity
 * 2. Login with valid password succeeds and returns cryptographically signed JWT
 * 3. Login without password returns 400 Bad Request
 * 4. Login without email returns 400 Bad Request
 * 5. Login with incorrect password returns 401 Unauthorized (no JWT issued)
 * 6. Login for non-existent user returns 401 Unauthorized (no auto-creation)
 * 7. Existing account without password hash (Vivan Raj) blocked with 403 NO_PASSWORD_SET
 * 8. Never link or authenticate account by display name alone (mismatched email rejected with 401)
 * 9. Registration validation: password < 6 chars rejected with 400
 * 10. Registration succeeds with bcrypt password hashing (direct Neo4j verification: no plaintext password)
 * 11. Registration with duplicate email rejected with 409 Conflict
 * 12. Newly registered user logs in successfully with valid password
 * 13. Newly registered user rejected with wrong password
 * 14. Authenticated user can change password via /api/auth/set-password with valid JWT
 * 15. Secure password setup/reset token generation via /api/auth/request-password-reset
 * 16. Password reset completion via /api/auth/reset-password with token verification
 * 17. Single-use token enforcement: replay attempt rejected with 400 Bad Request
 * 18. Login with newly configured password succeeds
 * 19. Public directory endpoint (POST /api/alumni) never issues JWT and never overwrites passwordHash
 */

import assert from 'assert';
import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from './config/neo4j.js';

const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runAuthSecurityTests() {
  console.log('================================================================');
  console.log('STARTING ALUMNICONNECT AUTHENTICATION SECURITY TEST SUITE');
  console.log('================================================================\n');

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

  // 1. Health check
  await test('Backend health & Neo4j connectivity', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data?.database?.connected, true);
  });

  // 2. Valid password login (Arun Kumar)
  let arunToken;
  await test('Valid password login succeeds with 200 and issues JWT', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arun.kumar@alumni.edu',
        password: 'Arun@2026',
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data?.token, 'Must return session JWT');
    assert.strictEqual(res.data.data.email, 'arun.kumar@alumni.edu');
    assert.strictEqual(res.data.data.passwordHash, undefined, 'passwordHash must never be exposed');
    arunToken = res.data.data.token;
  });

  // 3. Login without password rejected
  await test('Login without password rejected with 400 Bad Request', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arun.kumar@alumni.edu',
      }),
    });
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert(res.data.error.includes('Password is required'), `Unexpected error: ${res.data.error}`);
  });

  // 4. Login without email rejected
  await test('Login without email rejected with 400 Bad Request', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        password: 'AnyPassword@123',
      }),
    });
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert(res.data.error.includes('email is required'), `Unexpected error: ${res.data.error}`);
  });

  // 5. Incorrect password rejected
  await test('Login with incorrect password rejected with 401 Unauthorized', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arun.kumar@alumni.edu',
        password: 'WrongPassword#123',
      }),
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.data?.token, undefined, 'Must not issue JWT for wrong password');
  });

  // 6. Unknown user rejected
  await test('Login for non-existent user rejected with 401 (no auto-creation)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent.user.999@campus.edu',
        password: 'AnyPassword@123',
      }),
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.data?.token, undefined, 'Must not issue JWT for unknown user');
  });

  // 7. Existing account without password hash (test.user.nopass@example.com)
  await test('Existing account without password hash blocked with 403 NO_PASSWORD_SET', async () => {
    // Ensure test fixture student node exists without passwordHash
    const fixtureSession = getSession(neo4j.session.WRITE);
    try {
      await fixtureSession.run(`
        MERGE (s:Student {email: 'test.user.nopass@example.com'})
        ON CREATE SET s.name = 'Test NoPass User', s.department = 'CSE', s.year = 2, s.createdAt = datetime()
        ON MATCH SET s.passwordHash = null
      `);
    } finally {
      await fixtureSession.close();
    }

    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test.user.nopass@example.com',
        password: 'SomeRandomPassword123',
      }),
    });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.code, 'NO_PASSWORD_SET');
    assert.strictEqual(res.data.data?.token, undefined, 'Must not issue JWT for passwordless account');
  });

  // 8. Never link or authenticate account based on display name alone
  await test('Login with mismatched email and display name fails (no name-only claiming)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'imposter.email@attacker.com',
        name: 'Arun Kumar',
        password: 'Arun@2026',
      }),
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.data?.token, undefined, 'Must never authenticate by display name');
  });

  // 9. Registration validation
  const testRegEmail = `test.student.${Date.now()}@campus.edu`;
  const testRegName = `Test Student ${Date.now() % 1000}`;
  const testRegPass = 'SecurePass@2026';

  await test('Registration rejected if password is under 6 characters', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: testRegName,
        email: testRegEmail,
        password: '123',
        role: 'Student',
        department: 'CSE',
      }),
    });
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
  });

  // 10. Secure registration with bcrypt hashing
  let newStudentToken;
  await test('Registration succeeds with bcrypt password hashing', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: testRegName,
        email: testRegEmail,
        password: testRegPass,
        role: 'Student',
        department: 'CSE',
      }),
    });
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data?.token, 'Must return JWT token on registration');
    assert.strictEqual(res.data.data.passwordHash, undefined, 'passwordHash must never be exposed');
    newStudentToken = res.data.data.token;

    // Verify Neo4j directly: plaintext password must NOT exist, bcrypt hash must exist
    const session = getSession();
    try {
      const dbCheck = await session.run(
        'MATCH (s:Student {email: $email}) RETURN s.passwordHash AS hash, properties(s) AS props',
        { email: testRegEmail }
      );
      assert.strictEqual(dbCheck.records.length, 1, 'Node must exist in Neo4j');
      const hash = dbCheck.records[0].get('hash');
      const props = dbCheck.records[0].get('props');
      assert(typeof hash === 'string' && hash.startsWith('$2'), 'Hash must be a valid bcrypt string');
      assert.strictEqual(props.password, undefined, 'Plaintext password must NEVER be saved in Neo4j');
    } finally {
      await session.close();
    }
  });

  // 11. Duplicate registration rejected
  await test('Registration with existing email rejected with 409 Conflict', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: testRegName,
        email: testRegEmail,
        password: 'AnotherPass@2026',
        role: 'Student',
        department: 'CSE',
      }),
    });
    assert.strictEqual(res.status, 409, `Expected 409, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
  });

  // 12. Newly registered user logs in with valid password
  await test('Newly registered user logs in successfully with valid password', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testRegEmail,
        password: testRegPass,
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data?.token, 'Must return JWT');
  });

  // 13. Newly registered user rejected with wrong password
  await test('Newly registered user login rejected with wrong password', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testRegEmail,
        password: 'IncorrectPassword#999',
      }),
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
  });

  // 14. Authenticated password change
  await test('Authenticated user can change password via /api/auth/set-password', async () => {
    const res = await request('/api/auth/set-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newStudentToken}` },
      body: JSON.stringify({
        password: 'UpdatedPass@2026',
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);

    // Verify subsequent login with new password succeeds
    const loginNew = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testRegEmail,
        password: 'UpdatedPass@2026',
      }),
    });
    assert.strictEqual(loginNew.status, 200, 'Login with updated password should succeed');

    // Old password should now fail
    const loginOld = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testRegEmail,
        password: testRegPass,
      }),
    });
    assert.strictEqual(loginOld.status, 401, 'Login with old password should fail');
  });

  // 15. Password setup / reset request for unmigrated account
  let resetToken;
  const testResetEmail = 'test.reset.user@example.com';
  await test('Password reset request generates secure single-use token', async () => {
    // Ensure synthetic test reset user exists without a password
    const resetFixtureSession = getSession(neo4j.session.WRITE);
    try {
      await resetFixtureSession.run(`
        MERGE (s:Student {email: $email})
        ON CREATE SET s.name = 'Test Reset User', s.department = 'CSE', s.year = 2, s.createdAt = datetime()
        ON MATCH SET s.passwordHash = null, s.resetTokenHash = null, s.resetTokenExpiry = null
      `, { email: testResetEmail });
    } finally {
      await resetFixtureSession.close();
    }

    const res = await request('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: testResetEmail }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.resetToken, 'Must generate reset token');
    resetToken = res.data.resetToken;
  });

  // 16. Invalid reset token rejected
  await test('Invalid reset token rejected with 400 Bad Request', async () => {
    const res = await request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: 'invalid-fake-token-12345',
        password: 'NewResetPass@2026',
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  // 17. Valid password reset succeeds and clears token (anti-replay)
  await test('Valid password reset succeeds and invalidates token for replay', async () => {
    const res = await request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: resetToken,
        password: 'NewResetPass@2026',
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    // Replay attempt with same token must fail
    const replay = await request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: resetToken,
        password: 'AnotherPass@2026',
      }),
    });
    assert.strictEqual(replay.status, 400, 'Reusing a reset token must be rejected');
    assert.strictEqual(replay.data.success, false);
  });

  // 18. Login with newly reset password succeeds
  await test('Login with newly reset password succeeds', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testResetEmail,
        password: 'NewResetPass@2026',
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data?.token, 'Must return JWT token');
  });

  // 19. Public directory endpoint (POST /api/alumni) never issues JWT and never overwrites passwordHash
  await test('POST /api/alumni does not issue JWT and does not overwrite existing passwordHash', async () => {
    const res = await request('/api/alumni', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Arun Kumar',
        company: 'Google',
        department: 'CSE',
        graduationYear: 2022,
        email: 'arun.kumar@alumni.edu',
        role: 'Alumni',
      }),
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data?.token, undefined, 'Directory endpoint must never issue JWT session token');

    // Verify Arun Kumar's original password still works
    const arunCheck = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'arun.kumar@alumni.edu',
        password: 'Arun@2026',
      }),
    });
    assert.strictEqual(arunCheck.status, 200, 'Original password must remain intact');
  });

  console.log('\n================================================================');
  console.log(`AUTH SECURITY TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
}).finally(() => {
  closeDriver();
});
