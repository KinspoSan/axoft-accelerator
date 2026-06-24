import Auth from './auth.js';
import Orders from './orders.js';
import Content from './content.js';

// ── Notify module ─────────────────────────────────────────────────────────────
const Notify = {
  STORAGE: 'axoft_notifications',
  add(type, title, message) {
    const list = this.getAll();
    list.unshift({ id: Date.now(), type, title, message, ts: new Date().toISOString(), read: false });
    localStorage.setItem(this.STORAGE, JSON.stringify(list.slice(0, 50)));
    this.updateBadge();
  },
  getAll() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE) || '[]'); } catch { return []; }
  },
  markAllRead() {
    const list = this.getAll().map(n => ({ ...n, read: true }));
    localStorage.setItem(this.STORAGE, JSON.stringify(list));
    this.updateBadge();
  },
  clear() {
    localStorage.removeItem(this.STORAGE);
    this.updateBadge();
  },
  updateBadge() {
    const count = this.getAll().filter(n => !n.read).length;
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
};
window.Notify = Notify;

// Экранирование HTML — применять ко всем данным из Bitrix/localStorage перед вставкой в innerHTML
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Версия кэша — при изменении сбрасывает устаревшие данные у всех пользователей
const CACHE_VERSION = '2';
const CACHE_VER_KEY = 'axoft_cache_ver';
if (localStorage.getItem(CACHE_VER_KEY) !== CACHE_VERSION) {
  Content.clearCache();
  localStorage.setItem(CACHE_VER_KEY, CACHE_VERSION);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await Auth.ensure())) {
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
    'set-tier':      profile.tier === 'strat' ? 'Стратегический' : 'Базовый'
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
  const dashCount = document.getElementById('dash-orders-count');
  if (dashCount) {
    Orders.getAllOrders()
      .then(orders => { dashCount.textContent = orders.length; })
      .catch(() => { dashCount.textContent = '0'; });
  }

  // Notification badge on load
  Notify.updateBadge();

  // Onboarding tour
  maybeStartTour();
});

const _orderInFlight = new Set(); // глобальная защита от параллельных запросов

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

  // Блокируем повторный клик по этой же услуге пока запрос в полёте
  const key = serviceData.name || card.dataset.serviceId;
  if (_orderInFlight.has(key)) return;
  _orderInFlight.add(key);

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
      Notify.add('request', 'Запрос отправлен', `«${serviceData.name}» — менеджер свяжется по email`);
    } else {
      const order = await Orders.placeOrder(serviceData);
      btn.innerHTML = '<i class="ti ti-check" style="font-size:13px"></i> Заказано';
      btn.style.background = 'var(--green)';
      const msg = order.duplicate
        ? `Заказ «${serviceData.name}» уже существует. Менеджер свяжется с вами.`
        : `Заказ «${serviceData.name}» оформлен! Менеджер свяжется с вами.`;
      showToast(msg);
      Notify.add('order', 'Заказ оформлен', `«${serviceData.name}» — менеджер свяжется по email`);
    }
    await loadOrders();
  } catch (e) {
    btn.innerHTML = origHtml;
    btn.disabled = false;
    showToast(`Ошибка: ${e.message}`, 'error');
  } finally {
    _orderInFlight.delete(key);
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

    const rows = orders.map(o => {
      // Бэкенд возвращает name (полный заголовок сделки вида "Заказ услуги: XXX")
      // Показываем без префикса для читаемости
      const displayName = (o.name || o.serviceName || '').replace(/^Заказ услуги:\s*/i, '');
      const date = o.date ? new Date(o.date).toLocaleDateString('ru-RU') : '';
      const dealId = o.id || o.bitrixDealId;
      return `
      <tr>
        <td><strong>${esc(displayName)}</strong>${date ? `<div style="font-size:11px;color:var(--txt2);margin-top:2px">${esc(date)}</div>` : ''}</td>
        <td>${o.block ? `<span class="pill pt">${esc(o.block)}</span>` : '—'}</td>
        <td>${esc(o.priceDisplay || '—')}</td>
        <td>${esc(o.paymentType || 'Счёт')}</td>
        <td><span class="stag ${Orders.getStatusClass(o.status)}">${esc(o.statusLabel)}</span></td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="ot">
          <thead>
            <tr>
              <th>Сервис</th><th>Блок</th><th>Стоимость</th>
              <th>Оплата</th><th>Статус</th>
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

// ── Notification panel ────────────────────────────────────────────────────────
function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  const notifs = Notify.getAll();
  if (!notifs.length) {
    list.innerHTML = '<div class="notif-empty">Уведомлений пока нет</div>';
    return;
  }
  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-title">${esc(n.title)}</div>
      <div class="notif-msg">${esc(n.message)}</div>
      <div class="notif-ts">${new Date(n.ts).toLocaleString('ru', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
    </div>`).join('');
}
window.renderNotifPanel = renderNotifPanel;

window.toggleNotifPanel = function() {
  const panel = document.getElementById('notif-panel');
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
  } else {
    renderNotifPanel();
    panel.style.display = 'block';
    Notify.markAllRead();
  }
};

