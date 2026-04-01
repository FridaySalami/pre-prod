/**
 * Structured JSON logger for production monitoring
 * Outputs to stdout in JSON format for easy parsing by Render/monitoring tools
 */

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    workerId: process.env.WORKER_ID || 'notification-processor',
    ...meta
  };

  console.log(JSON.stringify(entry));
}

const logger = {
  info: (message, meta = {}) => log('INFO', message, meta),
  warn: (message, meta = {}) => log('WARN', message, meta),
  error: (message, meta = {}) => log('ERROR', message, meta),
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      log('DEBUG', message, meta);
    }
  }
};

module.exports = logger;
