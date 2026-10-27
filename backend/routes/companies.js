import express from 'express';
import { getSession, sanitizeNeo4jValue } from '../config/neo4j.js';
import { fallbackCompanies, fallbackAlumni } from '../utils/demoFallback.js';

const router = express.Router();

/**
 * GET /api/companies
 * Retrieves all companies with their associated alumni count and departments.
 */
router.get('/', async (req, res) => {
  let session;
  try {
    session = getSession();
    const query = `
      MATCH (c:Company)
      OPTIONAL MATCH (a:Alumni)-[:WORKS_AT]->(c)
      OPTIONAL MATCH (s:Student)-[:INTERESTED_IN]->(c)
      WITH c,
           count(DISTINCT a) AS alumniCount,
           collect(DISTINCT {
             id: elementId(a),
             name: a.name,
             department: a.department,
             graduationYear: a.graduationYear
           }) AS rawAlumni,
           collect(DISTINCT a.department) AS departments,
           collect(DISTINCT s.name) AS interestedStudents
      RETURN 
        elementId(c) AS id,
        c.name AS name,
        alumniCount,
        properties(c) AS companyProperties,
        departments,
        rawAlumni,
        interestedStudents
      ORDER BY alumniCount DESC, c.name ASC
    `;

    const result = await session.run(query);
    const companies = result.records.map((record) => {
      const depts = record.get('departments').filter(Boolean);
      const rawAlumni = record.get('rawAlumni')
        .filter((a) => a.name)
        .map(sanitizeNeo4jValue);
      const students = record.get('interestedStudents').filter(Boolean);

      return {
        id: record.get('id'),
        name: record.get('name'),
        alumniCount: sanitizeNeo4jValue(record.get('alumniCount')),
        companyProperties: sanitizeNeo4jValue(record.get('companyProperties')),
        departments: depts,
        alumni: rawAlumni,
        interestedStudents: students,
      };
    });

    if (companies.length === 0) {
      return res.json({
        success: true,
        count: fallbackCompanies.length,
        data: fallbackCompanies,
      });
    }

    return res.json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.warn('[Neo4j Notice] Using fallback presentation companies:', error.message);
    return res.json({
      success: true,
      isDemoFallback: true,
      count: fallbackCompanies.length,
      data: fallbackCompanies,
    });
  } finally {
    if (session) await session.close();
  }
});

/**
 * GET /api/companies/:name/alumni
 * Retrieves all alumni working at a specific company
 */
router.get('/:name/alumni', async (req, res) => {
  const { name } = req.params;
  let session;

  try {
    session = getSession();
    const query = `
      MATCH (a:Alumni)
      OPTIONAL MATCH (a)-[:WORKS_AT]->(c:Company)
      WHERE toLower(coalesce(c.name, a.company, '')) = toLower($name)
      RETURN 
        elementId(a) AS id,
        a.name AS name,
        coalesce(c.name, a.company) AS company,
        a.department AS department,
        a.graduationYear AS graduationYear,
        properties(a) AS properties
      ORDER BY a.name ASC
    `;

    const result = await session.run(query, { name });
    const alumni = result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      company: record.get('company'),
      department: record.get('department'),
      graduationYear: sanitizeNeo4jValue(record.get('graduationYear')),
      properties: sanitizeNeo4jValue(record.get('properties')),
    }));

    return res.json({
      success: true,
      company: name,
      count: alumni.length,
      data: alumni,
    });
  } catch (error) {
    console.warn(`[Neo4j Notice] Using fallback presentation alumni for ${name}:`, error.message);
    const filtered = fallbackAlumni.filter(
      (a) => a.company?.toLowerCase() === name.toLowerCase()
    );
    return res.json({
      success: true,
      isDemoFallback: true,
      company: name,
      count: filtered.length,
      data: filtered,
    });
  } finally {
    if (session) await session.close();
  }
});

export default router;
