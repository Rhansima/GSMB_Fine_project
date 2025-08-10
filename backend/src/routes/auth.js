import { Router } from 'express';
import db from '../db.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare(`
    SELECT u.id, u.username, u.password, r.name as role, u.display_name as displayName
    FROM users u JOIN roles r ON r.id = u.role_id WHERE username=?
  `).get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role, displayName: user.displayName }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName } });
});

export default router;
