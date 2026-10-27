import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.NEO4J_URI || 'neo4j://127.0.0.1:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || '';
const database = process.env.NEO4J_DATABASE || 'neo4j';

// In cloud deployment (e.g. Vercel), 127.0.0.1 cannot reach the developer laptop without a tunnel.
// Detecting this immediately avoids 5000ms TCP socket hangs and makes all API responses instant.
const isLocalInCloud =
  Boolean(process.env.VERCEL) &&
  (uri.includes('127.0.0.1') || uri.includes('localhost'));

let driver = null;

export function getDriver() {
  if (isLocalInCloud) {
    throw new Error('Local Neo4j 127.0.0.1 is unreachable from Vercel cloud without a tunnel.');
  }

  if (!driver) {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      disableLosslessIntegers: true, // Converts Neo4j Integers automatically to JavaScript numbers
      maxConnectionPoolSize: 25,
      connectionTimeout: 2000,
    });
  }
  return driver;
}

/**
 * Creates and returns a new session for the configured database.
 */
export function getSession(mode = neo4j.session.READ) {
  if (isLocalInCloud) {
    throw new Error('Local Neo4j 127.0.0.1 is unreachable from Vercel cloud without a tunnel.');
  }
  const currentDriver = getDriver();
  return currentDriver.session({
    database,
    defaultAccessMode: mode,
  });
}

/**
 * Verifies connectivity to the Neo4j instance.
 * Returns detailed status information.
 */
export async function verifyConnectivity() {
  if (isLocalInCloud) {
    return {
      connected: false,
      uri,
      user,
      database,
      error: 'Neo4j local URI (127.0.0.1) cannot be reached from Vercel cloud. Presentation fallback data active.',
      code: 'LOCAL_IP_IN_CLOUD',
    };
  }

  try {
    const currentDriver = getDriver();
    const serverInfo = await currentDriver.getServerInfo();
    return {
      connected: true,
      uri,
      user,
      database,
      agent: serverInfo.agent,
      protocolVersion: serverInfo.protocolVersion,
      address: serverInfo.address,
    };
  } catch (error) {
    return {
      connected: false,
      uri,
      user,
      database,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Closes the Neo4j driver on server shutdown.
 */
export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Safely converts any remaining Neo4j types (like Neo4j Integers or temporal DateTimes)
 * to standard JS primitives and ISO 8601 strings.
 */
export function sanitizeNeo4jValue(val) {
  if (val === null || val === undefined) return val;
  if (neo4j.isInt(val)) return val.toNumber();
  if (val instanceof Date) return val.toISOString();
  if (
    neo4j.isDateTime(val) ||
    neo4j.isDate(val) ||
    neo4j.isLocalDateTime(val) ||
    neo4j.isTime(val) ||
    neo4j.isLocalTime(val) ||
    neo4j.isDuration(val)
  ) {
    if (typeof val.toStandardDate === 'function') {
      try {
        return val.toStandardDate().toISOString();
      } catch {
        return val.toString();
      }
    }
    return val.toString();
  }
  if (Array.isArray(val)) return val.map(sanitizeNeo4jValue);
  if (typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeNeo4jValue(v);
    }
    return res;
  }
  return val;
}
