// File: src/controllers/escrow.controller.js
const pool = require('../config/database');

// POST /api/escrow
// Body: { gigId, amount }
exports.createDeposit = async (req, res, next) => {
  const { gigId, amount } = req.body;
  const userId = req.user.id; // ensure recruiter auth

  if (!gigId || !amount) {
    return res.status(400).json({ message: 'gigId and amount are required' });
  }

  try {
    // Verify this recruiter owns the gig
    const [gigRows] = await pool.query(
      'SELECT recruiter_id FROM gigs WHERE id = ?',
      [gigId]
    );
    if (!gigRows.length || gigRows[0].recruiter_id !== userId) {
      return res.status(403).json({ message: 'Not authorized for this gig' });
    }

    // Insert into escrow_deposits
    const [result] = await pool.query(
      `INSERT INTO escrow_deposits
        (gig_id, amount, status)
       VALUES (?, ?, 'Pending')`, 
      [gigId, amount]
    );

    // Fetch the newly created record
    const [rows] = await pool.query(
      'SELECT * FROM escrow_deposits WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};
