# Axoft × Сколково — Личный кабинет вендора
## Задача для Claude Code

Разверни полноценный личный кабинет вендора на GitHub Pages (`https://github.com/KinspoSan/axoft-accelerator`) с авторизацией, регистрацией и интеграцией с Bitrix24 CRM. За основу взят HTML-файл `skolkovo_lk_v2.html`.

### Принципы обработки данных (152-ФЗ)
Регистрация построена на данных **юридического лица** — они не являются персональными данными физических лиц и не требуют согласия на обработку:
- ✅ Название компании — реквизит юрлица
- ✅ ИНН организации (10 цифр) — реквизит юрлица
- ✅ Корпоративный email — адрес организации
- ✅ Направление / стадия / статус Сколково — бизнес-атрибуты
- ✅ Пароль — не ПДн
- ❌ ФИО, личный телефон, личный email — **не собираем**

---

## Структура репозитория

```
axoft-accelerator/
├── index.html              ← Страница входа / регистрации
├── cabinet.html            ← Личный кабинет (адаптированный skolkovo_lk_v2.html)
├── js/
│   ├── auth.js             ← Авторизация (данные юрлица → Bitrix лид)
│   ├── bitrix.js           ← Обёртка Bitrix24 REST API
│   ├── orders.js           ← Создание и загрузка заказов (сделки Bitrix24)
│   └── app.js              ← Инициализация и роутинг
└── .github/
    └── workflows/
        └── deploy.yml      ← GitHub Actions → GitHub Pages
```

---

## Шаг 1 — Инициализация репозитория

```bash
git clone https://github.com/KinspoSan/axoft-accelerator.git
cd axoft-accelerator
mkdir -p js .github/workflows
```

---

## Шаг 2 — Создай `index.html` (вход + регистрация)

Полная HTML-страница с двумя вкладками. Дизайн строго соответствует `skolkovo_lk_v2.html`.

**CSS-переменные**: `--navy:#1e2849`, `--teal:#00b0bd`, `--green:#00b37d`, `--blue:#00aeef`
**Шрифты**: `Unbounded` (заголовки), `Golos Text` (текст) — подключить из Google Fonts
**Topbar**: badge `AXOFT` + разделитель + `● Сколково`

### Форма регистрации — только данные юрлица:

| Поле | Тип | Обязательное | Примечание |
|------|-----|-------------|-----------|
| Название компании | text | ✅ | placeholder: «ООО Ромашка» |
| ИНН организации | text | ✅ | 10 цифр, валидация длины; подсказка: «ИНН юридического лица (10 цифр)» |
| Направление | select | ✅ | ИИ — ML/AI для B2B / Кибербезопасность / BI / Аналитика / DevOps / MLOps / Иное |
| Стадия | select | ✅ | Идея/pre-MVP / Стартап (до 3 лет) есть MVP / Стартап (3–7 лет) / Зрелая компания |
| Резидент Сколково | checkbox | — | |
| Корпоративный email | email | ✅ | placeholder: «info@company.ru»; подсказка под полем: «Используйте корпоративный email» |
| Пароль | password | ✅ | мин. 8 символов |
| Повтор пароля | password | ✅ | |

Под кнопкой «Зарегистрироваться» добавь мелкий текст:
```
Регистрируя компанию, вы подтверждаете, что являетесь её представителем.
Персональные данные физических лиц не собираются и не хранятся.
```

### Форма входа:
| Поле | Тип |
|------|-----|
| Корпоративный email | email |
| Пароль | password |

### Стили страницы входа:

