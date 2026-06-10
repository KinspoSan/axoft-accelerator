// Прокси для Bitrix24 Universal Lists — вебхук не попадает в браузер
import { Router } from 'express';
import { Bitrix } from '../bitrix.js';

const router = Router();

// Простой in-memory кэш (TTL 10 мин)
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expires) return Promise.resolve(hit.data);
  return fn().then(data => { cache.set(key, { data, expires: Date.now() + ttlMs }); return data; });
}

const LIST_IDS = {
  packages:        parseInt(process.env.LIST_ID_PACKAGES        || '0'),
  materials:       parseInt(process.env.LIST_ID_MATERIALS       || '0'),
  services:        parseInt(process.env.LIST_ID_SERVICES        || '0'),
  settings:        parseInt(process.env.LIST_ID_SETTINGS        || '0'),
  partnerPackages: parseInt(process.env.LIST_ID_PARTNER_PACKAGES || '0'),
};

router.get('/packages',         (_, res) => proxy(res, 'packages'));
router.get('/materials',        (_, res) => proxy(res, 'materials'));
router.get('/services',         (_, res) => proxy(res, 'services'));
router.get('/partner-packages', (_, res) => proxy(res, 'partnerPackages'));
router.get('/settings',         (_, res) => proxy(res, 'settings', 60_000));

async function proxy(res, key, ttl = 600_000) {
  const id = LIST_IDS[key];
  if (!id) return res.json([]);
  try {
    const data = await cached(`content_${key}`, ttl, () => Bitrix.getListElements(id));
    res.json(data);
  } catch (e) {
    console.error(`Content proxy error (${key}):`, e.message);
    res.status(502).json({ error: 'Контент временно недоступен' });
  }
}

export default router;
