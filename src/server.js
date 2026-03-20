// File: src/server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const routes  = require('./routes');

// Import your existing error handler and wrap it to log
const originalErrorHandler = require('./middleware/error.middleware').errorHandler;
function errorHandler(err, req, res, next) {
  console.error('❌ Unhandled error:', err);
  return originalErrorHandler(err, req, res, next);
}

const app = express();

// ================================
// CORS Configuration
// ================================

// List of explicitly allowed origins
const explicitOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://campus-talent-front-end-f28i.vercel.app'
];

// Helper to strip trailing slash from an origin string
function normalize(origin) {
  if (!origin) return origin;
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

// Determine if an origin is allowed
function isOriginAllowed(origin) {
  if (!origin) return true; // allow non-browser requests (like Postman, server-to-server)

  const norm = normalize(origin);

  // 1) Check against explicit list
  if (explicitOrigins.includes(norm)) return true;

  // 2) Allow all Vercel preview URLs that match the pattern
  //    Example: https://campus-talent-front-end-f28i-abcdef123.vercel.app
  if (
    norm.startsWith('https://campus-talent-front-end-f28i-') &&
    norm.endsWith('.vercel.app')
  ) {
    return true;
  }

  // 3) (Optional) Allow any other pattern you may need, e.g., localhost with ports
  //    Already covered by explicit list for :3000 and :5000

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    console.log('🔐 CORS request from:', origin);
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Apply CORS middleware globally
app.use(cors(corsOptions));
// Handle preflight requests
app.options('*', cors(corsOptions));

// Health-check endpoint to verify CORS is working
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Body parser
app.use(express.json());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes
app.use('/api', routes);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});