```css
:root {
  --navy: #1e2849; --teal: #00b0bd; --green: #00b37d; --blue: #00aeef;
  --bg: #f0f2f7; --sur: #fff; --bdr: rgba(30,40,73,.1);
  --txt: #1e2849; --txt2: #6b7290; --r: 12px; --rs: 8px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Golos Text', sans-serif; background: var(--bg); min-height: 100vh; }

.tb { position: fixed; top: 0; left: 0; right: 0; height: 64px; background: var(--navy);
  display: flex; align-items: center; padding: 0 24px; gap: 12px; z-index: 100; }
.ax-badge { background: var(--teal); color: #fff; font-family: 'Unbounded', sans-serif;
  font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
.tb-sep { width: 1px; height: 24px; background: rgba(255,255,255,.18); }
.sko-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
.tb-sko { display: flex; align-items: center; gap: 8px; }
.tb-sko span { color: rgba(255,255,255,.8); font-size: 13px; }

.wrap { display: flex; align-items: center; justify-content: center;
  min-height: 100vh; padding: 80px 16px 32px; }
.card { background: var(--sur); border-radius: var(--r); border: 1px solid var(--bdr);
  width: 100%; max-width: 480px; overflow: hidden; box-shadow: 0 4px 24px rgba(30,40,73,.08); }
.card-h { background: var(--navy); padding: 28px 32px; }
.card-title { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 700;
  color: #fff; margin-bottom: 4px; }
.card-sub { font-size: 12px; color: rgba(255,255,255,.55); }

.tabs { display: flex; border-bottom: 1px solid var(--bdr); }
.tab { flex: 1; padding: 14px; font-size: 13px; font-weight: 600; text-align: center;
  cursor: pointer; color: var(--txt2); border: none; background: transparent;
  transition: all .2s; font-family: 'Golos Text', sans-serif; }
.tab.active { color: var(--teal); border-bottom: 2px solid var(--teal); }

.form-body { padding: 24px 32px; }
.field { margin-bottom: 16px; }
.label { font-size: 12px; font-weight: 600; color: var(--txt); margin-bottom: 5px; display: block; }
.label span { color: #c00; }
.input { width: 100%; padding: 10px 12px; border: 1px solid var(--bdr); border-radius: var(--rs);
  font-family: 'Golos Text', sans-serif; font-size: 13px; color: var(--txt);
  background: #f7f8fb; transition: border .2s; }
.input:focus { outline: none; border-color: var(--teal); background: #fff; }
.hint { font-size: 11px; color: var(--txt2); margin-top: 4px; }
.check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--txt); }
.check-row input { accent-color: var(--teal); width: 15px; height: 15px; }

.divider { height: 1px; background: var(--bdr); margin: 4px 0 16px; }
.btn-submit { width: 100%; padding: 12px; background: var(--teal); color: #fff; border: none;
  border-radius: var(--rs); font-family: 'Golos Text', sans-serif; font-size: 14px;
  font-weight: 600; cursor: pointer; transition: background .2s; }
.btn-submit:hover { background: #00c9d8; }
.btn-submit:disabled { opacity: .6; cursor: not-allowed; }

.disclaimer { font-size: 11px; color: var(--txt2); text-align: center;
  margin-top: 14px; line-height: 1.5; }
.error-msg { background: rgba(200,0,0,.07); border: 1px solid rgba(200,0,0,.2);
  border-radius: var(--rs); padding: 10px 14px; font-size: 12px; color: #c00;
  margin-bottom: 16px; display: none; }
.error-msg.show { display: block; }
```

### HTML-разметка форм:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Axoft × Сколково — Вход</title>
  <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700&family=Golos+Text:wght@400;500;600&display=swap" rel="stylesheet">
  <style>/* вставь CSS выше */</style>
</head>
<body>

<header class="tb">
  <div class="ax-badge">AXOFT</div>
  <div class="tb-sep"></div>
  <div class="tb-sko"><div class="sko-dot"></div><span>Сколково</span></div>
</header>

