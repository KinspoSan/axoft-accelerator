// server.js — посредник: лендинг подрядчика → этот сервис → Битрикс24.
// Создаёт компанию + реквизит (ИНН в блоке «Организация») + связанную
// карточку вендора в смарт-процессе. Защита — общий секрет в заголовке.

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

function validate(b) {
  const errors = [];
  if (!b.company_name?.trim()) errors.push('company_name обязателен');
  if (!/^\d{10}(\d{2})?$/.test(b.inn || '')) errors.push('inn: ожидаются 10 или 12 цифр');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '')) errors.push('email некорректен');
  if (!b.direction?.trim()) errors.push('direction обязателен');
  if (!b.product_name?.trim()) errors.push('product_name обязателен');
  if (b.product_url && !/^https?:\/\//i.test(b.product_url)) errors.push('product_url: нужен http(s)-адрес');
  if (b.presentation_url && !/^https?:\/\//i.test(b.presentation_url)) errors.push('presentation_url: нужен http(s)-адрес');
  return errors;
}

app.post('/api/register', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const {
    company_name, inn, email,
    direction, product_name, product_url, presentation_url,
  } = req.body;

  try {
    let companyId;
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

    const existing = await bitrix('crm.item.list', {
      entityTypeId: VENDOR_ENTITY_TYPE_ID,
      filter: { companyId },
      select: ['id'],
    });
    if (existing.items?.length) {
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
        // Пока закомментированы, чтобы Битрикс не отклонял запрос.
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
