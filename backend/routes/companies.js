import express from 'express';
import { getSession, sanitizeNeo4jValue } from '../config/neo4j.js';

const router = express.Router();

/**
 * GET /api/companies
 * Retrieves all companies with their associated alumni count and departments.
 */
router.get('/', async (req, res) => {
  const session = getSession();

  try {
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

    return res.json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve companies from Neo4j database',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/companies/:name/alumni
 * Retrieves all alumni working at a specific company
 */
router.get('/:name/alumni', async (req, res) => {
  const { name } = req.params;
  const session = getSession();

  try {
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
    console.error(`Error fetching alumni for company ${name}:`, error);
    return res.status(500).json({
      success: false,
      error: `Failed to retrieve alumni for company "${name}"`,
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

export default router;
