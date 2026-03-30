/**
 * Request logging middleware
 */

const getDuration = (start) => {
  const diff = process.hrtime(start);
  return (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
};

const logger = (req, res, next) => {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`→ ${timestamp} ${req.method} ${req.path}`);
  
  // Capture response finish
  res.on('finish', () => {
    const duration = getDuration(start);
    const status = res.statusCode;
    const statusColor = status >= 500 ? '\x1b[31m' : // red
                       status >= 400 ? '\x1b[33m' : // yellow
                       status >= 300 ? '\x1b[36m' : // cyan
                       '\x1b[32m'; // green
    const reset = '\x1b[0m';
    
    console.log(`← ${statusColor}${status}${reset} ${req.method} ${req.path} (${duration}ms)`);
  });
  
  next();
};

module.exports = { logger };
