// mock-server.mjs — локальный сервер для тестирования Skolkovo course
// Раздаёт dist/lk/ как статику + мокает /api/modules, /api/modules/video, /api/modules/test

import http from 'node:http';
import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../dist/lk');
const PORT = 3737;

// Прогресс в памяти: {moduleKey: {video_watched, test_passed, score, total}}
const progress = {};

const MODULES = [
  {
    key: 'market',
    title: 'Модуль 1. Рынок и профиль клиента',
    video: '/test-video.mp4',
    questions: [
      { id: 'q1', text: 'Что такое TAM?', multiple: false,
        options: { a: 'Total Addressable Market', b: 'Target Audience Map', c: 'Tech Adoption Model' } },
      { id: 'q2', text: 'Какие методы сегментации рынка вы знаете?', multiple: true,
        options: { a: 'Демографическая', b: 'Поведенческая', c: 'Психографическая', d: 'Финансовая' } },
    ],
  },
  {
    key: 'value',
    title: 'Модуль 2. Ценностное предложение',
    video: '/test-video.mp4',
    questions: [
      { id: 'q1', text: 'Что входит в Value Proposition Canvas?', multiple: false,
        options: { a: 'Боли и выгоды клиента', b: 'Финансовые показатели', c: 'Команда стартапа' } },
    ],
  },
  {
    key: 'biz',
    title: 'Модуль 3. Бизнес-модель',
    video: '/test-video.mp4',
    questions: [
      { id: 'q1', text: 'Из скольких блоков состоит Business Model Canvas?', multiple: false,
        options: { a: '7', b: '9', c: '12' } },
    ],
  },
  {
    key: 'roadmap',
    title: 'Модуль 4. Дорожная карта и масштабирование',
    video: '/test-video.mp4',
    questions: [
      { id: 'q1', text: 'Что такое product-market fit?', multiple: false,
        options: { a: 'Соответствие продукта рынку', b: 'Маркетинговый бюджет', c: 'Модель монетизации' } },
    ],
  },
];

// Правильные ответы (не отдаются клиенту)
const CORRECT = {
  market:  { q1: 'a', q2: ['a','b','c'] },
  value:   { q1: 'a' },
  biz:     { q1: 'b' },
  roadmap: { q1: 'a' },
};

function mime(ext) {
  return { '.html':'text/html;charset=utf-8', '.js':'application/javascript',
    '.css':'text/css', '.mp4':'video/mp4', '.ico':'image/x-icon' }[ext] || 'application/octet-stream';
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = '';
    req.on('data', d => buf += d);
    req.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  // ── API ──────────────────────────────────────────────────────────────────

  if (pathname === '/api/test/reset-progress' && req.method === 'POST') {
    Object.keys(progress).forEach(k => delete progress[k]);
    return json(res, { ok: true });
  }

  if (pathname === '/api/profile' && req.method === 'GET') {
    return json(res, {
      ok: true,
      profile: {
        company_name: 'ООО Тест Сколково',
        email: 'test@company.ru',
        inn: '7712345678',
        tier: 'base',
        direction: 'ИИ — ML/AI для B2B',
        stage: 'Стартап (до 3 лет), есть MVP',
        skolkovo: true,
        created_at: '2026-01-01T00:00:00.000Z',
      }
    });
  }

  if (pathname === '/api/modules' && req.method === 'GET') {
    const modules = MODULES.map(m => ({
      ...m,
      progress: progress[m.key] || { video_watched: false, test_passed: false, score: 0, total: m.questions.length },
    }));
    return json(res, { ok: true, modules });
  }

  if (pathname === '/api/modules/video' && req.method === 'POST') {
    const { module: key } = await readBody(req);
    if (!MODULES.find(m => m.key === key)) return json(res, { ok: false, error: 'not found' }, 404);
    if (!progress[key]) progress[key] = { video_watched: false, test_passed: false, score: 0, total: 0 };
    progress[key].video_watched = true;
    return json(res, { ok: true });
  }

  if (pathname === '/api/modules/test' && req.method === 'POST') {
    const { module: key, answers } = await readBody(req);
    const mod = MODULES.find(m => m.key === key);
    if (!mod) return json(res, { ok: false, error: 'not found' }, 404);
    const correct = CORRECT[key];
    let score = 0;
    const results = {};
    mod.questions.forEach(q => {
      const given  = answers[q.id];
      const right  = correct[q.id];
      let pass;
      if (Array.isArray(right)) {
        const givenArr = (Array.isArray(given) ? given : [given]).sort();
        pass = JSON.stringify(givenArr) === JSON.stringify([...right].sort());
      } else {
        pass = (Array.isArray(given) ? given[0] : given) === right;
      }
      results[q.id] = pass;
      if (pass) score++;
    });
    const total = mod.questions.length;
    const passed = score === total;
    if (!progress[key]) progress[key] = { video_watched: true, test_passed: false, score: 0, total };
    if (passed) { progress[key].test_passed = true; progress[key].score = score; progress[key].total = total; }
    return json(res, { ok: true, score, total, passed, results });
  }

  // ── Статика ───────────────────────────────────────────────────────────────
  // Заглушка для видео (пустой файл)
  if (pathname === '/test-video.mp4') {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': '0' });
    return res.end();
  }

  let filePath = path.join(ROOT, pathname === '/' ? 'cabinet.html' : pathname);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime(path.extname(filePath)) });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`mock-server: http://localhost:${PORT}`));
