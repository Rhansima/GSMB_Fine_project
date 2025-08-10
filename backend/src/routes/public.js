import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/lorry/:plate', (req, res) => {
  const plate = req.params.plate.toUpperCase();
  const lorry = db.prepare(`
    SELECT l.plate, lic.license_no as licenseNo, lic.status, lic.owner_name as owner, lic.id as licenseId
    FROM lorries l JOIN licenses lic ON lic.id = l.license_id
    WHERE l.plate = ?
  `).get(plate);
  if (!lorry) return res.json({ found: false, valid: false });
  const valid = lorry.status === 'ACTIVE';
  res.json({ found: true, valid, lorry });
});

router.post('/report', (req, res) => {
  const { plate, location, note } = req.body;
  const stmt = db.prepare(`INSERT INTO reports (plate, location, note) VALUES (?,?,?)`);
  const info = stmt.run((plate || '').toUpperCase(), location || null, note || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

export default router;
