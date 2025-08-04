// src/controllers/adminSkills.controller.js
const pool = require('../config/database');

// Allowed categories should mirror your ENUM on the table
const ALLOWED_CATEGORIES = ['Coding','Video','Design','Research','Tutoring'];

// GET /api/admin/skills
// Supports pagination and optional category filter
exports.listSkills = async (req, res, next) => {
  try {
    let { page = 1, limit = 10, category } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const whereClauses = [];
    const params = [];

    if (category && ALLOWED_CATEGORIES.includes(category)) {
      whereClauses.push('category = ?');
      params.push(category);
    }

    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // total count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM skills ${whereSQL}`,
      params
    );

    // fetch page
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, name, category 
         FROM skills 
         ${whereSQL}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/skills
exports.createSkill = async (req, res, next) => {
  try {
    const { name, category } = req.body;

    // Basic validations
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 50) {
      return res.status(400).json({ message: 'Name must be 2–50 characters.' });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid category.' });
    }

    // Duplicate check
    const [[exists]] = await pool.query(
      'SELECT 1 FROM skills WHERE name = ?',
      [name.trim()]
    );
    if (exists) {
      return res.status(409).json({ message: 'A skill with that name already exists.' });
    }

    const [result] = await pool.query(
      'INSERT INTO skills (name, category) VALUES (?, ?)',
      [name.trim(), category]
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), category });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/skills/:id
exports.updateSkill = async (req, res, next) => {
  try {
    const { id }       = req.params;
    const { name, category } = req.body;

    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 50) {
      return res.status(400).json({ message: 'Name must be 2–50 characters.' });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid category.' });
    }

    // Duplicate check (excluding current)
    const [[exists]] = await pool.query(
      'SELECT 1 FROM skills WHERE name = ? AND id <> ?',
      [name.trim(), id]
    );
    if (exists) {
      return res.status(409).json({ message: 'Another skill with that name already exists.' });
    }

    const [result] = await pool.query(
      'UPDATE skills SET name = ?, category = ? WHERE id = ?',
      [name.trim(), category, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Skill not found.' });
    }

    res.json({ id: Number(id), name: name.trim(), category });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/skills/:id
exports.deleteSkill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM skills WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Skill not found.' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
