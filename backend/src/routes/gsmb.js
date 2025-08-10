import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.use(requireAuth(['GSMB']));

/**
 * List fines (richer view)
 * ?paid=true|false (optional)
 */
router.get('/fines', (req, res) => {
  const { paid } = req.query;
  let where = '';
  if (paid === 'true') where = 'WHERE f.is_paid=1';
  if (paid === 'false') where = 'WHERE f.is_paid=0';

  const rows = db.prepare(`
    SELECT
      f.*,
      r.plate,
      lic.id   AS licenseId,
      lic.license_no AS licenseNo,
      lic.status AS licenseStatus,
      (SELECT COUNT(*) FROM fine_evidence e WHERE e.fine_id=f.id) AS evidenceCount,
      (SELECT status FROM fine_evidence e WHERE e.fine_id=f.id ORDER BY e.created_at DESC LIMIT 1) AS latestEvidenceStatus
    FROM fines f
    JOIN reports r ON r.id = f.report_id
    JOIN lorries l ON l.plate = r.plate
    JOIN licenses lic ON lic.id = l.license_id
    ${where}
    ORDER BY f.created_at DESC
  `).all();

  res.json(rows);
});

/**
 * Payment webhook (gateway -> server)
 * - Idempotent: if already paid, returns ok
 * - Amount check
 */
router.post('/payments/webhook', (req, res) => {
  const { paymentRef, gatewayTxnId, amount } = req.body;
  const fine = db.prepare('SELECT * FROM fines WHERE payment_ref=?').get(paymentRef);
  if (!fine) return res.status(404).json({ error: 'Unknown paymentRef' });

  if (Number(amount) !== Number(fine.amount)) {
    return res.status(400).json({ error: 'Amount mismatch' });
  }

  if (fine.is_paid) {
    // Already paid -> idempotent response
    return res.json({ ok: true, message: 'Already paid' });
  }

  db.prepare('UPDATE fines SET is_paid=1, paid_via=? WHERE id=?').run('webhook', fine.id);
  db.prepare('INSERT INTO payments (fine_id, amount, gateway_txn_id, verified) VALUES (?,?,?,?)')
    .run(fine.id, fine.amount, gatewayTxnId || ('GW-'+Date.now()), 1);

  return res.json({ ok: true });
});

/**
 * License reactivation gate:
 * - Only if all fines tied to this license are paid
 */
router.post('/licenses/:licenseId/reactivate', (req, res) => {
  const { licenseId } = req.params;

  const hasUnpaid = db.prepare(`
    SELECT 1
    FROM lorries l
    JOIN reports r ON r.plate = l.plate
    JOIN fines f ON f.report_id = r.id
    WHERE l.license_id=? AND f.is_paid=0
    LIMIT 1
  `).get(licenseId);
  if (hasUnpaid) return res.status(400).json({ error: 'Outstanding fines remain' });

  db.prepare('UPDATE licenses SET status="ACTIVE" WHERE id=?').run(licenseId);
  res.json({ ok: true });
});

/**
 * Helper: inspect a license’s unpaid fines (for UI confirmation)
 */
router.get('/licenses/:licenseId', (req, res) => {
  const { licenseId } = req.params;

  const lic = db.prepare(`
    SELECT id, license_no AS licenseNo, owner_name AS ownerName, status
    FROM licenses WHERE id=?
  `).get(licenseId);
  if (!lic) return res.status(404).json({ error: 'License not found' });

  const unpaid = db.prepare(`
    SELECT f.*, r.plate
    FROM lorries l
    JOIN reports r ON r.plate = l.plate
    JOIN fines f ON f.report_id = r.id
    WHERE l.license_id=? AND f.is_paid=0
    ORDER BY f.created_at DESC
  `).all(licenseId);

  res.json({ license: lic, unpaidFines: unpaid, unpaidCount: unpaid.length });
});

/**
 * --- Evidence review workflow ---
 * Owners can upload slips into fine_evidence (PENDING)
 * GSMB reviews: approve -> marks fine as paid; reject -> leaves fine unpaid
 */

/** List evidence (default PENDING; ?status=APPROVED|REJECTED|ALL) */
router.get('/evidence', (req, res) => {
  const status = (req.query.status || 'PENDING').toUpperCase();
  let where = `WHERE e.status='PENDING'`;
  if (status === 'APPROVED') where = `WHERE e.status='APPROVED'`;
  else if (status === 'REJECTED') where = `WHERE e.status='REJECTED'`;
  else if (status === 'ALL') where = ``;

  const rows = db.prepare(`
    SELECT
      e.*,
      f.amount, f.payment_ref, f.is_paid,
      r.plate,
      lic.id AS licenseId,
      lic.license_no AS licenseNo
    FROM fine_evidence e
    JOIN fines f   ON f.id = e.fine_id
    JOIN reports r ON r.id = f.report_id
    JOIN lorries l ON l.plate = r.plate
    JOIN licenses lic ON lic.id = l.license_id
    ${where}
    ORDER BY e.created_at DESC
  `).all();

  res.json(rows);
});

/** Approve evidence -> mark fine as paid (if not already) */
router.post('/evidence/:id/approve', (req, res) => {
  const { id } = req.params;
  const ev = db.prepare(`SELECT * FROM fine_evidence WHERE id=?`).get(id);
  if (!ev) return res.status(404).json({ error: 'Evidence not found' });

  db.prepare(`UPDATE fine_evidence SET status='APPROVED' WHERE id=?`).run(id);

  const fine = db.prepare(`SELECT * FROM fines WHERE id=?`).get(ev.fine_id);
  if (fine && !fine.is_paid) {
    db.prepare('UPDATE fines SET is_paid=1, paid_via=? WHERE id=?').run('manual_review', fine.id);
    db.prepare('INSERT INTO payments (fine_id, amount, gateway_txn_id, verified) VALUES (?,?,?,?)')
      .run(fine.id, fine.amount, 'SLIP-'+Date.now(), 1);
  }

  res.json({ ok: true });
});

/** Reject evidence (fine remains unpaid) */
router.post('/evidence/:id/reject', (req, res) => {
  const { id } = req.params;
  const ev = db.prepare(`SELECT * FROM fine_evidence WHERE id=?`).get(id);
  if (!ev) return res.status(404).json({ error: 'Evidence not found' });

  db.prepare(`UPDATE fine_evidence SET status='REJECTED' WHERE id=?`).run(id);
  res.json({ ok: true });
});

export default router;
