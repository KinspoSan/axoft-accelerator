import Auth from './auth.js';
import Orders from './orders.js';

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  const profile = Auth.getProfile();

  const initials = profile.company
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const dashEl = document.getElementById('dash-company');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = profile.company;
  if (dashEl) dashEl.textContent = profile.company;

  // Dashboard stats
  const regDateEl = document.getElementById('dash-reg-date');
  if (regDateEl) regDateEl.textContent = new Date(profile.registeredAt).toLocaleDateString('ru');

  const setFields = {
    'set-company':   profile.company,
    'set-inn':       profile.inn,
    'set-email':     profile.email,
    'set-direction': profile.direction,
    'set-stage':     profile.stage,
    'set-skolkovo':  profile.skolkovo ? 'Да' : 'Нет',
    'set-reg-date':  new Date(profile.registeredAt).toLocaleDateString('ru'),
    'set-tier':      profile.tier === 'strat' ? 'UP STRAT' : 'UP BASE'
  };
  Object.entries(setFields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  await loadOrders();

  // Update dashboard orders count
  const localOrders = Orders.getLocalOrders();
  const dashCount = document.getElementById('dash-orders-count');
  if (dashCount) dashCount.textContent = localOrders.length;
});

window.handleOrder = async function(card) {
  const serviceData = {
    id:           card.dataset.serviceId,
    name:         card.dataset.serviceName,
    block:        card.dataset.serviceBlock,
    price:        parseInt(card.dataset.servicePrice),
    priceDisplay: card.dataset.servicePriceDisplay,
    paymentType:  'Счёт'
  };

  const btn = card.querySelector('.btn-order');
  if (!btn) return;
  const origText = btn.textContent;
  btn.textContent = 'Оформляем...';
  btn.disabled = true;

  try {
    await Orders.placeOrder(serviceData);
    btn.textContent = 'Заказано';
    btn.style.background = 'var(--green)';
    showToast(`Заказ «${serviceData.name}» оформлен! Менеджер свяжется с вами.`);
    await loadOrders();
  } catch (e) {
    btn.textContent = origText;
    btn.disabled = false;
    showToast(`Ошибка: ${e.message}`, 'error');
  }
};

async function loadOrders() {
  const container = document.getElementById('orders-table-container');
  if (!container) return;

  container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt2)">Загрузка заказов...</div>';

  try {
    const orders = await Orders.getAllOrders();

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:40px;margin-bottom:12px">📋</div>
          <div style="font-size:15px;font-weight:600;color:var(--navy);margin-bottom:6px">Заказов пока нет</div>
          <div style="font-size:13px;color:var(--txt2);margin-bottom:18px">Перейдите в Сервисы и оформите первый заказ.</div>
        </div>`;
      return;
    }

    const rows = orders.map(o => `
      <tr>
        <td><strong>${o.serviceName}</strong></td>
        <td>${o.block ? `<span class="pill pt">${o.block}</span>` : '—'}</td>
        <td>${o.priceDisplay || '—'}</td>
        <td>${o.paymentType || 'Счёт'}</td>
        <td><span class="stag ${Orders.getStatusClass(o.status)}">${o.statusLabel}</span></td>
        <td>${o.bitrixDealId ? `<a href="https://vibecode.bitrix24.tech/crm/deal/details/${o.bitrixDealId}/" target="_blank" class="btn btn-o" style="font-size:11px;padding:5px 10px">Bitrix #${o.bitrixDealId}</a>` : ''}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="ot">
          <thead>
            <tr>
              <th>Сервис</th><th>Блок</th><th>Стоимость</th>
              <th>Оплата</th><th>Статус</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    const badge = document.getElementById('orders-badge');
    if (badge) badge.textContent = orders.length;

  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:#c00">Ошибка загрузки заказов: ${e.message}</div>`;
  }
}

window.showToast = function(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'error' ? '#c00' : 'var(--teal)'};
    color:#fff;padding:12px 20px;border-radius:10px;
    font-family:'Golos Text',sans-serif;font-size:13px;
    box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:360px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
};

window.AuthLogout = () => Auth.logout();
