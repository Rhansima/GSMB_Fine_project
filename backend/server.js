import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import db from './src/db.js';
import authRouter from './src/routes/auth.js';
import publicRouter from './src/routes/public.js';
import officerRouter from './src/routes/officer.js';
import gsmbRouter from './src/routes/gsmb.js';
import ownerRouter from './src/routes/owner.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/uploads', express.static('uploads')); // serve uploaded slips
app.get('/api/health', (req,res)=>res.json({ok:true}));

app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/officer', officerRouter);
app.use('/api/gsmb', gsmbRouter);
app.use('/api/owner', ownerRouter);

app.use((err, req, res, next) => {
  console.error('ERR:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
