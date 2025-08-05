// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware').errorHandler;

const app = express();

// ✅ Only allow known trusted origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://campus-talent-front-end-f28i.vercel.app'
];

// ✅ Configure CORS
app.use(cors({
  origin: (origin, callback) => {
    console.log('🔐 CORS request from:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true
}));

// ✅ Handle preflight requests
app.options('*', cors());

// ✅ Parse JSON request bodies
app.use(express.json());

// ✅ Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Mount all API routes under /api
app.use('/api', routes);

// ✅ Global error handler
app.use(errorHandler);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
