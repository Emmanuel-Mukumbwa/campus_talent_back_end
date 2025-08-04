// src/server.js
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const routes       = require('./routes');
const errorHandler = require('./middleware/error.middleware').errorHandler;

const app = express();

// Enable CORS for your React app 
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5000'
].filter(Boolean);
   
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  }, 
  credentials: true
}));
  
// Parse JSON bodies
app.use(express.json());

// Serve uploaded files statically
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
);
  
// Serve React build assets
const clientBuildPath = path.join(__dirname, '..', '..', 'campus-talent-frontend', 'build');
app.use(express.static(clientBuildPath));

// For any non-API route, send back React’s index.html
app.get(/^\/(?!api).*/, (req, res) => { 
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});
//─────────────────────
 
// Mount all API routes under /api 
app.use('/api', routes); 

// Global error handler (should come last)
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 5000; 
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
