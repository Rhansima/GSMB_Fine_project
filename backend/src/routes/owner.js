import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(requireAuth(['OWNER']));

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// List fines for this owner (via licenses -> lorries -> reports -> fines)
router.get('/fines', (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, r.plate, lic.id as licenseId, lic.license_no as licenseNo
    FROM users u
    JOIN licenses lic ON lic.owner_user_id = u.id
    JOIN lorries l ON l.license_id = lic.id
    JOIN reports r ON r.plate = l.plate
    JOIN fines f ON f.report_id = r.id
    WHERE u.id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.userId);
  res.json(rows);
});

// (Demo) Create “checkout session” for online payment
router.post('/fines/:fineId/create-checkout', (req, res) => {
  const { fineId } = req.params;
  const fine = db.prepare(`
    SELECT f.*, r.plate, lic.id as licenseId
    FROM fines f
    JOIN reports r ON r.id=f.report_id
    JOIN lorries l ON l.plate=r.plate
    JOIN licenses lic ON lic.id=l.license_id
    WHERE f.id=? AND lic.owner_user_id=?
  `).get(fineId, req.user.userId);
  if (!fine) return res.status(404).json({ error: 'Fine not found' });
  if (fine.is_paid) return res.status(400).json({ error: 'Already paid' });

  // In production, call your gateway API here (Stripe/eZCash/bank) and store its session id.
  // For demo we just return the paymentRef and pretend this is the checkout url.
  const checkoutUrl = `https://demo-gateway.example/checkout?ref=${encodeURIComponent(fine.payment_ref)}&amount=${fine.amount}`;
  res.json({ checkoutUrl, paymentRef: fine.payment_ref, amount: fine.amount });
});

// Upload a payment slip (manual verification path)
router.post('/fines/:fineId/upload-slip', upload.single('file'), (req, res) => {
  const { fineId } = req.params;
  const note = req.body?.note || null;

  const fine = db.prepare(`
    SELECT f.*, r.plate, lic.id as licenseId
    FROM fines f
    JOIN reports r ON r.id=f.report_id
    JOIN lorries l ON l.plate=r.plate
    JOIN licenses lic ON lic.id=l.license_id
    WHERE f.id=? AND lic.owner_user_id=?
  `).get(fineId, req.user.userId);
  if (!fine) return res.status(404).json({ error: 'Fine not found' });

  if (!req.file) return res.status(400).json({ error: 'file required (form-data "file")' });

  db.prepare(`
    INSERT INTO fine_evidence (fine_id, file_path, note, uploaded_by)
    VALUES (?,?,?,?)
  `).run(fineId, `/uploads/${req.file.filename}`, note, req.user.userId);

  res.status(201).json({ ok: true });
});

export default router;
