import Bitrix from './bitrix.js';
import Auth from './auth.js';

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

  async getAllOrders() {
    const local = this.getLocalOrders();
    try {
      const profile = Auth.getProfile();
      const bitrixDeals = await Bitrix.getDeals(profile.email);
      const bitrixOrders = bitrixDeals
        .filter(d => !local.find(o => o.bitrixDealId == d.ID))
        .map(d => ({
          id:           d.ID,
          serviceName:  d.TITLE.replace(/^\[ЛК Сколково\] /, '').split(' — ')[0],
          priceDisplay: `${parseInt(d.OPPORTUNITY || 0).toLocaleString('ru')} ₽`,
          price:        parseInt(d.OPPORTUNITY || 0),
          status:       d.STAGE_ID === 'WON' ? 'done' : 'active',
          statusLabel:  d.STAGE_ID === 'WON' ? 'Завершён' : 'В работе',
          createdAt:    d.DATE_CREATE,
          bitrixDealId: d.ID
        }));
      return [...local, ...bitrixOrders];
    } catch (e) {
      return local;
    }
  },

  getLocalOrders() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  getStatusClass(status) {
    const map = { new: 'sa2', active: 'sa2', review: 'sr2', done: 'sd' };
    return map[status] || 'sa2';
  }
};

export default Orders;
