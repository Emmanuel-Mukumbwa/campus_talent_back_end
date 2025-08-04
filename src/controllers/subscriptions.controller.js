// src/controllers/subscriptions.controller.js

const axios         = require('axios');
const { v4: uuidv4 } = require('uuid');
const db            = require('../config/database');
require('dotenv').config();

const PAY_CHANGU_SECRET_KEY = process.env.PAY_CHANGU_SECRET_KEY;
const PAY_CHANGU_API_URL   = 'https://api.paychangu.com';

// Fallback URLs
const CALLBACK_URL =
  process.env.SUBSCRIPTION_CALLBACK_URL ||
  process.env.NOOP_CALLBACK_URL ||
  `${process.env.APP_BASE_URL}/api/subscriptions/webhook`;
const RETURN_URL = process.env.SUBSCRIPTION_RETURN_URL;

/**
 * Load all plans from the database into a lookup:
 *   { free:  { price, maxPosts }, basic: {...}, ... }
 */
async function loadPlans() {
  const [rows] = await db.query(
    'SELECT `key`, price, max_posts FROM plans'
  );
  return rows.reduce((map, p) => {
    map[p.key] = { price: p.price, maxPosts: p.max_posts };
    return map;
  }, {});
}

// 1) Start a new subscription (free or paid)
exports.initiateSubscription = async (req, res, next) => {
  try {
    const recruiterId = req.user.id;
    const { plan }    = req.body;

    const PLANS = await loadPlans();
    if (!PLANS[plan]) {
      return res.status(400).json({ message: 'Invalid plan.' });
    }

    const now       = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // FREE plan shortcut
    if (plan === 'free') {
      const tx_ref = `sub_free_${uuidv4()}`;
      await db.query(
        `INSERT INTO subscriptions
           (recruiter_id, plan, order_reference, status, current_period_start, current_period_end)
         VALUES (?, ?, ?, 'active', ?, ?)`,
        [recruiterId, plan, tx_ref, now, periodEnd]
      );
      return res.json({
        free: true,
        message: 'Free plan activated—no payment required.',
        periodStart: now,
        periodEnd
      });
    }

    // Paid plan: kick off PayChangu
    const amount = PLANS[plan].price;
    const tx_ref = `sub_${uuidv4()}`;

    // Persist as pending
    await db.query(
      `INSERT INTO subscriptions
         (recruiter_id, plan, order_reference, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [recruiterId, plan, tx_ref, now, periodEnd]
    );

    // Initiate PayChangu checkout
    const payload = {
      amount,
      currency:     'MWK',
      tx_ref,
      callback_url: CALLBACK_URL,
      return_url:   RETURN_URL,
      meta:         { recruiterId, plan },
      uuid:         tx_ref,
      customization: {
        title: `Subscription: ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        logo:  process.env.APP_LOGO_URL || ''
      }
    };
    const { data } = await axios.post(
      `${PAY_CHANGU_API_URL}/payment`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAY_CHANGU_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.json({
      paymentPageUrl: data.data.checkout_url,
      tx_ref
    });

  } catch (err) {
    console.error('Subscription initiation error:', err.response?.data || err.message);
    next(err);
  }
};

// 2) Webhook for PayChangu status updates
exports.handleWebhook = async (req, res, next) => {
  const { data } = req.body;
  const tx_ref   = data?.tx_ref;
  const status   = data?.status;

  if (!tx_ref) return res.sendStatus(400);

  try {
    const newStatus = status === 'success' ? 'active' : 'past_due';
    await db.query(
      `UPDATE subscriptions
         SET status     = ?,
             updated_at = NOW()
       WHERE order_reference = ?`,
      [newStatus, tx_ref]
    );
    res.json({ received: true });
  } catch (err) {
    console.error('Subscription webhook error:', err);
    next(err);
  }
};

// 3) Fetch latest subscription + when free tier unlocks
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const recruiterId = req.user.id;
    const PLANS       = await loadPlans();

    // (a) Latest subscription row
    const [[sub]] = await db.query(
      `SELECT plan, status, current_period_start, current_period_end
         FROM subscriptions
        WHERE recruiter_id = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      [recruiterId]
    );

    // (b) Last‐free-plan end date
    const [[lastFree]] = await db.query(
      `SELECT current_period_end
         FROM subscriptions
        WHERE recruiter_id = ?
          AND plan = 'free'
        ORDER BY created_at DESC
        LIMIT 1`,
      [recruiterId]
    );

    // No subscriptions at all
    if (!sub) {
      const now      = new Date();
      const nextFree = new Date(now);
      nextFree.setMonth(nextFree.getMonth() + 1);
      return res.json({
        message:         'No subscription found. You can start with the free plan.',
        plan:            null,
        status:          null,
        usedPosts:       0,
        maxPosts:        PLANS.free.maxPosts,
        periodStart:     null,
        periodEnd:       null,
        freeAvailableAt: now
      });
    }

    // Count used gigs this billing window
    const [[{ used }]] = await db.query(
      `SELECT COUNT(*) AS used
         FROM gigs
        WHERE recruiter_id = ?
          AND created_at BETWEEN ? AND ?`,
      [recruiterId, sub.current_period_start, sub.current_period_end]
    );

    res.json({
      plan:            sub.plan,
      status:          sub.status,
      periodStart:     sub.current_period_start,
      periodEnd:       sub.current_period_end,
      usedPosts:       used,
      maxPosts:        PLANS[sub.plan].maxPosts,
      freeAvailableAt: lastFree ? lastFree.current_period_end : null
    });
  } catch (err) {
    next(err);
  }
};
