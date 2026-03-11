import { AppError } from '../utils/errors.js';

export const errorHandler = (err, req, res, next) => {
  // ✅ Handle null/undefined errors
  if (!err) {
    return res.status(500).json({
      success: false,
      message: 'An unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }

  console.error("DEBUG STACK:", err.stack)
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Validation Error';
    errors = err.errors 
      ? Object.values(err.errors).map(e => ({
          field: e.path,
          message: e.message
        }))
      : [{ message: err.message }];
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
    const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'field';
    errors = [{ field, message: `${field} already exists` }];
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  console.error('❌ Error:', {
    name: err.name,
    message: err.message,
    statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async handler wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
