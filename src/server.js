// src/server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const routes  = require('./routes');
const errorHandler = require('./middleware/error.middleware').errorHandler;

const app = express();

// Only allow known trusted origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://campus-talent-front-end-f28i.vercel.app'
];

// Helper to strip trailing slash
function normalize(origin) {
  if (!origin) return origin;
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

const corsOptions = {
  origin: (origin, callback) => {
    // Log for debugging
    console.log('🔐 CORS request from:', origin);

    // Allow tools like Postman or mobile apps (no origin)
    if (!origin) {
      return callback(null, true);
    }

    const norm = normalize(origin);
    const match = allowedOrigins.some(allowed => norm === allowed || norm.startsWith(allowed));
    if (match) {
      return callback(null, true);
    }

    // Otherwise reject
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200, // for legacy browsers
};

// Apply CORS globally
app.use(cors(corsOptions));

// Explicitly handle preflight
app.options('*', cors(corsOptions));

// Body parser
app.use(express.json());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API
app.use('/api', routes);

// Global error handler (will catch CORS errors too)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
