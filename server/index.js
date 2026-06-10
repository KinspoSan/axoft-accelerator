import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter    from './routes/auth.js';
import ordersRouter  from './routes/orders.js';
import contentRouter from './routes/content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Статические файлы (HTML/CSS/JS) из корня репозитория
app.use(express.static(join(__dirname, '..')));

// Rate limiting на auth-эндпоинты
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: { error: 'Слишком много запросов, подождите 15 минут' },
});
app.use('/api/auth', authLimiter);

app.use('/api/auth',    authRouter);
app.use('/api/orders',  ordersRouter);
app.use('/api/content', contentRouter);

// SPA fallback
app.get('*', (_, res) => res.sendFile(join(__dirname, '..', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Axoft LK server → http://localhost:${PORT}`));