// Close notification panel on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
  }
});

// ── Onboarding Tour ───────────────────────────────────────────────────────────
const TOUR_KEY = 'axoft_tour_done';

const TOUR_STEPS = [
  {
    sel: '.dash-hero',
    title: 'Добро пожаловать!',
    desc: 'Это ваш личный кабинет программы Акселератор × Сколково. Давайте быстро познакомимся с интерфейсом.'
  },
  {
    sel: 'button.nb[onclick="goPage(\'services\')"]',
    title: 'Сервисы',
    desc: 'Каталог пакетов программы и услуг à la carte. Здесь вы можете оформить заказ.'
  },
  {
    sel: 'button.nb[onclick="goPage(\'diag\')"]',
    title: 'Диагностика',
    desc: 'Пройдите оценку канальной готовности — это поможет подобрать нужные сервисы.'
  },
  {
    sel: 'button.nb[onclick="goPage(\'orders\')"]',
    title: 'Заказы',
    desc: 'История всех ваших заказов. Статусы обновляются менеджером программы.'
  },
  {
    sel: 'button.nb[onclick="goPage(\'settings\')"]',
    title: 'Настройки',
    desc: 'Данные вашей компании. Тур можно запустить повторно в любой момент.'
  },
];

let tourStep = 0;
let highlightEl = null;
let cardEl = null;

window.startTour = function() {
  tourStep = 0;
  if (!highlightEl) {
    highlightEl = document.createElement('div');
    highlightEl.className = 'tour-highlight';
    document.body.appendChild(highlightEl);
  }
  if (!cardEl) {
    cardEl = document.createElement('div');
    cardEl.className = 'tour-card';
    document.body.appendChild(cardEl);
  }
  showTourStep(tourStep);
};

window.showTourStep = function showTourStep(idx) {
  const step = TOUR_STEPS[idx];
  const target = document.querySelector(step.sel);

  if (!target) {
    if (idx + 1 < TOUR_STEPS.length) showTourStep(idx + 1);
    else endTour();
    return;
  }

  const r = target.getBoundingClientRect();
  const pad = 6;
  highlightEl.style.cssText = `
    position:fixed;z-index:1001;border-radius:8px;pointer-events:none;
    box-shadow:0 0 0 4000px rgba(0,0,0,.55);
    top:${r.top - pad}px;left:${r.left - pad}px;
    width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;
    transition:all .35s ease;`;

  const cardTop = r.bottom + 16 < window.innerHeight - 180
    ? r.bottom + 12
    : r.top - 200;
  const cardLeft = Math.max(12, Math.min(r.left, window.innerWidth - 292));

  const isLast = idx === TOUR_STEPS.length - 1;
  cardEl.innerHTML = `
    <div class="tour-card-title">${step.title}</div>
    <div class="tour-card-desc">${step.desc}</div>
    <div class="tour-card-foot">
      <span class="tour-step-count">${idx + 1} / ${TOUR_STEPS.length}</span>
      <div class="tour-btns">
        <button class="tour-btn tour-btn-skip" onclick="endTour()">Пропустить</button>
        <button class="tour-btn tour-btn-next" onclick="${isLast ? 'endTour()' : `showTourStep(${idx + 1})`}">
          ${isLast ? 'Завершить' : 'Далее →'}
        </button>
      </div>
    </div>`;
  cardEl.style.cssText = `position:fixed;z-index:1002;background:#fff;border-radius:12px;
    padding:20px 24px;max-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.2);
    top:${cardTop}px;left:${cardLeft}px;`;
};

window.endTour = function() {
  localStorage.setItem(TOUR_KEY, '1');
  if (highlightEl) { highlightEl.remove(); highlightEl = null; }
  if (cardEl) { cardEl.remove(); cardEl = null; }
};

