// File: src/controllers/gigdetail.controller.js

const db = require('../config/database');

/**
 * GET /api/gigdetail/:id
 * Returns one gig plus nested requirements, skills (with proficiency), escrow, and recent applications.
 */
exports.getGigDetail = async (req, res, next) => {
  const gigId = +req.params.id;
  try {
    // 1) Fetch core gig
    const [[gigRow]] = await db.query(
      `SELECT 
         id,
         recruiter_id,
         title,
         description,
         gig_type,
         budget_type,
         location,
         payment_amount        AS fixedPrice,
         estimated_hours       AS estimatedHours,
         payment_method,
         bank_account_number,
         bank_name,
         status,
         duration,
         deliverables,
         contact_info,
         created_at,
         expires_at
       FROM gigs
       WHERE id = ?`,
      [gigId]
    );
    if (!gigRow) {
      return res.status(404).json({ message: 'Gig not found' });
    }

    // 2) Requirements
    const [reqRows] = await db.query(
      `SELECT 
         id,
         type,
         required,
         details
       FROM gig_requirements
       WHERE gig_id = ?
       ORDER BY required DESC, id`,
      [gigId]
    );

    // 3) Skills WITH proficiency
    const [skillRows] = await db.query(
      `SELECT 
         s.id           AS skill_id,
         s.name,
         s.category,
         gs.proficiency
       FROM gig_skills gs
       JOIN skills      s ON s.id = gs.skill_id
       WHERE gs.gig_id = ?`,
      [gigId]
    );

    // 4) Latest escrow record (if any)
    const [[escRow]] = await db.query(
      `SELECT
         order_reference    AS tx_ref,
         amount,
         paid,
         created_at,
         paid_at
       FROM escrows
       WHERE gig_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [gigId]
    );
    const escrow = escRow
      ? {
          tx_ref:     escRow.tx_ref,
          amount:     escRow.amount,
          paid:       Boolean(escRow.paid),
          created_at: escRow.created_at,
          paid_at:    escRow.paid_at
        }
      : null;

    // 5) Recent applications (up to 10)
    const [appRows] = await db.query(
      `SELECT 
         a.id,
         a.student_id,
         a.status,
         a.applied_at,
         u.name AS student_name
       FROM gig_applications a
       JOIN users u ON u.id = a.student_id
       WHERE a.gig_id = ?
       ORDER BY a.applied_at DESC
       LIMIT 10`,
      [gigId]
    );

    // assemble and send
    res.json({
      ...gigRow,
      requirements:       reqRows,
      skills:             skillRows,        // each has { skill_id, name, category, proficiency }
      escrow,
      recentApplications: appRows
    });
  } catch (err) {
    next(err);
  }
};
