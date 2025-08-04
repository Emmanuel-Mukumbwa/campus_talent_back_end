// File: src/controllers/escrow.controller.js
const axios         = require('axios');
const { v4: uuidv4 } = require('uuid');
const db            = require('../config/database');
require('dotenv').config();

const PAY_CHANGU_SECRET_KEY = process.env.PAY_CHANGU_SECRET_KEY;
const PAY_CHANGU_API_URL   = 'https://api.paychangu.com';
const CALLBACK_URL         = process.env.NOOP_CALLBACK_URL;
const RETURN_URL           = process.env.ESCROW_FALLBACK_URL;

exports.initiateEscrow = async (req, res, next) => { 
  const { gigId, amount, paymentMethod, phone } = req.body;
  const tx_ref = `escrow_${uuidv4()}`;

  try { 
    // 1a) Persist a pending escrow record
    const conn = await db.getConnection();
    await conn.query(
      `INSERT INTO escrows
         (gig_id, payment_method, order_reference, trans_id, phone, amount)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [
        gigId,
        paymentMethod,
        tx_ref,
        paymentMethod === 'mobile' ? phone : null,
        amount
      ]
    );
    conn.release(); 

    // 1b) Call Pay Changu to initiate payment hold
    const payload = { 
      amount,
      currency:     'MWK',
      tx_ref, 
      callback_url: CALLBACK_URL,
      return_url:   RETURN_URL,
      meta:         { gigId },
      uuid:         tx_ref,
      customization: {
        title: 'Escrow Deposit', 
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

    // 1c) Return checkout URL + tx_ref
    return res.json({
      paymentPageUrl: data.data.checkout_url,
      tx_ref
    });
  } catch (err) {
    console.error('Escrow initiation error:', err.response?.data || err.message);
    return next(err);
  }
};

/*exports.releaseEscrow = async (req, res, next) => {
  const { tx_ref } = req.body;
  if (!tx_ref) {
    return res.status(400).json({ message: 'tx_ref is required' });
  }

  try {
    // 2a) Verify payment status with Pay Changu
    const { data } = await axios.get(
      `${PAY_CHANGU_API_URL}/payment/verify/${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${PAY_CHANGU_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 2b) If successful, mark escrow as paid
    if (data.status === 'success') {
      await db.query(
        `UPDATE escrows
           SET paid = 1, paid_at = NOW()
         WHERE order_reference = ?`,
        [ tx_ref ]
      );
    }

    return res.json(data);
  } catch (err) {
    console.error('Escrow release error:', err.response?.data || err.message);
    return next(err);
  }
};*/
// File: controllers/escrow.controller.js

exports.releaseEscrow = async (req, res, next) => {
  const { tx_ref } = req.body;
  if (!tx_ref) {
    return res.status(400).json({ message: 'tx_ref is required' });
  }

  try {
    // Mark the escrow as paid
    const [result] = await db.query(
      `UPDATE escrows
         SET paid    = 1,
             paid_at = NOW()
       WHERE order_reference = ?`,
      [tx_ref]
    );

    if (result.affectedRows === 0) {
      // Nothing was updated → no matching escrow found
      return res.status(404).json({ message: 'Escrow record not found' });
    }

    return res.json({
      success: true,
      message: 'Escrow released successfully',
      order_reference: tx_ref
    });
  } catch (err) {
    console.error('Escrow release error:', err);
    return next(err);
  }
}; 


/**
 * GET /api/escrow/:tx_ref
 * Fetch a single escrow record by its transaction reference.
 */
exports.getEscrowByRef = async (req, res, next) => {
  const { tx_ref } = req.params;
  try {
    const conn = await db.getConnection();
    const [rows] = await conn.query(
      `SELECT
         id,
         gig_id,
         payment_method,
         order_reference AS tx_ref,
         trans_id,
         phone,
         amount,
         paid,
         created_at,
         paid_at
       FROM escrows
       WHERE order_reference = ?
       LIMIT 1`,
      [tx_ref]
    );
    conn.release();

    if (!rows.length) {
      return res.status(404).json({ message: 'Escrow not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching escrow:', err);
    return next(err);
  }
};
