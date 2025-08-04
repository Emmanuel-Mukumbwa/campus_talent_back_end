// src/middleware/subscription.middleware.js
const db    = require('../config/database');
const PLANS = require('../config/plans');

async function checkCanPostGigs(req, res, next) {
  const recruiterId = req.user.id;
  // fetch latest sub
  const [[sub]] = await db.query(
    `SELECT plan, status, current_period_start, current_period_end
       FROM subscriptions
      WHERE recruiter_id = ?
      ORDER BY created_at DESC
      LIMIT 1`, 
    [recruiterId]
  );
  const planKey = sub?.plan || 'free';
  if (sub?.status !== 'active' && planKey !== 'free') {
    return res.status(402).json({ message: 'Your subscription is not active.' });
  }
  const maxPosts = PLANS[planKey].maxPosts;
  if (maxPosts !== Infinity) {
    const [[{ used }]] = await db.query(
      `SELECT COUNT(*) AS used
         FROM gigs
        WHERE recruiter_id = ?
          AND created_at BETWEEN ? AND ?`,
      [recruiterId, sub.current_period_start, sub.current_period_end]
    );
    if (used >= maxPosts) {
      return res.status(403).json({ message: `Monthly post limit of ${maxPosts} reached.` });
    }
  }
  next();
}

module.exports = { checkCanPostGigs };
