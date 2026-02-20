const logger = require('../config/logger');

/**
 * Universal Error Handler Middleware
 * 
 * This refactored version logs structured errors using winston and 
 * handles specific Mongoose/JWT errors.
 */
module.exports = (err, req, res, next) => {
  // 1. Log the error with full stack trace and request metadata
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    user: req.user ? req.user.id : 'unauthenticated'
  });

  // 2. Determine response status and message
  let status = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Specific error handling (Mongoose Validation)
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // Specific error handling (Mongoose Duplicate Key)
  if (err.code === 11000) {
    status = 400;
    message = `Duplicate field value entered: ${Object.keys(err.keyValue)}`;
  }

  // Specific error handling (JWT Errors)
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session has expired. Please log in again.';
  }

  // 3. Return a consistent error response format
  res.status(status).json({
    success: false,
    error: message,
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
