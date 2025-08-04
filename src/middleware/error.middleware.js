// src/middleware/error.middleware.js

// This catches any errors passed to next(err) and returns a JSON response
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
}

module.exports = { errorHandler };
