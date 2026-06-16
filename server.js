// server.js — посредник: лендинг → этот сервис → Битрикс24.
// POST /api/lead     — лид с лендинга (email + согласие)
// POST /api/register — полная регистрация вендора (компания + смарт-процесс)

import express from 'express';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '64kb' }));

const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK;
const INBOUND_TOKEN  = process.env.INBOUND_TOKEN;
if (!BITRIX_WEBHOOK || !INBOUND_TOKEN) {
  console.error('Нужны BITRIX_WEBHOOK и INBOUND_TOKEN');
  process.exit(1);
}

// CORS — разрешаем GitHub Pages и любой localhost для разработки
const ALLOWED_ORIGINS = [
  'https://kinsposan.github.io',
  'https://kinspon8.github.io',
];
app.use((req, res, next) => {
  const origin = req.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Константы Битрикса ----------------------------------------------------
const COMPANY_ENTITY_TYPE_ID = 4;    // стандартный тип «Компания»
const REQUISITE_PRESET_ID    = 1;    // шаблон реквизитов «Юрлицо»
const VENDOR_ENTITY_TYPE_ID  = 1058; // смарт-процесс «Вендоры»
const VENDOR_CATEGORY_ID     = 47;   // воронка «Бэклог вендоров»

function authorized(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(INBOUND_TOKEN);
  // timingSafeEqual предотвращает timing-атаку: сравнение всегда занимает одно время
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function bitrix(method, params) {
  const res = await fetch(`${BITRIX_WEBHOOK}${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${data.error}: ${data.error_description}`);
  return data.result;
}

function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '');
}

function validateRegister(b) {
  const errors = [];
  if (!b.company_name?.trim()) errors.push('company_name обязателен');
  if (!/^\d{10}(\d{2})?$/.test(b.inn || '')) errors.push('inn: ожидаются 10 или 12 цифр');
  if (!validateEmail(b.email)) errors.push('email некорректен');
  if (!b.direction?.trim()) errors.push('direction обязателен');
  if (!b.product_name?.trim()) errors.push('product_name обязателен');
  if (b.product_url && !/^https?:\/\//i.test(b.product_url)) errors.push('product_url: нужен http(s)-адрес');
  if (b.presentation_url && !/^https?:\/\//i.test(b.presentation_url)) errors.push('presentation_url: нужен http(s)-адрес');
  return errors;
}

// ── POST /api/lead — лид с лендинга ─────────────────────────────────────────
app.post('/api/lead', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const email = (req.body.email || '').trim().toLowerCase();
  if (!validateEmail(email)) return res.status(400).json({ ok: false, error: 'email некорректен' });

  try {
    const leadId = await bitrix('crm.lead.add', {
      fields: {
        TITLE:       `[Лендинг UP] ${email}`,
        EMAIL:       [{ VALUE: email, VALUE_TYPE: 'WORK' }],
        SOURCE_ID:   'WEB',
        STATUS_ID:   'NEW',
        COMMENTS:    `Источник: лендинг Axoft × Сколково\nДата: ${new Date().toLocaleString('ru')}`,
        ASSIGNED_BY_ID: 1,
      },
    });
    return res.status(201).json({ ok: true, leadId });
  } catch (e) {
    console.error('[bitrix/lead]', e.message);
    return res.status(502).json({ ok: false, error: 'bitrix_error' });
  }
});

// ── POST /api/register — регистрация вендора ─────────────────────────────────
app.post('/api/register', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const errors = validateRegister(req.body);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const {
    company_name, inn, email,
    direction, product_name, product_url, presentation_url,
  } = req.body;

  try {
    let companyId;
    // Дедупликация по ИНН: ищем через реквизиты, а не по названию компании —
    // название могут написать по-разному, ИНН уникален
    const found = await bitrix('crm.requisite.list', {
      filter: { RQ_INN: inn, ENTITY_TYPE_ID: COMPANY_ENTITY_TYPE_ID },
      select: ['ENTITY_ID'],
    });

    if (found.length) {
      companyId = found[0].ENTITY_ID;
    } else {
      companyId = await bitrix('crm.company.add', {
        fields: {
          TITLE: company_name,
          COMPANY_TYPE: 'PARTNER',
          EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
          UTM_SOURCE: 'vendor-webhook',
          COMMENTS: 'Источник: лендинг вендоров (webhook)',
          OPENED: 'Y',
          ASSIGNED_BY_ID: 1,
        },
        // REGISTER_SONET_EVENT создаёт уведомление в ленте Bitrix24 при появлении компании
        params: { REGISTER_SONET_EVENT: 'Y' },
      });

      await bitrix('crm.requisite.add', {
        fields: {
          ENTITY_TYPE_ID: COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyId,
          PRESET_ID: REQUISITE_PRESET_ID,
          NAME: company_name,
          RQ_INN: inn,
          RQ_COMPANY_NAME: company_name,
        },
      });
    }

    // Не создаём вторую карточку вендора, если компания уже проходила регистрацию
    const existing = await bitrix('crm.item.list', {
      entityTypeId: VENDOR_ENTITY_TYPE_ID,
      filter: { companyId },
      select: ['id'],
    });
    if (existing.items?.length) {
      // 200, а не 201: ничего нового не создано
      return res.status(200).json({
        ok: true, duplicate: true,
        companyId, vendorId: existing.items[0].id,
      });
    }

    const added = await bitrix('crm.item.add', {
      entityTypeId: VENDOR_ENTITY_TYPE_ID,
      fields: {
        title: company_name,
        companyId,
        categoryId: VENDOR_CATEGORY_ID,

        // Продуктовые поля зальём позже импортом — коды полей подставим тогда.
        // ufCrm_DIRECTION: direction,
        // ufCrm_PRODUCT: product_name,
        // ufCrm_URL: product_url || '',
        // ufCrm_PRESENTATION: presentation_url || '',
      },
    });

    return res.status(201).json({ ok: true, companyId, vendorId: added.item.id });
  } catch (e) {
    console.error('[bitrix]', e.message);
    return res.status(502).json({ ok: false, error: 'bitrix_error' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Webhook слушает порт', process.env.PORT || 3000);
});
