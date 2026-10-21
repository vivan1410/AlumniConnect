import express from 'express';
import { getSession, sanitizeNeo4jValue } from '../config/neo4j.js';

const router = express.Router();

/**
 * GET /api/stats
 * Overview statistics: counts of alumni, companies, students, departments, years
 */
router.get('/', async (req, res) => {
  const session = getSession();

  try {
    const query = `
      CALL {
        MATCH (a:Alumni) RETURN count(a) AS totalAlumni
      }
      CALL {
        MATCH (a:Alumni)
        OPTIONAL MATCH (a)-[:WORKS_AT]->(c:Company)
        WITH coalesce(c.name, a.company) AS comp
        WHERE comp IS NOT NULL AND comp <> ''
        RETURN count(DISTINCT comp) AS totalCompanies
      }
      CALL {
        OPTIONAL MATCH (s:Student) RETURN count(s) AS totalStudents
      }
      CALL {
        MATCH (a:Alumni)
        WHERE a.department IS NOT NULL AND a.department <> ''
        RETURN collect(DISTINCT a.department) AS departments
      }
      CALL {
        MATCH (a:Alumni)
        WHERE a.graduationYear IS NOT NULL
        RETURN collect(DISTINCT a.graduationYear) AS graduationYears
      }
      RETURN totalAlumni, totalCompanies, totalStudents, departments, graduationYears
    `;

    const result = await session.run(query);
    if (result.records.length > 0) {
      const record = result.records[0];
      const years = record.get('graduationYears').map(sanitizeNeo4jValue).sort((a, b) => b - a);

      return res.json({
        success: true,
        data: {
          totalAlumni: sanitizeNeo4jValue(record.get('totalAlumni')),
          totalCompanies: sanitizeNeo4jValue(record.get('totalCompanies')),
          totalStudents: sanitizeNeo4jValue(record.get('totalStudents')),
          departments: record.get('departments'),
          graduationYears: years,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        totalAlumni: 0,
        totalCompanies: 0,
        totalStudents: 0,
        departments: [],
        graduationYears: [],
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve stats from Neo4j database',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/stats/graph
 * Returns graph nodes and links representing the existing database relationships
 * (Alumni -> Company via WORKS_AT, Student -> Alumni / Company via INTERESTED_IN)
 */
router.get('/graph', async (req, res) => {
  const session = getSession();

  try {
    const nodesQuery = `
      MATCH (n)
      WHERE n:Alumni OR n:Company OR n:Student
      RETURN 
        elementId(n) AS id,
        labels(n) AS labels,
        n.name AS name,
        properties(n) AS properties
      LIMIT 100
    `;

    const relsQuery = `
      MATCH (source)-[r]->(target)
      WHERE (source:Alumni OR source:Student) AND (target:Company OR target:Alumni OR target:Student)
      RETURN 
        elementId(r) AS id,
        type(r) AS type,
        elementId(source) AS sourceId,
        elementId(target) AS targetId,
        source.name AS sourceName,
        target.name AS targetName
      LIMIT 150
    `;

    const nodesResult = await session.run(nodesQuery);
    const relsResult = await session.run(relsQuery);

    const nodes = nodesResult.records.map((r) => {
      const labels = r.get('labels');
      const primaryLabel = labels.includes('Alumni')
        ? 'Alumni'
        : labels.includes('Company')
        ? 'Company'
        : labels.includes('Student')
        ? 'Student'
        : labels[0] || 'Unknown';

      return {
        id: r.get('id'),
        label: primaryLabel,
        name: r.get('name') || 'Unnamed',
        properties: sanitizeNeo4jValue(r.get('properties')),
      };
    });

    const links = relsResult.records.map((r) => ({
      id: r.get('id'),
      type: r.get('type'),
      source: r.get('sourceId'),
      target: r.get('targetId'),
      sourceName: r.get('sourceName'),
      targetName: r.get('targetName'),
    }));

    return res.json({
      success: true,
      data: {
        nodes,
        links,
      },
    });
  } catch (error) {
    console.error('Error fetching graph network data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve graph relationships from Neo4j',
      details: error.message,
    });
  } finally {
    await session.close();
  }
});

export default router;