<div class="wrap">
  <div class="card">
    <div class="card-h">
      <div class="card-title">Личный кабинет вендора</div>
      <div class="card-sub">Программа Axoft × Сколково — Channel Readiness</div>
    </div>

    <div class="tabs">
      <button class="tab active" id="tab-login"    onclick="showTab('login')">Войти</button>
      <button class="tab"        id="tab-register" onclick="showTab('register')">Регистрация</button>
    </div>

    <!-- ВХОД -->
    <div id="form-login" class="form-body">
      <div class="error-msg" id="login-error"></div>
      <div class="field">
        <label class="label">Корпоративный email <span>*</span></label>
        <input id="l-email" class="input" type="email" placeholder="info@company.ru">
      </div>
      <div class="field">
        <label class="label">Пароль <span>*</span></label>
        <input id="l-password" class="input" type="password" placeholder="••••••••">
      </div>
      <button class="btn-submit" id="btn-login">Войти в кабинет</button>
    </div>

    <!-- РЕГИСТРАЦИЯ -->
    <div id="form-register" class="form-body" style="display:none">
      <div class="error-msg" id="reg-error"></div>

      <div class="field">
        <label class="label">Название компании <span>*</span></label>
        <input id="r-company" class="input" type="text" placeholder="ООО Ромашка">
      </div>
      <div class="field">
        <label class="label">ИНН организации <span>*</span></label>
        <input id="r-inn" class="input" type="text" placeholder="7712345678" maxlength="10">
        <div class="hint">ИНН юридического лица — 10 цифр</div>
      </div>
      <div class="field">
        <label class="label">Направление <span>*</span></label>
        <select id="r-direction" class="input">
          <option value="">— выберите —</option>
          <option>ИИ — ML/AI для B2B</option>
          <option>Кибербезопасность</option>
          <option>BI / Аналитика</option>
          <option>DevOps / MLOps</option>
          <option>Иное</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Стадия компании <span>*</span></label>
        <select id="r-stage" class="input">
          <option value="">— выберите —</option>
          <option>Идея / pre-MVP</option>
          <option>Стартап (до 3 лет), есть MVP</option>
          <option>Стартап (3–7 лет)</option>
          <option>Зрелая компания</option>
        </select>
      </div>
      <div class="field">
        <div class="check-row">
          <input id="r-skolkovo" type="checkbox">
          <label for="r-skolkovo">Резидент Сколково</label>
        </div>
      </div>

      <div class="divider"></div>

      <div class="field">
        <label class="label">Корпоративный email <span>*</span></label>
        <input id="r-email" class="input" type="email" placeholder="info@company.ru">
        <div class="hint">Используйте корпоративный email организации</div>
      </div>
      <div class="field">
        <label class="label">Пароль <span>*</span></label>
        <input id="r-password" class="input" type="password" placeholder="Минимум 8 символов">
      </div>
      <div class="field">
        <label class="label">Повтор пароля <span>*</span></label>
        <input id="r-password2" class="input" type="password" placeholder="Повторите пароль">
      </div>

      <button class="btn-submit" id="btn-register">Зарегистрировать компанию</button>
      <div class="disclaimer">
        Регистрируя компанию, вы подтверждаете, что являетесь её представителем.<br>
        Персональные данные физических лиц не собираются и не хранятся.
      </div>
    </div>

  </div>
</div>

<script type="module" src="js/auth-init.js"></script>
</body>
</html>
```

---

## Шаг 3 — Создай `js/bitrix.js`

```javascript
// js/bitrix.js
// Bitrix24 REST API wrapper
// Webhook URL содержит токен доступа — при необходимости замени на n8n-прокси

const BITRIX_WEBHOOK = 'https://vibecode.bitrix24.tech/rest/1/vibe_api_9Rt9spXZAf9D6H4ip0gMXvH0OSafIh56_52e672';

