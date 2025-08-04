// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => { 
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try { 
    const payload = jwt.verify(token, process.env.JWT_SECRET); 
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  } 
};
   