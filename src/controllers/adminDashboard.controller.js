// src/controllers/adminDashboard.controller.js
const db = require('../config/database');

exports.getOverview = async (req, res, next) => {
  try {
    // Run all queries in parallel, now including skills count
    const results = await Promise.all([
      db.query(`SELECT COUNT(*) AS count FROM users WHERE is_active = 1`),
      db.query(`SELECT COUNT(*) AS count FROM gigs WHERE status = 'Open'`),
      db.query(`SELECT COUNT(*) AS count FROM gigs WHERE status = 'Completed'`),
      db.query(`
        SELECT COUNT(*) AS count
        FROM gig_applications
        WHERE status IN ('Applied','Shortlisted','Accepted')
      `),
      db.query(`
        SELECT COUNT(*) AS count
        FROM gig_applications
        WHERE status = 'Completed'
      `),
      db.query(`
        SELECT COUNT(*) AS count
        FROM recruiter_verifications
        WHERE verification_status = 'basic_verified'
      `),
      db.query(`SELECT COUNT(*) AS count FROM skills`),  // ← new skills query
    ]);

    // Extract the single-row, single-column count from each result
    const [
      activeUsersRow,
      activeGigsRow,
      completedGigsRow,
      activeAppsRow,
      completedAppsRow,
      pendingVerifRow,
      skillsRow,        // ← the new one
    ] = results.map(r => r[0][0]);

    // Build your stats object including totalSkills
    const stats = {
      activeUsers:           activeUsersRow.count,
      activeGigs:            activeGigsRow.count,
      completedGigs:         completedGigsRow.count,
      activeApplications:    activeAppsRow.count,
      completedApplications: completedAppsRow.count,
      pendingVerifications:  pendingVerifRow.count,
      totalSkills:           skillsRow.count,  // ← added here
    };

    // Recent activity (unchanged)
    const [rows] = await db.query(
      `
      SELECT description
      FROM (
        SELECT
          CONCAT('New gig posted: \"', title, '\"') AS description,
          created_at   AS date
        FROM gigs

        UNION ALL

        SELECT
          CONCAT('Application submitted on \"', g.title, '\"') AS description,
          ga.applied_at AS date
        FROM gig_applications ga
        JOIN gigs g ON ga.gig_id = g.id

        UNION ALL

        SELECT
          CONCAT('Recruiter \"', u.name, '\" fully verified') AS description,
          rv.updated_at     AS date
        FROM recruiter_verifications rv
        JOIN users u ON rv.user_id = u.id
        WHERE rv.verification_status = 'fully_verified'
      ) AS recent
      ORDER BY date DESC
      LIMIT 5
      `
    );

    const recentActivity = rows.map(r => r.description);

    // Send back both stats and recentActivity
    return res.json({ stats, recentActivity });
  } catch (err) {
    return next(err);
  }
};
