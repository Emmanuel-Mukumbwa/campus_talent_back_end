// File: src/controllers/auth.controller.js

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool   = require('../config/database');

////////////////////////////////////////////////////////////////////////////////
// POST /api/auth/register
// Public: create a new user (student, recruiter or admin)
exports.register = async (req, res, next) => {
  const { name, email, password, role = 'student' } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: 'Name, email & password are required.' });
  }
  if (!['student','recruiter','admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  try {
    // 1. Check if email already exists
    const [[existing]] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // 2. Hash password
    const hash = await bcrypt.hash(password, 10);

    // 3. Insert new user
    const [result] = await pool.query(
      `INSERT INTO users 
         (name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [name, email, hash, role]
    );

    return res.status(201).json({
      message: 'Registration successful',
      userId: result.insertId
    });

  } catch (err) {
    console.error('Register error:', err);
    next(err);
  }
};

////////////////////////////////////////////////////////////////////////////////
// POST /api/auth/login
// Public: user login
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    // 1. Fetch user by email, including is_active
    const [rows] = await pool.query(
      `SELECT 
         id, 
         name, 
         email, 
         password_hash, 
         role,
         is_active
       FROM users
       WHERE email = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = rows[0];

    // 2. Check active flag
    if (user.is_active !== 1) {
      return res.status(403).json({ message: 'Account is suspended. Please contact support.' });
    }

    // 3. Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 4. Sign a JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 5. If recruiter, fetch their verification_status
    let verificationStatus = null;
    if (user.role === 'recruiter') {
      const [[ rv ]] = await pool.query(
        `SELECT verification_status
           FROM recruiter_verifications
          WHERE user_id = ?
          LIMIT 1`,
        [user.id]
      );
      verificationStatus = rv?.verification_status ?? 'pending';
    }

    // 6. Return auth payload
    return res.json({
      token,
      role:               user.role,
      name:               user.name,
      verificationStatus  // null for non-recruiters
    });

  } catch (err) {
    console.error('Login error:', err);  
    next(err);
  }
};

////////////////////////////////////////////////////////////////////////////////
// GET /api/auth/me
// Protected: fetch current user profile
exports.me = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    // 1. Fetch user & is_active
    const [rows] = await pool.query(
      `SELECT 
         id       AS userId, 
         name     AS fullName, 
         email, 
         role,
         is_active
       FROM users
       WHERE id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    const me = rows[0];

    // 2. Check active flag
    if (me.is_active !== 1) {
      return res.status(403).json({ message: 'Account is suspended. Please contact support.' });
    }

    // 3. If recruiter, fetch their verification_status
    let verificationStatus = null;
    if (me.role === 'recruiter') {
      const [[ rv ]] = await pool.query(
        `SELECT verification_status
           FROM recruiter_verifications
          WHERE user_id = ?`,
        [userId]
      );
      verificationStatus = rv?.verification_status ?? 'pending';
    }

    // 4. Return profile
    return res.json({
      userId, 
      fullName:           me.fullName,
      email:              me.email,
      role:               me.role, 
      verificationStatus  // null for non-recruiters
    });

  } catch (err) {
    console.error('Me endpoint error:', err);
    next(err);
  }
};
