// File: src/components/creategig/GigEscrowStep3.jsx
import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { FaPiggyBank } from 'react-icons/fa';
import api from '../../utils/api';

export default function GigEscrowStep3({ 
  gigId,
  fixedPrice,
  recruiterRate,
  studentRate,
  onDeposited,     // callback to advance to next step
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // calculate fees
  const recruiterFee = fixedPrice * recruiterRate;
  const studentFee   = fixedPrice * studentRate;
  const combined     = Math.min(recruiterFee + studentFee, 50000);

  const handleDeposit = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/escrow', { gigId, amount: fixedPrice });
      // pass the deposit record back
      onDeposited(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to deposit into escrow. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard-card">
      <h5>
        <FaPiggyBank className="me-2 text-success" />
        Step 3: Escrow Deposit
      </h5>
      <small>Secure funds so work can begin with confidence.</small>

      <dl className="mt-4">
        <dt>Total Deposit</dt>
        <dd>MK {fixedPrice.toLocaleString()}</dd>

        <dt>Recruiter Fee ({(recruiterRate * 100).toFixed(0)}%)</dt>
        <dd>MK {recruiterFee.toFixed(0)}</dd>

        <dt>Student Fee ({(studentRate * 100).toFixed(0)}%)</dt>
        <dd>MK {studentFee.toFixed(0)}</dd>

        <dt>Combined Fees</dt>
        <dd>
          MK {combined.toFixed(0)}
          {combined < (recruiterFee + studentFee) && ' (capped at MK 50,000)'}
        </dd>
      </dl>

      {error && (
        <div className="text-danger mb-3">
          {error}
        </div>
      )}

      <Button
        variant="success"
        onClick={handleDeposit}
        disabled={loading}
      >
        {loading
          ? <Spinner animation="border" size="sm" />
          : 'Deposit into Escrow'}
      </Button>
    </div>
  );
}
 