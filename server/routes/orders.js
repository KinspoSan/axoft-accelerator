import { Router } from 'express';
import db from '../db.js';
import { Bitrix } from '../bitrix.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const STATUS_CLASS = { new: 'sa2', active: 'sa2', review: 'sr2', done: 'sd' };

// ── Список заказов ────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const orders = db.prepare(
    'SELECT * FROM orders WHERE vendor_id = ? ORDER BY created_at DESC'
  ).all(req.vendor.vendorId);

  res.json(orders.map(toClient));
});

// ── Оформить заказ ────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { serviceId, serviceName, block, price, priceDisplay, paymentType } = req.body;
  if (!serviceName) return res.status(400).json({ error: 'Укажите название сервиса' });

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.vendor.vendorId);

  let bitrixDealId = null;
  try {
    bitrixDealId = await Bitrix.createDeal(
      { serviceName, block, price, priceDisplay, paymentType: paymentType || 'Счёт' },
      { company: vendor.company, inn: vendor.inn, email: vendor.email,
        tier: vendor.tier, bitrixLeadId: vendor.bitrix_lead_id }
    );
    if (vendor.bitrix_lead_id) {
      Bitrix.addActivity(vendor.bitrix_lead_id,
        `Заказан сервис: ${serviceName} (${priceDisplay}). Сделка #${bitrixDealId}`
      ).catch(() => {});
    }
  } catch (e) {
    console.warn('Bitrix deal creation failed:', e.message);
  }

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO orders
      (vendor_id, service_id, service_name, block, price, price_display, payment_type, bitrix_deal_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(vendor.id, serviceId || null, serviceName, block || null,
         price || 0, priceDisplay || null, paymentType || 'Счёт', bitrixDealId);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(lastInsertRowid);
  res.status(201).json(toClient(order));
});

function toClient(o) {
  return {
    id:            o.id,
    serviceId:     o.service_id,
    serviceName:   o.service_name,
    block:         o.block,
    price:         o.price,
    priceDisplay:  o.price_display,
    paymentType:   o.payment_type,
    status:        o.status,
    statusLabel:   o.status_label,
    bitrixDealId:  o.bitrix_deal_id,
    bitrixLeadId:  o.bitrix_lead_id,
    createdAt:     o.created_at,
    statusClass:   STATUS_CLASS[o.status] || 'sa2',
  };
}

export default router;
