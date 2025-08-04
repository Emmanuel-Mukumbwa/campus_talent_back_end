// File: src/controllers/gigpost.controller.js

const pool = require('../config/database');

/** 
 * POST /api/recruiter/gigs  
 * Upsert a draft or publish a new gig 
 */
exports.createOrUpdateGig = async (req, res, next) => {
  const {
    id,                   // optional for updates
    title,
    description,
    gig_type,
    skills = [],          // now [{ name, proficiency }, …]
    budget_type,
    payment_amount = null,
    payment_method = null,
    bank_account_number = null,
    bank_name = null,
    estimated_hours = null,
    duration,
    deliverables,
    contact_info,
    expires_at,
    location,
    status
  } = req.body;
  const recruiterId = req.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let gigId = id;

    if (!gigId) {
      // INSERT including estimated_hours
      const [result] = await conn.execute(
        `INSERT INTO gigs
           (recruiter_id, title, description, gig_type, budget_type,
            payment_amount, payment_method, bank_account_number, bank_name,
            estimated_hours, duration, deliverables,
            contact_info, expires_at, location, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          recruiterId,
          title,
          description,
          gig_type,
          budget_type,
          payment_amount,
          payment_method,
          bank_account_number,
          bank_name,
          estimated_hours,
          duration,
          deliverables,
          contact_info,
          expires_at,
          location,
          status
        ]
      );
      gigId = result.insertId;
    } else {
      // UPDATE including estimated_hours
      await conn.execute(
        `UPDATE gigs SET
           title               = ?,
           description         = ?,
           gig_type            = ?,
           budget_type         = ?,
           payment_amount      = ?,
           payment_method      = ?,
           bank_account_number = ?,
           bank_name           = ?,
           estimated_hours     = ?,
           duration            = ?,
           deliverables        = ?,
           contact_info        = ?,
           expires_at          = ?,
           location            = ?,
           status              = ?
         WHERE id = ? AND recruiter_id = ?`,
        [
          title,
          description,
          gig_type,
          budget_type,
          payment_amount,
          payment_method,
          bank_account_number,
          bank_name,
          estimated_hours,
          duration,
          deliverables,
          contact_info,
          expires_at,
          location,
          status,
          gigId,
          recruiterId
        ]
      );

      // Clear existing skills
      await conn.execute(
        `DELETE FROM gig_skills WHERE gig_id = ?`,
        [gigId]
      );
    }

    // Link new skills with proficiency
    if (skills.length) {
      // build IN(...) placeholders for skill names
      const names = skills.map(s => s.name);
      const placeholders = names.map(() => '?').join(',');
      const [skillRows] = await conn.execute(
        `SELECT id, name FROM skills WHERE name IN (${placeholders})`,
        names
      );
      if (skillRows.length) {
        // prepare a bulk VALUES list: (gig_id, skill_id, 'Proficiency')
        const values = skillRows.map(r => {
          const prof = skills.find(s => s.name === r.name)?.proficiency || 'Beginner';
          return `(${gigId}, ${r.id}, ${conn.escape(prof)})`;
        }).join(',');
        await conn.query(
          `INSERT INTO gig_skills (gig_id, skill_id, proficiency) VALUES ${values}`
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: 'Gig saved', gigId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * GET /api/recruiter/gigs
 * List all gigs for the authenticated recruiter
 */
exports.listGigs = async (req, res, next) => {
  const recruiterId = req.user.id;

  try {
    // Fetch gigs with estimated_hours
    const [gigs] = await pool.execute(
      `SELECT 
         id,
         title,
         description,
         gig_type,
         budget_type,
         payment_amount,
         payment_method,
         bank_account_number,
         bank_name,
         estimated_hours,
         duration,
         deliverables,
         contact_info,
         expires_at,
         location,
         status,
         created_at
       FROM gigs
       WHERE recruiter_id = ?
       ORDER BY created_at DESC`,
      [recruiterId]
    );

    if (!gigs.length) {
      return res.json({ gigs: [] });
    }

    // Fetch associated skills + proficiencies
    const gigIds = gigs.map(g => g.id);
    const placeholders = gigIds.map(() => '?').join(',');
    const [skillLinks] = await pool.execute(
      `SELECT gs.gig_id, s.name AS skill, gs.proficiency
         FROM gig_skills gs
         JOIN skills s ON s.id = gs.skill_id
        WHERE gs.gig_id IN (${placeholders})`,
      gigIds
    );

    // Group by gig_id
    const skillsByGig = skillLinks.reduce((acc, r) => {
      acc[r.gig_id] = acc[r.gig_id] || [];
      acc[r.gig_id].push({ name: r.skill, proficiency: r.proficiency });
      return acc;
    }, {});

    // Attach skills array to each gig
    const gigsWithSkills = gigs.map(g => ({
      ...g,
      skills: skillsByGig[g.id] || []
    }));

    res.json({ gigs: gigsWithSkills });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/recruiter/gigs/count
 * Count how many completed applications across this recruiter's gigs
 */
exports.countCompletedApplications = async (req, res, next) => {
  const recruiterId = req.user.id;
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS count 
         FROM gig_applications ga
         JOIN gigs g ON ga.gig_id = g.id
        WHERE g.recruiter_id = ?
          AND ga.status = 'Completed'`,
      [recruiterId]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    next(err);
  }
};
