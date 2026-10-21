import express from 'express';
import { verifyConnectivity } from '../config/neo4j.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const dbStatus = await verifyConnectivity();
    
    const isHealthy = dbStatus.connected;
    const responsePayload = {
      status: isHealthy ? 'healthy' : 'database_unavailable',
      message: isHealthy
        ? 'Backend API and Neo4j database are connected and operational.'
        : 'Backend API is running, but Neo4j database connection failed.',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: {
        nodeVersion: process.version,
        port: process.env.PORT || 5000,
        neo4jUri: process.env.NEO4J_URI || 'neo4j://127.0.0.1:7687',
      },
    };

    return res.status(isHealthy ? 200 : 503).json(responsePayload);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Unexpected health check error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
