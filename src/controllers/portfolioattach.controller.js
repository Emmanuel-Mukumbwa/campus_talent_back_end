// File: src/controllers/portfolioattach.controller.js

const pool = require('../config/database');

exports.uploadPortfolioAttachmentsToProject = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const projectId = req.params.projectId;

    // 1) Validate project belongs to this student
    const [rows] = await pool.query(
      `SELECT pp.id
         FROM portfolio_projects pp
         JOIN portfolios p ON pp.portfolio_id = p.id
        WHERE pp.id = ? AND p.student_id = ?`,
      [projectId, studentId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2) Build absolute URLs for each uploaded file
    const host = `${req.protocol}://${req.get('host')}`;
    const urls = req.files.map(f =>
      `${host}/uploads/attachments/${f.filename}`
    );

    // 3) Read existing media JSON
    const [[{ media }]] = await pool.query(
      'SELECT media FROM portfolio_projects WHERE id = ?',
      [projectId]
    );
    const existing = media ? JSON.parse(media) : [];

    // 4) Append new URLs and update JSON column
    const updated = [...existing, ...urls];
    await pool.query(
      `UPDATE portfolio_projects
          SET media = ?
        WHERE id = ?`,
      [JSON.stringify(updated), projectId]
    );

    // 5) Return the new URLs
    res.json({ projectId, attachments: urls });
  } catch (err) {
    next(err);
  }
};
