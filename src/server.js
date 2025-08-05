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
    console.log('🔐 CORS request from:', origin);
    if (!origin) {
      // Allow non-browser or same-origin requests
      return callback(null, true);
    }
    const norm = normalize(origin);
    const match = allowedOrigins.some(allowed =>
      norm === allowed || norm.startsWith(allowed)
    );
    if (match) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// 1) Apply CORS globally (before any other middleware)
app.use(cors(corsOptions));

// 2) Preflight handling
app.options('*', cors(corsOptions));

// 3) Health-check endpoint to verify CORS is working
app.get('/ping', (req, res) => {
  res.send('pong');
});

// 4) Body parser
app.use(express.json());

// 5) Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 6) Mount API
app.use('/api', routes);

// 7) Global error handler
app.use(errorHandler);

// 8) Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
