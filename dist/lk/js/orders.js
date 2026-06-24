const Orders = {
  async getAllOrders() {
    const res = await fetch('/api/orders', { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось загрузить заказы');
    return data.orders || [];
  },

  async placeOrder(serviceData) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: serviceData.name, priceDisplay: serviceData.priceDisplay }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось оформить заказ');
    return data.order;
  },

  async requestService(serviceData) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: serviceData.name, priceDisplay: serviceData.priceDisplay }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Не удалось оформить запрос');
    return data.order;
  },

  getStatusClass(status) {
    const map = { new: 'sa2', active: 'sa2', review: 'sr2', done: 'sd', lost: 'sr2' };
    return map[status] || 'sa2';
  }
};

export default Orders;