function maybeStartTour() {
  if (!localStorage.getItem(TOUR_KEY)) {
    setTimeout(() => window.startTour(), 900);
  }
}

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
    `<div class="pkg-li"><i class="ti ${it.icon}" style="color:${c.accent}"></i>${esc(it.text)}</div>`
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
      data-service-id="${esc(pkg.id)}"
      data-service-name="Пакет ${esc(pkg.name)}"
      data-service-block="${esc(pkg.name)}"
      data-service-price="${Number(pkg.price)}"
      data-service-price-display="${esc(pkg.priceDisplay)}">
      <div class="pkg-h">
        <span class="pkg-badge" style="background:${c.dim};color:${c.accent}">Пакет ${esc(pkg.number)}</span>
        <div class="pkg-tt">${esc(pkg.name)}</div>
        <div class="pkg-goal">${esc(pkg.goal)}</div>
        <div class="pkg-price${pkg.price === 0 ? ' fr' : ''}" ${pkg.price > 0 ? 'style="color:var(--navy)"' : ''}>${esc(pkg.priceDisplay)}</div>
      </div>
      <div class="pkg-eng">
        <div class="pkg-eng-dots">${dots}</div>
        <span>Вовлечённость Акселератора: ${esc(pkg.engagement)}</span>
      </div>
      <div class="pkg-b">
        <div class="pkg-sec-lbl">Что входит</div>
        ${items}
        <div class="pkg-res"><strong>Результат:</strong> ${esc(pkg.result)}</div>
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
    if (badge) badge.textContent = materials.filter(m => m.fileUrl || m.url).length || '';
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
    diag:     'var(--green)',
    audit:    'var(--teal)',
    pack:     'var(--blue)',
    skolkovo: 'var(--navy)',
    all:      'var(--navy)'
  };

  const icon  = typeIcons[mat.type] || 'ti-file';
  const color = pkgColors[mat.pkg]  || 'var(--teal)';

  const duration = mat.duration
    ? `<span class="pill" style="background:var(--sur2);color:var(--txt2)">${esc(mat.duration)}</span>`
    : '';

  // Элементы «Полезное от Сколково» имеют url — рендер зависит от type
  const safeUrl = mat.url && /^https?:\/\//i.test(mat.url) ? mat.url : null;

  let actionBtn;
  let extraContent = '';

  if (safeUrl && mat.type === 'article') {
    actionBtn = `<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer"
        class="btn btn-o" style="font-size:12px;white-space:nowrap">
        <i class="ti ti-arrow-right" style="font-size:12px"></i>Читать
      </a>`;
  } else if (safeUrl && mat.type === 'video') {
    const uid = mat.id.replace(/[^a-z0-9]/gi, '_');
    actionBtn = `
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <button class="btn btn-p" id="play-btn-${uid}" style="font-size:12px;white-space:nowrap"
            onclick="playVideo('${uid}','${esc(safeUrl)}')">
          ▶ Смотреть
        </button>
        <a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer"
           style="font-size:11px;color:var(--txt2)">Открыть ↗</a>
      </div>`;
    extraContent = `
      <div id="video-wrap-${uid}" style="display:none;margin-top:12px">
        <div class="video-embed" id="video-embed-${uid}"></div>
        <div id="video-err-${uid}" style="display:none;padding:10px 14px;background:#fff3dc;
             border-radius:8px;font-size:13px;color:#b06000;margin-top:8px">
          Видео нельзя встроить на страницу.
          <a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer"
             style="color:var(--teal);font-weight:600;margin-left:4px">Открыть на сайте ↗</a>
        </div>
      </div>`;
  } else {
    // Обычные материалы с файлом Диска
    const diskUrl = mat.fileUrl && /^https?:\/\//i.test(mat.fileUrl) ? mat.fileUrl : null;
    actionBtn = diskUrl
      ? `<a href="${esc(diskUrl)}" target="_blank" class="btn btn-o" style="font-size:12px;white-space:nowrap">
           <i class="ti ti-download" style="font-size:12px"></i>Скачать
         </a>`
      : `<span style="font-size:11px;color:var(--txt3);padding:4px 8px">Скоро</span>`;
  }

  return `
    <div class="mat-card" data-pkg="${esc(mat.pkg)}">
      <div class="mat-icon"><i class="ti ${icon}" style="color:${color};font-size:22px"></i></div>
      <div class="mat-body">
        <div class="mat-name">${esc(mat.name)}</div>
        ${mat.description ? `<div class="mat-desc">${esc(mat.description)}</div>` : ''}
        <div class="mat-meta">
          <span class="pill pt">${esc(mat.pkgLabel)}</span>
          <span class="pill" style="background:var(--sur2);color:var(--txt2)">${esc(mat.typeLabel)}</span>
          ${duration}
        </div>
        ${extraContent}
      </div>
      <div class="mat-action">${actionBtn}</div>
    </div>`;
}

