import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import db from '../db.js';
import { Bitrix } from '../bitrix.js';
import { sendResetEmail } from '../email.js';

const router = Router();

function issueToken(vendor) {
  return jwt.sign(
    { vendorId: vendor.id, email: vendor.email, company: vendor.company },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ── Регистрация ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { company, inn, direction, stage, skolkovo, email, password } = req.body;

  if (!company || !inn || !direction || !stage || !email || !password) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  if (!/^\d{10}$/.test(inn)) {
    return res.status(400).json({ error: 'ИНН должен содержать 10 цифр' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль — минимум 8 символов' });
  }

  const exists = db.prepare('SELECT id FROM vendors WHERE email = ?').get(email.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'Компания с этим email уже зарегистрирована' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let bitrixLeadId = null;
  try {
    bitrixLeadId = await Bitrix.createLead({ company, inn, direction, stage, skolkovo, email });
  } catch (e) {
    console.warn('Bitrix lead creation failed:', e.message);
  }

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO vendors (email, password_hash, company, inn, direction, stage, skolkovo, bitrix_lead_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(email.toLowerCase(), passwordHash, company, inn, direction, stage, skolkovo ? 1 : 0, bitrixLeadId);

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(lastInsertRowid);

  if (bitrixLeadId) {
    Bitrix.addActivity(bitrixLeadId, `Компания зарегистрирована в ЛК. Email: ${email}`)
      .catch(() => {});
  }

  res.status(201).json({ token: issueToken(vendor), profile: safeProfile(vendor) });
});

// ── Вход ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const vendor = db.prepare('SELECT * FROM vendors WHERE email = ?').get(email.toLowerCase());
  if (!vendor) {
    return res.status(401).json({ error: 'Компания не найдена. Пройдите регистрацию.' });
  }

  const ok = await bcrypt.compare(password, vendor.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  res.json({ token: issueToken(vendor), profile: safeProfile(vendor) });
});

// ── Профиль ──────────────────────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    const vendor  = db.prepare('SELECT * FROM vendors WHERE id = ?').get(payload.vendorId);
    if (!vendor) return res.status(404).json({ error: 'Не найдено' });
    res.json(safeProfile(vendor));
  } catch {
    res.status(401).json({ error: 'Сессия истекла' });
  }
});

// ── Запрос сброса пароля ─────────────────────────────────────────────────────
router.post('/reset-request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Укажите email' });

  const vendor = db.prepare('SELECT id FROM vendors WHERE email = ?').get(email.toLowerCase());

  // Одинаковый ответ — не раскрываем факт регистрации
  const msg = 'Если адрес зарегистрирован, письмо отправлено';

  if (!vendor) return res.json({ message: msg });

  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();

  db.prepare('DELETE FROM password_resets WHERE email = ?').run(email.toLowerCase());
  db.prepare('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)')
    .run(email.toLowerCase(), token, expiresAt);

  const resetLink = `${process.env.APP_URL}/index.html?reset=${token}`;

  try {
    await sendResetEmail(email, resetLink);
  } catch (e) {
    console.error('Email send failed:', e.message);
    return res.status(500).json({ error: 'Не удалось отправить письмо. Попробуйте позже.' });
  }

  res.json({ message: msg });
});

// ── Подтверждение сброса пароля ───────────────────────────────────────────────
router.post('/reset-confirm', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Неверный запрос' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль — минимум 8 символов' });
  }

  const row = db.prepare(`
    SELECT * FROM password_resets
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token);

  if (!row) {
    return res.status(400).json({ error: 'Ссылка недействительна или истекла' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE vendors SET password_hash = ? WHERE email = ?')
    .run(passwordHash, row.email);
  db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?')
    .run(token);

  res.json({ message: 'Пароль изменён. Войдите с новым паролем.' });
});

function safeProfile(v) {
  return {
    id:          v.id,
    email:       v.email,
    company:     v.company,
    inn:         v.inn,
    direction:   v.direction,
    stage:       v.stage,
    skolkovo:    !!v.skolkovo,
    tier:        v.tier,
    leadId:      v.bitrix_lead_id,
    registeredAt: v.created_at,
  };
}

export default router;
