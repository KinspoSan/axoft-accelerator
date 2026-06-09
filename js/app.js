import Auth from './auth.js';
import Orders from './orders.js';
import Content from './content.js';

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
  await renderPackages();
  await renderMaterials();
  await renderServices();
  await renderPartnerPackages();

  // Update dashboard orders count
  const localOrders = Orders.getLocalOrders();
  const dashCount = document.getElementById('dash-orders-count');
  if (dashCount) dashCount.textContent = localOrders.length;
});

window.handleOrder = async function(card) {
  const isServiceCard = card.classList.contains('svc-card');

  const serviceData = {
    id:           card.dataset.serviceId,
    name:         card.dataset.serviceName,
    block:        card.dataset.serviceBlock,
    price:        parseInt(card.dataset.servicePrice),
    priceDisplay: card.dataset.servicePriceDisplay,
    paymentType:  isServiceCard ? 'По запросу' : 'Счёт'
  };

  const btn = card.querySelector('.btn-order');
  if (!btn) return;
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-loader" style="font-size:12px;animation:spin .8s linear infinite"></i> Отправляем...';
  btn.disabled = true;

  try {
    if (isServiceCard) {
      await Orders.requestService(serviceData);
      btn.innerHTML = '<i class="ti ti-check" style="font-size:12px"></i> Запрошено';
      btn.style.background = 'var(--green)';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      showToast(`Запрос на «${serviceData.name}» отправлен. Менеджер свяжется по email.`);
    } else {
      await Orders.placeOrder(serviceData);
      btn.innerHTML = '<i class="ti ti-check" style="font-size:13px"></i> Заказано';
      btn.style.background = 'var(--green)';
      showToast(`Заказ «${serviceData.name}» оформлен! Менеджер свяжется с вами.`);
    }
    await loadOrders();
  } catch (e) {
    btn.innerHTML = origHtml;
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
        <td>
          ${o.bitrixDealId
            ? `<a href="https://axoft.bitrix24.ru/crm/deal/details/${o.bitrixDealId}/" target="_blank" class="btn btn-o" style="font-size:11px;padding:5px 10px">Сделка #${o.bitrixDealId}</a>`
            : o.bitrixLeadId
            ? `<a href="https://axoft.bitrix24.ru/crm/lead/details/${o.bitrixLeadId}/" target="_blank" class="btn btn-o" style="font-size:11px;padding:5px 10px">Лид #${o.bitrixLeadId}</a>`
            : ''}
        </td>
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

// ── Packages ─────────────────────────────────────────────────────────────────

async function renderPackages() {
  const grid = document.getElementById('packages-grid');
  if (!grid) return;

  try {
    const packages = await Content.getPackages();
    grid.innerHTML = packages.map(buildPackageCard).join('');
  } catch (e) {
    grid.innerHTML = `<div style="padding:20px;color:#c00">Ошибка загрузки пакетов: ${e.message}</div>`;
  }
}

function buildPackageCard(pkg) {
  const colors = {
    green: { dim: 'var(--gdim)', accent: 'var(--green)', dot: 'g' },
    teal:  { dim: 'var(--tdim)', accent: 'var(--teal)',  dot: '' },
    blue:  { dim: 'var(--bdim)', accent: 'var(--blue)',  dot: 'b' }
  };
  const c = colors[pkg.color] || colors.teal;

  const dots = [1, 2, 3].map(i => {
    const on = i <= pkg.engagementLevel;
    return `<div class="pkg-eng-dot ${on ? 'on' + (c.dot ? ' ' + c.dot : '') : 'off'}"></div>`;
  }).join('');

  const items = pkg.items.map(it =>
    `<div class="pkg-li"><i class="ti ${it.icon}" style="color:${c.accent}"></i>${it.text}</div>`
  ).join('');

  const btn = pkg.buttonType === 'diag'
    ? `<button class="btn btn-p" style="flex:1;background:var(--green);border:none;" onclick="goPage('diag')">
         <i class="ti ti-stethoscope" style="font-size:13px"></i>Пройти диагностику
       </button>`
    : `<button class="btn btn-p btn-order" style="flex:1;" onclick="handleOrder(this.closest('.pkg'))">
         <i class="ti ti-send" style="font-size:13px"></i>Заказать${pkg.name === 'Аудит' ? ' аудит' : ''}
       </button>`;

  return `
    <div class="pkg" data-pkg="p${pkg.number}"
      data-service-id="${pkg.id}"
      data-service-name="Пакет ${pkg.name}"
      data-service-block="${pkg.name}"
      data-service-price="${pkg.price}"
      data-service-price-display="${pkg.priceDisplay}">
      <div class="pkg-h">
        <span class="pkg-badge" style="background:${c.dim};color:${c.accent}">Пакет ${pkg.number}</span>
        <div class="pkg-tt">${pkg.name}</div>
        <div class="pkg-goal">${pkg.goal}</div>
        <div class="pkg-price${pkg.price === 0 ? ' fr' : ''}" ${pkg.price > 0 ? 'style="color:var(--navy)"' : ''}>${pkg.priceDisplay}</div>
      </div>
      <div class="pkg-eng">
        <div class="pkg-eng-dots">${dots}</div>
        <span>Вовлечённость Axoft: ${pkg.engagement}</span>
      </div>
      <div class="pkg-b">
        <div class="pkg-sec-lbl">Что входит</div>
        ${items}
        <div class="pkg-res"><strong>Результат:</strong> ${pkg.result}</div>
      </div>
      <div class="pkg-ft">${btn}</div>
    </div>`;
}

// Фильтр пакетов (вызывается из HTML)
window.fltPkg = function(btn, pkg) {
  document.querySelectorAll('#packages-grid .pkg').forEach(c => {
    c.style.display = (pkg === 'all' || c.dataset.pkg === pkg) ? '' : 'none';
  });
  document.querySelectorAll('.fb.pkg-filters').forEach(b => b.classList.remove('fa'));
  btn.classList.add('fa');
};

// ── Materials ─────────────────────────────────────────────────────────────────

async function renderMaterials() {
  const grid = document.getElementById('materials-grid');
  if (!grid) return;

  try {
    const materials = await Content.getMaterials();
    grid.innerHTML = materials.length
      ? materials.map(buildMaterialCard).join('')
      : '<div style="padding:40px 20px;text-align:center;color:var(--txt2)">Материалы скоро появятся</div>';

    // Обновить счётчик в навигации
    const badge = document.getElementById('materials-badge');
    if (badge) badge.textContent = materials.filter(m => m.fileUrl).length || '';
  } catch (e) {
    grid.innerHTML = `<div style="padding:20px;color:#c00">Ошибка загрузки материалов: ${e.message}</div>`;
  }
}

function buildMaterialCard(mat) {
  const typeIcons = {
    video:     'ti-video',
    doc:       'ti-file-text',
    case:      'ti-news',
    checklist: 'ti-list-check'
  };
  const pkgColors = {
    diag:  'var(--green)',
    audit: 'var(--teal)',
    pack:  'var(--blue)',
    all:   'var(--navy)'
  };

  const icon  = typeIcons[mat.type] || 'ti-file';
  const color = pkgColors[mat.pkg]  || 'var(--teal)';

  const actionBtn = mat.fileUrl
    ? `<a href="${mat.fileUrl}" target="_blank" class="btn btn-o" style="font-size:12px;white-space:nowrap">
         <i class="ti ti-download" style="font-size:12px"></i>Скачать
       </a>`
    : `<span style="font-size:11px;color:var(--txt3);padding:4px 8px">Скоро</span>`;

  const duration = mat.duration
    ? `<span class="pill" style="background:var(--sur2);color:var(--txt2)">${mat.duration}</span>`
    : '';

  return `
    <div class="mat-card" data-pkg="${mat.pkg}">
      <div class="mat-icon"><i class="ti ${icon}" style="color:${color};font-size:22px"></i></div>
      <div class="mat-body">
        <div class="mat-name">${mat.name}</div>
        ${mat.description ? `<div class="mat-desc">${mat.description}</div>` : ''}
        <div class="mat-meta">
          <span class="pill pt">${mat.pkgLabel}</span>
          <span class="pill" style="background:var(--sur2);color:var(--txt2)">${mat.typeLabel}</span>
          ${duration}
        </div>
      </div>
      <div class="mat-action">${actionBtn}</div>
    </div>`;
}

// Фильтр материалов (вызывается из HTML)
window.fltMat = function(btn, pkg) {
  document.querySelectorAll('#materials-grid .mat-card').forEach(c => {
    c.style.display = (pkg === 'all' || c.dataset.pkg === pkg) ? '' : 'none';
  });
  document.querySelectorAll('.fb.mat-filters').forEach(b => b.classList.remove('fa'));
  btn.classList.add('fa');
};

// ── Services à la carte ───────────────────────────────────────────────────────

// Переключение вкладок Пакеты / Партнёрская программа / Услуги
window.switchSvcTab = function(tab) {
  document.getElementById('svc-pkgs-section').style.display     = tab === 'pkgs'    ? '' : 'none';
  document.getElementById('svc-partner-section').style.display  = tab === 'partner' ? '' : 'none';
  document.getElementById('svc-svcs-section').style.display     = tab === 'svcs'    ? '' : 'none';
  document.getElementById('tab-pkgs').classList.toggle('active',    tab === 'pkgs');
  document.getElementById('tab-partner').classList.toggle('active', tab === 'partner');
  document.getElementById('tab-svcs').classList.toggle('active',    tab === 'svcs');
};

async function renderServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  try {
    const services = await Content.getServices();
    const standalone = services.filter(s => s.standalone);
    grid.innerHTML = standalone.length
      ? standalone.map(buildServiceCard).join('')
      : '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--txt2)">Услуги скоро появятся</div>';
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#c00">Ошибка загрузки: ${e.message}</div>`;
  }
}

function buildServiceCard(svc) {
  const pkgColors = {
    diag:  'var(--green)',
    audit: 'var(--teal)',
    pack:  'var(--blue)'
  };
  const color = pkgColors[svc.pkg] || 'var(--teal)';

  const priceClass = svc.price === 0 && svc.priceText === 'Бесплатно' ? 'free'
    : svc.priceText === 'По запросу' ? 'on-req' : '';

  return `
    <div class="svc-card" data-pkg="${svc.pkg}"
      data-service-id="${svc.id}"
      data-service-name="${svc.name}"
      data-service-block="${svc.pkgLabel}"
      data-service-price="${svc.price}"
      data-service-price-display="${svc.priceText}">
      <div class="svc-card-head">
        <div class="svc-card-ic">
          <i class="ti ${svc.icon}" style="color:${color};font-size:18px"></i>
        </div>
        <div class="svc-card-name">${svc.name}</div>
      </div>
      ${svc.pkgLabel ? `<div class="svc-card-pkg"><span class="pill pt">${svc.pkgLabel}</span></div>` : ''}
      <div class="svc-card-desc">${svc.description}</div>
      <div class="svc-card-foot">
        <span class="svc-price ${priceClass}">${svc.priceText}</span>
        <button class="btn btn-o btn-order" style="font-size:12px;padding:6px 14px"
          onclick="handleOrder(this.closest('.svc-card'))">
          <i class="ti ti-send" style="font-size:12px"></i>Запросить
        </button>
      </div>
    </div>`;
}

// ── Partner packages ──────────────────────────────────────────────────────────

async function renderPartnerPackages() {
  const grid = document.getElementById('partner-grid');
  if (!grid) return;
  try {
    const packages = await Content.getPartnerPackages();
    grid.innerHTML = packages.map(buildPartnerCard).join('');
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#c00">Ошибка: ${e.message}</div>`;
  }
}

function buildPartnerCard(pp) {
  const tierColors = {
    start:   { accent: 'var(--teal)',  dim: 'rgba(0,176,189,.12)' },
    pro:     { accent: 'var(--blue)',  dim: 'rgba(0,174,239,.12)' },
    premium: { accent: 'var(--green)', dim: 'rgba(0,179,125,.12)' }
  };
  const c = tierColors[pp.tier] || tierColors.pro;

  const items = pp.items.map(it => `
    <div class="pkg-li">
      <i class="ti ${it.icon}" style="color:${c.accent}"></i>
      <span>${it.text}</span>
    </div>`).join('');

  const recommendedBadge = pp.recommended
    ? `<span style="position:absolute;top:14px;right:14px;background:${c.accent};color:#fff;
         font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">Рекомендуем</span>`
    : '';

  return `
    <div class="pkg" style="position:relative;"
      data-service-id="${pp.id}"
      data-service-name="Партнёрская программа: ${pp.badge}"
      data-service-block="Партнёрская программа"
      data-service-price="0"
      data-service-price-display="${pp.priceDisplay}">
      ${recommendedBadge}
      <div class="pkg-h">
        <span class="pkg-badge" style="background:${c.dim};color:${c.accent}">${pp.badge}</span>
        <div class="pkg-tt">${pp.name}</div>
        <div class="pkg-goal">${pp.subtitle}</div>
        <div class="pkg-price" style="color:var(--txt2);font-size:14px;font-weight:600;">
          <i class="ti ti-clock" style="font-size:12px;margin-right:4px;"></i>${pp.timeline}
        </div>
      </div>
      <div class="pkg-eng" style="background:var(--sur2);">
        <i class="ti ti-git-branch" style="color:${c.accent};font-size:14px;flex-shrink:0;"></i>
        <span>Результат: готовые документы к передаче партнёрам</span>
      </div>
      <div class="pkg-b">
        <div class="pkg-sec-lbl">Что входит</div>
        ${items}
        <div class="pkg-res"><strong>Итог:</strong> ${pp.result}</div>
      </div>
      <div class="pkg-ft">
        <button class="btn btn-p btn-order" style="flex:1;background:${c.accent};border:none;"
          onclick="handleOrder(this.closest('.pkg'))">
          <i class="ti ti-send" style="font-size:13px"></i>Запросить
        </button>
      </div>
    </div>`;
}

// Фильтр услуг (вызывается из HTML)
window.fltSvc = function(btn, pkg) {
  document.querySelectorAll('#services-grid .svc-card').forEach(c => {
    c.style.display = (pkg === 'all' || c.dataset.pkg === pkg) ? '' : 'none';
  });
  document.querySelectorAll('.fb.svc-filters').forEach(b => b.classList.remove('fa'));
  btn.classList.add('fa');
};