// Ленивый плеер с toggle: первый клик — загружает и раскрывает, повторный — сворачивает
window.playVideo = function(uid, url) {
  const wrap    = document.getElementById(`video-wrap-${uid}`);
  const embed   = document.getElementById(`video-embed-${uid}`);
  const errEl   = document.getElementById(`video-err-${uid}`);
  const playBtn = document.getElementById(`play-btn-${uid}`);
  if (!wrap || !embed) return;

  // Свернуть если уже раскрыто
  if (wrap.style.display !== 'none') {
    wrap.style.display = 'none';
    if (playBtn) { playBtn.innerHTML = '▶ Смотреть'; playBtn.style.background = ''; }
    return;
  }

  const showError = () => {
    embed.style.display = 'none';
    if (errEl) errEl.style.display = 'block';
  };

  // iframe создаётся только один раз
  if (!embed.querySelector('iframe')) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allowFullscreen = true;
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.onerror = showError;
    iframe.onload = function() {
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.body && doc.body.innerHTML === '') showError();
      } catch (_) {}
    };
    embed.appendChild(iframe);
  }

  wrap.style.display = 'block';
  if (playBtn) { playBtn.innerHTML = '▲ Свернуть'; playBtn.style.background = 'var(--navy)'; }
};

// Флаг: курс уже загружен
let _skolkovoCourseLoaded = false;

// Фильтр материалов (вызывается из HTML)
window.fltMat = function(btn, pkg) {
  const gridWrap = document.getElementById('materials-grid-wrap');
  const courseEl = document.getElementById('skolkovo-course');

  document.querySelectorAll('.fb.mat-filters').forEach(b => b.classList.remove('fa'));
  btn.classList.add('fa');

  if (pkg === 'skolkovo') {
    if (gridWrap) gridWrap.style.display = 'none';
    if (courseEl) {
      courseEl.style.display = '';
      if (!_skolkovoCourseLoaded) {
        _skolkovoCourseLoaded = true;
        import('./skolkovo.js').then(m => m.default.render(courseEl)).catch(e => {
          courseEl.innerHTML = `<div style="padding:20px;color:#c00">Ошибка загрузки курса: ${e.message}</div>`;
        });
      }
    }
  } else {
    if (gridWrap) gridWrap.style.display = '';
    if (courseEl) courseEl.style.display = 'none';
    document.querySelectorAll('#materials-grid .mat-card').forEach(c => {
      c.style.display = (pkg === 'all' || c.dataset.pkg === pkg) ? '' : 'none';
    });
  }
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
    <div class="svc-card" data-pkg="${esc(svc.pkg)}"
      data-service-id="${esc(svc.id)}"
      data-service-name="${esc(svc.name)}"
      data-service-block="${esc(svc.pkgLabel)}"
      data-service-price="${Number(svc.price)}"
      data-service-price-display="${esc(svc.priceText)}">
      <div class="svc-card-head">
        <div class="svc-card-ic">
          <i class="ti ${svc.icon}" style="color:${color};font-size:18px"></i>
        </div>
        <div class="svc-card-name">${esc(svc.name)}</div>
      </div>
      ${svc.pkgLabel ? `<div class="svc-card-pkg"><span class="pill pt">${esc(svc.pkgLabel)}</span></div>` : ''}
      <div class="svc-card-desc">${esc(svc.description)}</div>
      <div class="svc-card-foot">
        <span class="svc-price ${priceClass}">${esc(svc.priceText)}</span>
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
      <span>${esc(it.text)}</span>
    </div>`).join('');

  const recommendedBadge = pp.recommended
    ? `<span style="position:absolute;top:14px;right:14px;background:${c.accent};color:#fff;
         font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">Рекомендуем</span>`
    : '';

  return `
    <div class="pkg" style="position:relative;"
      data-service-id="${esc(pp.id)}"
      data-service-name="Партнёрская программа: ${esc(pp.badge)}"
      data-service-block="Партнёрская программа"
      data-service-price="0"
      data-service-price-display="${esc(pp.priceDisplay)}">
      ${recommendedBadge}
      <div class="pkg-h">
        <span class="pkg-badge" style="background:${c.dim};color:${c.accent}">${esc(pp.badge)}</span>
        <div class="pkg-tt">${esc(pp.name)}</div>
        <div class="pkg-goal">${esc(pp.subtitle)}</div>
        <div class="pkg-price" style="color:var(--txt2);font-size:14px;font-weight:600;">
          <i class="ti ti-clock" style="font-size:12px;margin-right:4px;"></i>${esc(pp.timeline)}
        </div>
      </div>
      <div class="pkg-eng" style="background:var(--sur2);">
        <i class="ti ti-git-branch" style="color:${c.accent};font-size:14px;flex-shrink:0;"></i>
        <span>Результат: готовые документы к передаче партнёрам</span>
      </div>
      <div class="pkg-b">
        <div class="pkg-sec-lbl">Что входит</div>
        ${items}
        <div class="pkg-res"><strong>Итог:</strong> ${esc(pp.result)}</div>
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