const Bitrix = {
  async call(method, params = {}) {
    const url = `${BITRIX_WEBHOOK}/${method}.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data.result;
  },

  // ── ЛИДЫ (регистрации компаний) ──────────────────────────────────────────

  async createLead(companyData) {
    // Лид = карточка компании в CRM. Никаких ПДн физлиц.
    return await this.call('crm.lead.add', {
      fields: {
        TITLE:         `[Сколково] ${companyData.company}`,
        COMPANY_TITLE: companyData.company,
        EMAIL:         [{ VALUE: companyData.email, VALUE_TYPE: 'WORK' }],
        COMMENTS: [
          `ИНН: ${companyData.inn}`,
          `Направление: ${companyData.direction}`,
          `Стадия: ${companyData.stage}`,
          `Резидент Сколково: ${companyData.skolkovo ? 'Да' : 'Нет'}`,
          `Тариф: UP BASE`,
          `Источник: ЛК Axoft × Сколково`,
          `Дата регистрации: ${new Date().toLocaleString('ru')}`
        ].join('\n'),
        SOURCE_ID:        'WEB',
        STATUS_ID:        'NEW',
        ASSIGNED_BY_ID:   1    // ID ответственного в Bitrix24 — поменяй на свой
      }
    });
  },

  async findLeadByEmail(email) {
    const result = await this.call('crm.lead.list', {
      filter: { 'EMAIL': email },
      select: ['ID', 'TITLE', 'COMPANY_TITLE', 'STATUS_ID']
    });
    return result && result.length > 0 ? result[0] : null;
  },

  // ── СДЕЛКИ (заказы сервисов) ──────────────────────────────────────────────

  async createDeal(orderData, companyProfile) {
    // Сделка = заказ сервиса. Привязана к компании, не к физлицу.
    return await this.call('crm.deal.add', {
      fields: {
        TITLE:        `[Сколково] ${orderData.serviceName} — ${companyProfile.company}`,
        OPPORTUNITY:  orderData.price,
        CURRENCY_ID:  'RUB',
        STAGE_ID:     'NEW',
        SOURCE_ID:    'WEB',
        COMMENTS: [
          `Компания: ${companyProfile.company}`,
          `ИНН: ${companyProfile.inn}`,
          `Email: ${companyProfile.email}`,
          `Сервис: ${orderData.serviceName}`,
          `Блок: ${orderData.block}`,
          `Стоимость: ${orderData.priceDisplay}`,
          `Оплата: ${orderData.paymentType}`,
          `Тариф: ${companyProfile.tier}`
        ].join('\n'),
        ...(companyProfile.leadId ? { LEAD_ID: companyProfile.leadId } : {})
      }
    });
  },

  async getDeals(email) {
    const result = await this.call('crm.deal.list', {
      filter: { '%TITLE%': 'Сколково' },
      select: ['ID', 'TITLE', 'OPPORTUNITY', 'STAGE_ID', 'DATE_CREATE']
    });
    return result || [];
  },

  async addActivity(leadId, message) {
    return await this.call('crm.activity.add', {
      fields: {
        OWNER_TYPE_ID: 1,
        OWNER_ID:      leadId,
        TYPE_ID:       6,
        SUBJECT:       'Действие в ЛК',
        DESCRIPTION:   message,
        COMPLETED:     'Y'
      }
    });
  }
};

export default Bitrix;
```

---

## Шаг 4 — Создай `js/auth.js`

```javascript
// js/auth.js
// Авторизация по данным юрлица. Физические лица не идентифицируются.
import Bitrix from './bitrix.js';

const SESSION_KEY = 'axoft_company_session';

const Auth = {
  // Регистрация компании
  async register(formData) {
    // Проверить: не зарегистрирована ли компания с таким email
    const existing = await Bitrix.findLeadByEmail(formData.email);
    if (existing) {
      throw new Error('Компания с этим email уже зарегистрирована. Войдите в кабинет.');
    }

    // Создать лид в Bitrix24 (данные юрлица)
    const leadId = await Bitrix.createLead(formData);

    // Сохранить сессию локально
    // Храним только: название компании, ИНН, направление, стадия, email, тариф
    const profile = {
      leadId,
      company:      formData.company,
      inn:          formData.inn,
      direction:    formData.direction,
      stage:        formData.stage,
      skolkovo:     formData.skolkovo,
      email:        formData.email,
      tier:         'base',
      registeredAt: new Date().toISOString(),
      // Простой хэш пароля. Для production — заменить на серверную аутентификацию
      _ph:          btoa(formData.password + ':' + formData.email)
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));

    // Залогировать в Bitrix
    try {
      await Bitrix.addActivity(leadId,
        `Компания зарегистрирована в ЛК. Email: ${formData.email}`
      );
    } catch (_) { /* не критично */ }

    return profile;
  },

  // Вход
  async login(email, password) {
    const stored = this._loadSession();

    // Проверяем локальную сессию
    if (stored && stored.email === email) {
      const hash = btoa(password + ':' + email);
      if (stored._ph === hash) return stored;
      throw new Error('Неверный пароль.');
    }

    // Компания могла зарегистрироваться с другого устройства
    const lead = await Bitrix.findLeadByEmail(email);
    if (!lead) {
      throw new Error('Компания не найдена. Пройдите регистрацию.');
    }

    // Пароль хранится только локально — предложить сброс через поддержку
    throw new Error(
      'Войдите с того же устройства, где регистрировались, или обратитесь: program@axoft.ru'
    );
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  },

  getProfile() {
    return this._loadSession();
  },

  isLoggedIn() {
    return !!this.getProfile();
  },

  updateTier(tier) {
    const profile = this.getProfile();
    if (profile) {
      profile.tier = tier;
      localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    }
  },

  _loadSession() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  }
};

export default Auth;
```

---

## Шаг 5 — Создай `js/auth-init.js` (инициализация страницы входа)

```javascript
// js/auth-init.js  — подключается только в index.html
import Auth from './auth.js';

// Если уже залогинен — сразу в кабинет
if (Auth.isLoggedIn()) {
  window.location.href = 'cabinet.html';
}

// Переключение вкладок
window.showTab = function(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
};

// Скрыть сообщение об ошибке при вводе
['l-email','l-password','r-company','r-inn','r-email','r-password','r-password2']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      document.getElementById('login-error').classList.remove('show');
      document.getElementById('reg-error').classList.remove('show');
    });
  });

// ── РЕГИСТРАЦИЯ ───────────────────────────────────────────────────────────────
document.getElementById('btn-register').addEventListener('click', async () => {
  const btn = document.getElementById('btn-register');
  const errEl = document.getElementById('reg-error');
  errEl.classList.remove('show');

  const company   = document.getElementById('r-company').value.trim();
  const inn       = document.getElementById('r-inn').value.trim();
  const direction = document.getElementById('r-direction').value;
  const stage     = document.getElementById('r-stage').value;
  const skolkovo  = document.getElementById('r-skolkovo').checked;
  const email     = document.getElementById('r-email').value.trim().toLowerCase();
  const password  = document.getElementById('r-password').value;
  const password2 = document.getElementById('r-password2').value;

  // Валидация
  if (!company || !inn || !direction || !stage || !email || !password) {
    errEl.textContent = 'Заполните все обязательные поля.';
    errEl.classList.add('show');
    return;
  }
  if (!/^\d{10}$/.test(inn)) {
    errEl.textContent = 'ИНН организации должен содержать ровно 10 цифр.';
    errEl.classList.add('show');
    return;
  }
  if (password.length < 8) {
    errEl.textContent = 'Пароль должен быть не менее 8 символов.';
    errEl.classList.add('show');
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Пароли не совпадают.';
    errEl.classList.add('show');
    return;
  }

  btn.textContent = '⏳ Регистрируем...';
  btn.disabled = true;

  try {
    await Auth.register({ company, inn, direction, stage, skolkovo, email, password });
    window.location.href = 'cabinet.html';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add('show');
    btn.textContent = 'Зарегистрировать компанию';
    btn.disabled = false;
  }
});

// ── ВХОД ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const btn = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('show');

  const email    = document.getElementById('l-email').value.trim().toLowerCase();
  const password = document.getElementById('l-password').value;

  if (!email || !password) {
    errEl.textContent = 'Введите email и пароль.';
    errEl.classList.add('show');
    return;
  }

  btn.textContent = '⏳ Входим...';
  btn.disabled = true;

  try {
    await Auth.login(email, password);
    window.location.href = 'cabinet.html';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add('show');
    btn.textContent = 'Войти в кабинет';
    btn.disabled = false;
  }
});
```

---

## Шаг 6 — Создай `js/orders.js`

```javascript
// js/orders.js
import Bitrix from './bitrix.js';
import Auth from './auth.js';

const ORDERS_KEY = 'axoft_orders';

const Orders = {
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

    // Создать сделку в Bitrix24
    try {
      const dealId = await Bitrix.createDeal(order, profile);
      order.bitrixDealId = dealId;
      if (profile.leadId) {
        await Bitrix.addActivity(
          profile.leadId,
          `Заказан сервис: ${serviceData.name} (${serviceData.priceDisplay}). Сделка #${dealId}`
        );
      }
    } catch (e) {
      console.warn('Bitrix недоступен, заказ сохранён локально:', e.message);
    }

    const orders = this._local();
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return order;
  },

  async getAll() {
    return this._local(); // Bitrix-сделки подгружаются отдельно при необходимости
  },

  _local() {
    try {
      return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    } catch (_) { return []; }
  },

  statusClass(status) {
    return { new: 'sa2', active: 'sa2', review: 'sr2', done: 'sd' }[status] || 'sa2';
  }
};

