import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import alumniRouter from './routes/alumni.js';
import companiesRouter from './routes/companies.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';
import mentorshipRouter from './routes/mentorship.js';
import chatRouter from './routes/chat.js';
import { closeDriver, verifyConnectivity, getSession } from './config/neo4j.js';

dotenv.config();

// AlumniConnect API Server - Live Neo4j Connection Fully Active
const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development and production deployments (including *.vercel.app)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Request logger for development transparency
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Helper to register API routes on both /api and root paths
const registerRoutes = (router) => {
  router.use('/health', healthRouter);
  router.use('/alumni', alumniRouter);
  router.use('/companies', companiesRouter);
  router.use('/stats', statsRouter);
  router.use('/auth', authRouter);
  router.use('/mentorship', mentorshipRouter);
  router.use('/chat', chatRouter);
};

// Mount API routes with /api prefix
const apiRouter = express.Router();
registerRoutes(apiRouter);
app.use('/api', apiRouter);

// Also mount directly on app for serverless rewrites where /api might be stripped
registerRoutes(app);

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AlumniConnect API Server',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/api/health',
      authGoogle: '/api/auth/google',
      alumni: '/api/alumni',
      alumniSearch: '/api/alumni/search?q=...',
      alumniDetail: '/api/alumni/:id',
      companies: '/api/companies',
      companyAlumni: '/api/companies/:name/alumni',
      stats: '/api/stats',
      graph: '/api/stats/graph',
    },
  });
});

// 404 Handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start listening on assigned port
const server = app.listen(PORT, async () => {
  console.log(`\n========================================`);
  console.log(`  AlumniConnect Backend Server`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`========================================\n`);

  console.log('Checking Neo4j database connectivity...');
  const dbStatus = await verifyConnectivity();
  if (dbStatus.connected) {
    console.log(` Neo4j Connected successfully!`);
    console.log(`  - URI: ${dbStatus.uri}`);
    console.log(`  - Database: ${dbStatus.database}`);
    console.log(`  - Agent: ${dbStatus.agent}\n`);

    // Ensure database constraints for mentorship and chat
    const initSession = getSession();
    try {
      await initSession.run('CREATE CONSTRAINT mentorship_req_id IF NOT EXISTS FOR (r:MentorshipRequest) REQUIRE r.id IS UNIQUE');
      await initSession.run('CREATE CONSTRAINT conv_id IF NOT EXISTS FOR (c:Conversation) REQUIRE c.id IS UNIQUE');
      await initSession.run('CREATE CONSTRAINT msg_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE');
    } catch (e) {
      // Constraints notice
    } finally {
      await initSession.close();
    }
  } else {
    console.warn(` Neo4j Connection Notice:`);
    console.warn(`  - Error: ${dbStatus.error}`);
    console.warn(`  - Action: Update NEO4J_PASSWORD in backend/.env if needed.\n`);
  }
});

// Graceful shutdown handling
const shutdown = async () => {
  console.log('\nShutting down AlumniConnect server...');
  if (server) {
    server.close(async () => {
      await closeDriver();
      console.log('Closed Neo4j driver connection. Process exiting.');
      process.exit(0);
    });
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
