/**
 * Health monitoring server for Render.com
 * Provides /health endpoint required by Render for worker health checks
 */

const express = require('express');
const logger = require('./logger');

/**
 * Start a lightweight HTTP server for health checks
 * @param {number} port - Port to listen on (default: 3000)
 * @param {function} getStatus - Function that returns current health status
 */
function startHealthServer(port = 3000, getStatus) {
  const app = express();

  // Health check endpoint
  app.get('/health', (req, res) => {
    try {
      const status = getStatus();
      const httpCode = status.status === 'healthy' ? 200 : 503;

      res.status(httpCode).json({
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'Buy Box Notification Processor',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Start server
  app.listen(port, '0.0.0.0', () => {
    logger.info('🏥 Health server started', { port });
  });

  return app;
}

module.exports = { startHealthServer };