export default Orders;
```

---

## Шаг 7 — Адаптируй `cabinet.html` из `skolkovo_lk_v2.html`

Скопируй `skolkovo_lk_v2.html` в `cabinet.html` и внеси следующие изменения:

### 7.1 Добавь в `<head>` перед `</head>`:
```html
<script type="module" src="js/app.js"></script>
```

### 7.2 Topbar — динамический аватар и кнопка выхода

Найди:
```html
<div class="av">АИ</div><span>АИСофт</span>
```
Замени на:
```html
<div class="av" id="user-avatar">—</div>
<span id="user-name">Загрузка...</span>
```

Добавь сразу после этого блока кнопку выхода:
```html
<button class="nb" id="btn-logout" title="Выйти из кабинета">
  <i class="ti ti-logout" style="font-size:16px"></i>
</button>
```

### 7.3 Заголовок дашборда — динамический

Найди `Добро пожаловать, АИСофт!` и замени на:
```html
Добро пожаловать, <span id="dash-company">...</span>!
```

### 7.4 Страница «Заказы» — контейнер для динамической таблицы

В `<div id="ord-base">` замени всё содержимое на:
```html
<div id="ord-base">
  <div class="card" style="margin-bottom:18px">
    <div class="ch">
      <div class="ct"><i class="ti ti-list-details"></i>Мои заказы</div>
      <span class="pill pt" id="orders-count" style="display:none"></span>
    </div>
    <div class="cb" id="orders-table-container">
      <div style="text-align:center;padding:20px;color:var(--txt2)">Загрузка...</div>
    </div>
  </div>
