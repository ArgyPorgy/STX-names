import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initializeDatabase } from './db.js';
import apiRouter from './api.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRouter);

// Start server
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized');

    // Start HTTP server
    app.listen(config.server.port, () => {
      console.log(`Server running on http://localhost:${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
      console.log(`Network: ${config.stacks.network}`);
      console.log(`Contract: ${config.stacks.contractAddress}.${config.stacks.contractName}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

