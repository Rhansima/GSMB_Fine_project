import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.use(requireAuth(['POLICE']));

router.get('/reports', (req, res) => {
  const rows = db.prepare(`SELECT * FROM reports WHERE status IN ('OPEN','CHECKED','FINED') ORDER BY created_at DESC`).all();
  res.json(rows);
});

router.post('/reports/:id/check', (req, res) => {
  const { id } = req.params;
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(id);
  if (!report) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE reports SET status=?, officer_id=? WHERE id=?').run('CHECKED', req.user.userId, id);
  res.json({ ok: true });
});

router.post('/reports/:id/fine', (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const lorry = db.prepare(`SELECT l.id, l.plate, lic.id as license_id FROM lorries l JOIN licenses lic ON lic.id=l.license_id WHERE l.plate=?`).get(report.plate);
  const paymentRef = `FINE-${id}-${Math.floor(100000+Math.random()*900000)}`;
  db.prepare(`INSERT INTO fines (report_id, amount, reason, payment_ref) VALUES (?,?,?,?)`).run(id, amount, reason || 'Violation', paymentRef);
  if (lorry) {
    db.prepare(`UPDATE licenses SET status='SUSPENDED' WHERE id=?`).run(lorry.license_id);
  }
  db.prepare('UPDATE reports SET status=? WHERE id=?').run('FINED', id);
  res.status(201).json({ paymentRef, licenseId: lorry?.license_id });
});

router.post('/fines/:id/mark-paid', (req, res) => {
  const { id } = req.params;
  const fine = db.prepare('SELECT * FROM fines WHERE id=?').get(id);
  if (!fine) return res.status(404).json({ error: 'Fine not found' });
  db.prepare('UPDATE fines SET is_paid=1, paid_via=? WHERE id=?').run('manual', id);
  db.prepare('INSERT INTO payments (fine_id, amount, gateway_txn_id, verified) VALUES (?,?,?,?)')
    .run(id, fine.amount, 'MANUAL-'+Date.now(), 1);
  res.json({ ok: true });
});

export default router;