</div>
```

### 7.5 Кнопки «Заказать» — добавь data-атрибуты каждой карточке сервиса

Для каждого `.svcc` блока добавь атрибуты (подставь правильные значения):
```html
data-service-id="УНИКАЛЬНЫЙ_ID"
data-service-name="Название сервиса"
data-service-block="Блок N"
data-service-price="150000"
data-service-price-display="150 000 ₽"
```

Замени `onclick` у кнопок «Заказать» / «Подключить» на:
```html
onclick="handleOrder(this.closest('.svcc'))"
```

### 7.6 Страница «Настройки» — динамические данные компании

Замени захардкоженные значения на элементы с id:
```html
<!-- Название -->
<div class="set-v" id="set-company">—</div>
<!-- ИНН -->
<div class="set-v" id="set-inn">—</div>
<!-- Email -->
<div class="set-v" id="set-email">—</div>
<!-- Направление -->
<div class="set-v" id="set-direction">—</div>
<!-- Стадия -->
<div class="set-v" id="set-stage">—</div>
<!-- Резидент Сколково -->
<div class="set-v" id="set-skolkovo">—</div>
<!-- Дата регистрации -->
<div class="set-v" id="set-reg-date">—</div>
```

Убери из секции «Контактное лицо» поля ФИО и телефона — их нет в нашей модели данных. Оставь только email.

---

## Шаг 8 — Создай `js/app.js`

```javascript
// js/app.js — инициализация кабинета
import Auth from './auth.js';
import Orders from './orders.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Защита маршрута ──────────────────────────────────────────────────────
  if (!Auth.isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  const profile = Auth.getProfile();

  // ── Кнопка выхода ────────────────────────────────────────────────────────
  document.getElementById('btn-logout')?.addEventListener('click', () => Auth.logout());

  // ── Аватар и имя компании ────────────────────────────────────────────────
  const initials = profile.company
    .replace(/^(ООО|АО|ЗАО|ПАО|ИП)\s*/i, '')  // убрать организационно-правовую форму
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  const dashEl   = document.getElementById('dash-company');
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = profile.company;
  if (dashEl)   dashEl.textContent   = profile.company;

  // ── Настройки: заполнить данные компании ─────────────────────────────────
  const fields = {
    'set-company':   profile.company,
    'set-inn':       profile.inn,
    'set-email':     profile.email,
    'set-direction': profile.direction,
    'set-stage':     profile.stage,
    'set-skolkovo':  profile.skolkovo ? 'Да' : 'Нет',
    'set-reg-date':  new Date(profile.registeredAt).toLocaleDateString('ru-RU')
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  });

  // ── Тариф ────────────────────────────────────────────────────────────────
  if (profile.tier === 'strat') {
    if (typeof setTier === 'function') setTier('strat');
  }

  // ── Загрузить заказы ─────────────────────────────────────────────────────
  await renderOrders();
});

// ── Оформление заказа ────────────────────────────────────────────────────────
window.handleOrder = async function(card) {
  const serviceData = {
    id:           card.dataset.serviceId,
    name:         card.dataset.serviceName,
    block:        card.dataset.serviceBlock,
    price:        parseInt(card.dataset.servicePrice) || 0,
    priceDisplay: card.dataset.servicePriceDisplay,
    paymentType:  'Счёт'
  };

  const btn = card.querySelector('[onclick]');
  const origHtml = btn.innerHTML;
  btn.innerHTML  = '⏳ Оформляем...';
  btn.disabled   = true;

  try {
    const order = await Orders.placeOrder(serviceData);
    btn.innerHTML = '✅ Заказано';
    btn.style.background = 'var(--green)';
    showToast(`Заказ «${serviceData.name}» оформлен! Менеджер свяжется по email.`);
    await renderOrders();
  } catch (e) {
    btn.innerHTML = origHtml;
    btn.disabled  = false;
    showToast(`Ошибка: ${e.message}`, 'error');
  }
};

