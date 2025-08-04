// File: src/controllers/assessment.controller.js
const db = require('../config/database');

// GET /api/assessments/:skill
exports.getAssessmentBySkill = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { skill } = req.params;

    const [rows] = await db.query(
      `SELECT skill,
              score_pct,
              time_taken_avg,
              level,
              taken_at,
              details,
              next_allowed_retaken_at
         FROM skill_assessments
        WHERE student_id = ? AND skill = ?`,
      [studentId, skill]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Not taken yet' });
    }

    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/assessments/:skill
// Body: { score_pct, time_taken_avg, details (array) }
exports.submitAssessment = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { skill } = req.params;
    const { score_pct, time_taken_avg, details } = req.body;

    // have they already taken it?
    const [[existing]] = await db.query(
      `SELECT 1,
              next_allowed_retaken_at
         FROM skill_assessments
        WHERE student_id = ? AND skill = ?`,
      [studentId, skill]
    );

    if (existing) {
      const now = new Date();
      const nextAllowed = new Date(existing.next_allowed_retaken_at);
      if (now < nextAllowed) {
        return res.status(409).json({
          message: 'Already taken',
          next_allowed_retaken_at: nextAllowed
        });
      }
      // (optional) allow re‑submission past cooldown by falling through
      await db.query(
        `DELETE FROM skill_assessments
          WHERE student_id = ? AND skill = ?`,
        [studentId, skill]
      );
    }

    // derive level
    let level = 'Beginner';
    if (score_pct >= 80) level = 'Expert';
    else if (score_pct >= 50) level = 'Intermediate';

    const takenAt = new Date();
    const nextRetake = new Date(takenAt);
    nextRetake.setMonth(nextRetake.getMonth() + 3);

    await db.query(
      `INSERT INTO skill_assessments
         (student_id, skill, score_pct, time_taken_avg, level, details, taken_at, next_allowed_retaken_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        skill,
        score_pct,
        time_taken_avg,
        level,
        JSON.stringify(details),
        takenAt,
        nextRetake
      ]
    );

    return res.status(201).json({
      skill,
      score_pct,
      time_taken_avg,
      level,
      details,
      taken_at: takenAt,
      next_allowed_retaken_at: nextRetake
    });
  } catch (err) {
    next(err);
  }
};
