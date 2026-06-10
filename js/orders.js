// Заказы через REST API сервера (ветка backend-api)
import Auth from './auth.js';

const API = '/api/orders';

const Orders = {

  async placeOrder(serviceData) {
    return this._request('POST', API, serviceData);
  },

  async requestService(serviceData) {
    return this._request('POST', API, { ...serviceData, paymentType: 'По запросу' });
  },

  async getAllOrders() {
    return this._request('GET', API);
  },

  getLocalOrders() {
    return [];
  },

  getStatusClass(status) {
    return { new: 'sa2', active: 'sa2', review: 'sr2', done: 'sd' }[status] || 'sa2';
  },

  async _request(method, url, body) {
    const token = Auth.getToken();
    if (!token) throw new Error('Необходима авторизация');

    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res  = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
    return data;
  },
};

export default Orders;