// ── Рендер таблицы заказов ────────────────────────────────────────────────────
async function renderOrders() {
  const container  = document.getElementById('orders-table-container');
  const countBadge = document.getElementById('orders-count');
  const navBadge   = document.getElementById('orders-badge');
  if (!container) return;

  try {
    const orders = await Orders.getAll();

    if (navBadge) navBadge.textContent = orders.length || '0';

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:40px;margin-bottom:12px">📋</div>
          <div style="font-size:15px;font-weight:600;color:var(--navy);margin-bottom:6px">
            Заказов пока нет
          </div>
          <div style="font-size:13px;color:var(--txt2);margin-bottom:18px">
            Перейдите в Сервисы и оформите первый заказ.
          </div>
          <button class="btn btn-p" onclick="goPage('services')">
            <i class="ti ti-apps" style="font-size:14px"></i>Перейти в каталог
          </button>
        </div>`;
      return;
    }

    if (countBadge) {
      countBadge.textContent = `${orders.length} заказ${orders.length > 1 ? 'а' : ''}`;
      countBadge.style.display = 'inline';
    }

    const rows = orders.map(o => `
      <tr>
        <td><strong>${o.serviceName}</strong></td>
        <td>${o.block ? `<span class="pill pt">${o.block}</span>` : '—'}</td>
        <td>${o.priceDisplay || '—'}</td>
        <td>${o.paymentType || '—'}</td>
        <td><span class="stag ${Orders.statusClass(o.status)}">${o.statusLabel}</span></td>
        <td>
          ${o.bitrixDealId
            ? `<a href="https://vibecode.bitrix24.tech/crm/deal/details/${o.bitrixDealId}/"
                  target="_blank" class="btn btn-o"
                  style="font-size:11px;padding:5px 10px">
                 #${o.bitrixDealId}
               </a>`
            : ''}
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="ot">
          <thead>
            <tr>
              <th>Сервис</th><th>Блок</th><th>Стоимость</th>
              <th>Оплата</th><th>Статус</th><th>Bitrix</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  } catch (e) {
    container.innerHTML =
      `<div style="padding:20px;color:#c00">Ошибка загрузки заказов: ${e.message}</div>`;
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
window.showToast = function(message, type = 'success') {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type === 'error' ? '#c00314' : 'var(--teal)'};
    color:#fff;padding:13px 20px;border-radius:10px;
    font-family:'Golos Text',sans-serif;font-size:13px;
    box-shadow:0 4px 20px rgba(0,0,0,.2);max-width:380px;line-height:1.4;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
};
```

---

## Шаг 9 — GitHub Actions

Создай `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## Шаг 10 — Коммит и деплой

```bash
git add .
git commit -m "feat: vendor cabinet — company-only registration, Bitrix24 integration"
git push origin main
```

Затем в GitHub → репозиторий → **Settings → Pages → Source: GitHub Actions** → Save.

Сайт будет доступен по адресу: `https://kinspon8.github.io/axoft-accelerator/`

---

## Шаг 11 — Проверка Bitrix24

Убедись, что webhook работает:
```
https://vibecode.bitrix24.tech/rest/1/vibe_api_9Rt9spXZAf9D6H4ip0gMXvH0OSafIh56_52e672/crm.lead.fields.json
```
Должен вернуть JSON с полями лида — значит всё подключено.

После первой регистрации тестовой компании:
- CRM → **Лиды** — появится карточка с названием `[Сколково] Название компании`
- После заказа сервиса — CRM → **Сделки**

---

## Итог: что собираем и чего не собираем

| Данные | Собираем? | Почему |
|--------|-----------|--------|
| Название компании | ✅ | Реквизит юрлица, не ПДн |
| ИНН организации (10 цифр) | ✅ | Реквизит юрлица, не ПДн |
| Корпоративный email | ✅ | Адрес организации |
| Направление / стадия | ✅ | Бизнес-атрибуты |
| Резидент Сколково | ✅ | Статус организации |
| ФИО | ❌ | ПДн физлица — не собираем |
| Личный телефон | ❌ | ПДн физлица — не собираем |
| Личный email (gmail/mail.ru) | ❌ | ПДн физлица — не собираем |
