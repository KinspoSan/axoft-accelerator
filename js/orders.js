import Bitrix from './bitrix.js';
import Auth from './auth.js';

const DEAL_STAGE_MAP = {
  'NEW':                { status: 'new',    label: 'Новый' },
  'PREPARATION':        { status: 'active', label: 'В работе' },
  'PREPAYMENT_INVOICE': { status: 'review', label: 'Счёт выставлен' },
  'EXECUTING':          { status: 'active', label: 'Выполняется' },
  'FINAL_INVOICE':      { status: 'review', label: 'Финальный счёт' },
  'WON':                { status: 'done',   label: 'Завершён' },
  'LOSE':               { status: 'lost',   label: 'Отклонён' },
  'APOLOGY':            { status: 'lost',   label: 'Закрыт' },
};

const LEAD_STATUS_MAP = {
  'NEW':        { status: 'new',    label: 'Запрошено' },
  'IN_PROCESS': { status: 'active', label: 'В работе' },
  'PROCESSED':  { status: 'review', label: 'Обработан' },
  'CONVERTED':  { status: 'done',   label: 'Завершён' },
  'JUNK':       { status: 'lost',   label: 'Отклонён' },
  'FALSE':      { status: 'lost',   label: 'Отклонён' },
};

const Orders = {
  STORAGE_KEY: 'axoft_orders',

  async placeOrder(serviceData) {
    const profile = Auth.getProfile();
    if (!profile) throw new Error('Необходима авторизация');

    const order = {
      id:           Date.now(),
      serviceId:    serviceData.id,
      serviceName:  serviceData.name,
      block:        serviceData.block,
      price:        serviceData.price,
      priceDisplay: serviceData.priceDisplay,
      paymentType:  serviceData.paymentType || 'Счёт',
      status:       'new',
      statusLabel:  'Новый',
      createdAt:    new Date().toISOString()
    };

    try {
      const dealId = await Bitrix.createDeal(order, profile);
      order.bitrixDealId = dealId;
      await Bitrix.addActivity(
        profile.leadId,
        `Вендор заказал сервис: ${serviceData.name} (${serviceData.priceDisplay}). Сделка #${dealId}`
      );
    } catch (e) {
      console.warn('Bitrix недоступен, заказ сохранён локально:', e.message);
    }

    const orders = this.getLocalOrders();
    orders.unshift(order);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));

    return order;
  },

  async requestService(serviceData) {
    const profile = Auth.getProfile();
    if (!profile) throw new Error('Необходима авторизация');

    const request = {
      id:           Date.now(),
      type:         'service',
      serviceId:    serviceData.id,
      serviceName:  serviceData.name,
      block:        serviceData.block,
      price:        serviceData.price,
      priceDisplay: serviceData.priceDisplay,
      paymentType:  'По запросу',
      status:       'new',
      statusLabel:  'Запрошено',
      createdAt:    new Date().toISOString()
    };

    try {
      const leadId = await Bitrix.createServiceRequest(serviceData, profile);
      request.bitrixLeadId = leadId;
    } catch (e) {
      console.warn('Bitrix недоступен, запрос сохранён локально:', e.message);
    }

    const orders = this.getLocalOrders();
    orders.unshift(request);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));
    return request;
  },

  async getAllOrders() {
    const local = this.getLocalOrders();

    try {
      const profile  = Auth.getProfile();
      const dealIds  = local.filter(o => o.bitrixDealId).map(o => String(o.bitrixDealId));
      const leadIds  = local.filter(o => o.bitrixLeadId).map(o => String(o.bitrixLeadId));

      // Параллельно: статусы известных заказов + все сделки компании (кросс-девайс)
      const [deals, leads, allDeals] = await Promise.all([
        Bitrix.getDealsByIds(dealIds),
        Bitrix.getLeadsByIds(leadIds),
        Bitrix.getDeals(profile.company)
      ]);

      const dealMap = Object.fromEntries(deals.map(d => [String(d.ID), d]));
      const leadMap = Object.fromEntries(leads.map(l => [String(l.ID), l]));

      // Обновляем статусы локальных заказов из Bitrix
      let changed = false;
      const updated = local.map(order => {
        if (order.bitrixDealId) {
          const d = dealMap[String(order.bitrixDealId)];
          if (d) {
            const s = DEAL_STAGE_MAP[d.STAGE_ID] || { status: 'active', label: 'В работе' };
            if (order.status !== s.status || order.statusLabel !== s.label) {
              changed = true;
              return { ...order, status: s.status, statusLabel: s.label };
            }
          }
        }
        if (order.bitrixLeadId) {
          const l = leadMap[String(order.bitrixLeadId)];
          if (l) {
            const s = LEAD_STATUS_MAP[l.STATUS_ID] || { status: 'new', label: 'Запрошено' };
            if (order.status !== s.status || order.statusLabel !== s.label) {
              changed = true;
              return { ...order, status: s.status, statusLabel: s.label };
            }
          }
        }
        return order;
      });

      if (changed) localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));

      // Добавляем сделки из Bitrix, которых нет локально (другое устройство / ручная CRM-запись)
      const knownIds = new Set(updated.filter(o => o.bitrixDealId).map(o => String(o.bitrixDealId)));
      const extra = allDeals
        .filter(d => !knownIds.has(String(d.ID)))
        .map(d => {
          const s = DEAL_STAGE_MAP[d.STAGE_ID] || { status: 'active', label: 'В работе' };
          return {
            id:           d.ID,
            serviceName:  d.TITLE.replace(/^\[ЛК Сколково\]\s*/, '').split(/\s+—\s+/)[0],
            priceDisplay: parseInt(d.OPPORTUNITY) ? `${parseInt(d.OPPORTUNITY).toLocaleString('ru')} ₽` : '—',
            price:        parseInt(d.OPPORTUNITY || 0),
            status:       s.status,
            statusLabel:  s.label,
            createdAt:    d.DATE_CREATE,
            bitrixDealId: d.ID
          };
        });

      return [...updated, ...extra];

    } catch (_) {
      return local;
    }
  },

  getLocalOrders() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  getStatusClass(status) {
    const map = { new: 'sa2', active: 'sa2', review: 'sr2', done: 'sd', lost: 'sr2' };
    return map[status] || 'sa2';
  }
};

export default Orders;
