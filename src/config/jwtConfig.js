// config/jwtConfig.js
require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'your_super_secret_key_here', // Use a strong key in production
  // Set expiration to 5 minutes (or change as needed)
  options: { expiresIn: '10m' },
};
