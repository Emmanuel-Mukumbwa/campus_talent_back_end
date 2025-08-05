// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware').errorHandler;

const app = express();

// ✅ Define allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'https://campus-talent-front-end-f28i.vercel.app'
].filter(Boolean);

// ✅ Apply CORS middleware at the top
app.use(cors({
  origin: (origin, callback) => {
    console.log('🔐 CORS request from:', origin);
    if (!origin) return callback(null, true); // Allow non-browser requests like Postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true
}));

// ✅ Handle preflight OPTIONS requests for all routes
app.options('*', cors());

// ✅ Parse JSON request bodies
app.use(express.json());

// ✅ Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Mount your API routes under /api
app.use('/api', routes);

// ✅ Global error handler
app.use(errorHandler);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
