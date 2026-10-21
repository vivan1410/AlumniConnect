import bcrypt from 'bcryptjs';
import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j.js';

/**
 * Migration Script: Assigns bcrypt password hashes to legacy seed accounts.
 * 
 * SAFETY NOTICE:
 * These credentials are strictly development-only fixtures for local college DBMS evaluation.
 * This script is guarded against execution in production or unconfirmed environments.
 * It will refuse to run unless explicitly confirmed with ALLOW_DEMO_PASSWORD_MIGRATION=true
 * or the --confirm-demo-seed flag in a non-production environment.
 */
const DEVELOPMENT_ONLY_DEMO_PASSWORDS = {
  'Arun Kumar': 'Arun@2026',
  'Priya Sharma': 'Priya@2026',
  'Rahul': 'Rahul@2026',
  'Sneha Patel': 'Sneha@2026',
  'Karthik Raja': 'Karthik@2026',
  'Ananya Iyer': 'Ananya@2026',
  'Vikram Seth': 'Vikram@2026',
};

async function migratePasswords() {
  console.log('====================================================');
  console.log(' AlumniConnect — Legacy Account Password Migration');
  console.log('====================================================\n');

  // Guard 1: Block execution in production environments
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SECURITY ERROR: Default seed password migration is strictly prohibited in production environments.');
    process.exit(1);
  }

  // Guard 2: Require explicit development confirmation
  const isExplicitlyAllowed =
    process.env.ALLOW_DEMO_PASSWORD_MIGRATION === 'true' ||
    process.argv.includes('--confirm-demo-seed');

  if (!isExplicitlyAllowed) {
    console.warn('⚠️  SAFETY GUARD: Default demo credentials can only be applied in a local academic development environment.');
    console.warn('To apply demo passwords for local DBMS evaluation, set ALLOW_DEMO_PASSWORD_MIGRATION=true in your environment or pass --confirm-demo-seed.');
    process.exit(1);
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    for (const [name, rawPassword] of Object.entries(DEVELOPMENT_ONLY_DEMO_PASSWORDS)) {
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      
      const query = `
        MATCH (u)
        WHERE (u:Student OR u:Alumni) AND u.name = $name
        SET u.passwordHash = $passwordHash,
            u.email = CASE 
              WHEN u.email IS NULL OR u.email = '' 
              THEN toLower(replace($name, ' ', '.')) + '@campus.edu'
              ELSE u.email 
            END
        RETURN elementId(u) AS id, u.name AS name, u.email AS email
      `;

      const result = await session.run(query, { name, passwordHash });
      if (result.records.length > 0) {
        const r = result.records[0];
        console.log(`✅ Set password for "${r.get('name')}" (${r.get('email')})`);
      } else {
        console.log(`ℹ️ Node "${name}" not found in Neo4j; skipping.`);
      }
    }

    console.log('\nMigration complete. All specified seed accounts now have secure bcrypt password hashes.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await session.close();
    await closeDriver();
  }
}

migratePasswords();
