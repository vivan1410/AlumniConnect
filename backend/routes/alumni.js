import express from 'express';
import neo4j from 'neo4j-driver';
import { getSession, sanitizeNeo4jValue } from '../config/neo4j.js';

const router = express.Router();

/**
 * GET /api/alumni/search?q=...
 * Dedicated quick search endpoint
 */
router.get('/search', async (req, res) => {
  const { q = '' } = req.query;
  const session = getSession();

  try {
    const query = `
      MATCH (a:Alumni)
      OPTIONAL MATCH (a)-[:WORKS_AT]->(c:Company)
      WITH a, coalesce(c.name, a.company, '') AS companyName
      WHERE $q = ''
         OR toLower(coalesce(a.name, '')) CONTAINS toLower($q)
         OR toLower(companyName) CONTAINS toLower($q)
         OR toLower(coalesce(a.department, '')) CONTAINS toLower($q)
         OR ($q <> '' AND toString(a.graduationYear) CONTAINS $q)
      RETURN
        elementId(a) AS id,
        a.name AS name,
        companyName AS company,
        a.department AS department,
        a.graduationYear AS graduationYear,
        properties(a) AS properties
      ORDER BY a.name ASC
      LIMIT 50
    `;

    const result = await session.run(query, { q: q.trim() });
    const alumni = result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      company: record.get('company') || 'Not specified',
      department: record.get('department'),
      graduationYear: sanitizeNeo4jValue(record.get('graduationYear')),
      properties: sanitizeNeo4jValue(record.get('properties')),
    }));

    return res.json({
      success: true,
      count: alumni.length,
      query: q,
      data: alumni,
    });
  } catch (error) {
    console.error('Error searching alumni:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search alumni from database',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/alumni
 * Retrieve alumni with optional filters:
 * ?q=... &department=... &company=... &graduationYear=...
 */
router.get('/', async (req, res) => {
  const { q = '', department = '', company = '', graduationYear = '' } = req.query;
  const session = getSession();

  try {
    let yearParam = null;
    if (graduationYear && graduationYear !== 'all') {
      const parsed = parseInt(graduationYear, 10);
      yearParam = isNaN(parsed) ? graduationYear : parsed;
    }

    const query = `
      MATCH (a:Alumni)
      OPTIONAL MATCH (a)-[:WORKS_AT]->(c:Company)
      WITH a, c, coalesce(c.name, a.company, '') AS companyName
      WHERE ($q = ''
             OR toLower(coalesce(a.name, '')) CONTAINS toLower($q)
             OR toLower(companyName) CONTAINS toLower($q)
             OR toLower(coalesce(a.department, '')) CONTAINS toLower($q)
             OR ($q <> '' AND toString(a.graduationYear) CONTAINS $q))
        AND ($department = '' OR $department = 'all' OR toLower(coalesce(a.department, '')) = toLower($department))
        AND ($company = '' OR $company = 'all' OR toLower(companyName) = toLower($company))
        AND ($yearParam IS NULL OR a.graduationYear = $yearParam OR toString(a.graduationYear) = toString($yearParam))
      OPTIONAL MATCH (s:Student)-[:INTERESTED_IN]->(target)
      WHERE target = a OR target = c
      WITH a, companyName, count(DISTINCT s) AS interestedStudentsCount, collect(DISTINCT s.name) AS interestedStudentNames
      RETURN
        elementId(a) AS id,
        a.name AS name,
        companyName AS company,
        a.department AS department,
        a.graduationYear AS graduationYear,
        interestedStudentsCount,
        interestedStudentNames,
        properties(a) AS properties
      ORDER BY a.name ASC
    `;

    const result = await session.run(query, {
      q: q.trim(),
      department: department.trim(),
      company: company.trim(),
      yearParam,
    });

    const alumni = result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      company: record.get('company') || 'Not specified',
      department: record.get('department'),
      graduationYear: sanitizeNeo4jValue(record.get('graduationYear')),
      interestedStudentsCount: sanitizeNeo4jValue(record.get('interestedStudentsCount')),
      interestedStudentNames: record.get('interestedStudentNames').filter(Boolean),
      properties: sanitizeNeo4jValue(record.get('properties')),
    }));

    return res.json({
      success: true,
      count: alumni.length,
      data: alumni,
    });
  } catch (error) {
    console.error('Error fetching alumni:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alumni from Neo4j database',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/alumni/:id
 * Retrieve details for a single alumni by elementId or name
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const session = getSession();

  try {
    const query = `
      MATCH (a:Alumni)
      WHERE elementId(a) = $id OR a.name = $id
      OPTIONAL MATCH (a)-[:WORKS_AT]->(c:Company)
      OPTIONAL MATCH (s:Student)-[r:INTERESTED_IN]->(target)
      WHERE target = a OR target = c
      OPTIONAL MATCH (peer:Alumni)-[:WORKS_AT]->(c)
      WHERE elementId(peer) <> elementId(a)
      RETURN
        elementId(a) AS id,
        a.name AS name,
        coalesce(c.name, a.company, 'Not specified') AS company,
        c.name AS companyNodeName,
        properties(c) AS companyProperties,
        a.department AS department,
        a.graduationYear AS graduationYear,
        properties(a) AS properties,
        collect(DISTINCT {
          id: elementId(s),
          name: s.name,
          department: s.department,
          year: s.year
        }) AS interestedStudents,
        collect(DISTINCT {
          id: elementId(peer),
          name: peer.name,
          department: peer.department,
          graduationYear: peer.graduationYear
        }) AS colleagues
      LIMIT 1
    `;

    const result = await session.run(query, { id });

    if (result.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Alumni with identifier "${id}" not found in database`,
      });
    }

    const record = result.records[0];
    const interestedStudents = record.get('interestedStudents')
      .filter((s) => s.name)
      .map(sanitizeNeo4jValue);
    const colleagues = record.get('colleagues')
      .filter((peer) => peer.name)
      .map(sanitizeNeo4jValue);

    const alumniData = {
      id: record.get('id'),
      name: record.get('name'),
      company: record.get('company'),
      companyNodeName: record.get('companyNodeName'),
      companyProperties: sanitizeNeo4jValue(record.get('companyProperties')),
      department: record.get('department'),
      graduationYear: sanitizeNeo4jValue(record.get('graduationYear')),
      properties: sanitizeNeo4jValue(record.get('properties')),
      interestedStudents,
      colleagues,
    };

    return res.json({
      success: true,
      data: alumniData,
    });
  } catch (error) {
    console.error('Error fetching alumni profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alumni profile from Neo4j',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

/**
 * POST /api/alumni
 * Persist new Alumni or Student nodes and WORKS_AT relationships (DA3 CRUD write persistence)
 * Directory persistence only; does not issue JWT session tokens or manage password credentials.
 */
router.post('/', async (req, res) => {
  const { name, email = '', department = 'CSE', company = '', graduationYear, role = 'Alumni' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Name is required to register a profile in Neo4j',
    });
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    const cleanName = name.trim();
    const cleanDept = (department || 'CSE').trim();
    const cleanCompany = company ? company.trim() : '';
    const cleanEmail = (email || '').toLowerCase().trim();
    const yearParsed = graduationYear ? parseInt(graduationYear, 10) : null;
    const yearVal = isNaN(yearParsed) ? null : yearParsed;

    let query;
    let params;

    if (role === 'Student') {
      query = `
        MERGE (s:Student {name: $name})
        ON CREATE SET
          s.department = $department,
          s.year = coalesce($yearVal, 2),
          s.email = $email,
          s.createdAt = datetime()
        ON MATCH SET
          s.department = $department,
          s.email = CASE WHEN $email <> '' AND (s.email IS NULL OR s.email = '') THEN $email ELSE s.email END
        RETURN
          elementId(s) AS id,
          s.name AS name,
          labels(s) AS labels,
          properties(s) AS properties
      `;
      params = {
        name: cleanName,
        department: cleanDept,
        yearVal: yearVal || 2,
        email: cleanEmail,
      };
    } else {
      query = `
        MERGE (a:Alumni {name: $name})
        ON CREATE SET
          a.department = $department,
          a.graduationYear = $yearVal,
          a.company = $company,
          a.email = $email,
          a.createdAt = datetime()
        ON MATCH SET
          a.department = $department,
          a.graduationYear = coalesce($yearVal, a.graduationYear),
          a.company = CASE WHEN $company <> '' THEN $company ELSE a.company END,
          a.email = CASE WHEN $email <> '' AND (a.email IS NULL OR a.email = '') THEN $email ELSE a.email END
        WITH a
        FOREACH (_ IN CASE WHEN $company <> '' THEN [1] ELSE [] END |
          MERGE (c:Company {name: $company})
          MERGE (a)-[:WORKS_AT]->(c)
        )
        RETURN
          elementId(a) AS id,
          a.name AS name,
          labels(a) AS labels,
          properties(a) AS properties
      `;
      params = {
        name: cleanName,
        department: cleanDept,
        yearVal: yearVal || new Date().getFullYear(),
        company: cleanCompany,
        email: cleanEmail,
      };
    }

    const result = await session.run(query, params);
    if (result.records.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create record in Neo4j',
      });
    }

    const record = result.records[0];
    const safeProps = sanitizeNeo4jValue(record.get('properties')) || {};
    delete safeProps.passwordHash;
    delete safeProps.resetTokenHash;
    delete safeProps.resetTokenExpiry;

    return res.status(201).json({
      success: true,
      message: `${role} record for "${cleanName}" persisted successfully to Neo4j`,
      data: {
        id: record.get('id'),
        name: record.get('name'),
        labels: record.get('labels'),
        properties: safeProps,
      },
    });
  } catch (error) {
    console.error('Error persisting record to Neo4j:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to write record to Neo4j database',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

/**
 * POST /api/alumni/:id/interest
 * Express mentorship interest: creates (:Student)-[:INTERESTED_IN]->(:Alumni) in Neo4j
 */
router.post('/:id/interest', async (req, res) => {
  const { id } = req.params;
  const {
    studentName = 'Rahul',
    studentDept = 'CSE',
    studentYear = 2,
    message = '',
  } = req.body;

  const session = getSession(neo4j.session.WRITE);

  try {
    const query = `
      MATCH (a:Alumni)
      WHERE elementId(a) = $id OR a.name = $id
      MERGE (s:Student {name: $studentName})
      ON CREATE SET
        s.department = $studentDept,
        s.year = $studentYear,
        s.createdAt = datetime()
      MERGE (s)-[r:INTERESTED_IN]->(a)
      ON CREATE SET
        r.createdAt = datetime(),
        r.message = $message
      RETURN
        elementId(s) AS studentId,
        s.name AS studentName,
        elementId(a) AS alumniId,
        a.name AS alumniName,
        type(r) AS relationship
    `;

    const parsedYear = parseInt(studentYear, 10);
    const result = await session.run(query, {
      id,
      studentName: (studentName || 'Rahul').trim(),
      studentDept: (studentDept || 'CSE').trim(),
      studentYear: isNaN(parsedYear) ? 2 : parsedYear,
      message: (message || '').trim(),
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Alumni node with identifier "${id}" not found in database`,
      });
    }

    const record = result.records[0];
    return res.status(201).json({
      success: true,
      message: `Relationship (:INTERESTED_IN) created from ${record.get('studentName')} to ${record.get('alumniName')}`,
      data: {
        studentId: record.get('studentId'),
        studentName: record.get('studentName'),
        alumniId: record.get('alumniId'),
        alumniName: record.get('alumniName'),
        relationship: record.get('relationship'),
      },
    });
  } catch (error) {
    console.error('Error creating interest relationship in Neo4j:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record relationship in Neo4j',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

export default router;
