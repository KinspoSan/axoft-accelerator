# Дорожная карта безопасности — Axoft × Сколково ЛК

Статус на 2026-06-09. Приоритеты: 🔴 Критично / 🟡 Важно / 🟢 Улучшение.

---

## Шаг 1 — Session TTL (истечение сессии) 🔴

**Проблема.** Сессия в `localStorage` не имеет срока жизни — вход сохраняется бессрочно.
Если пользователь забыл выйти на общем/чужом устройстве, учётка открыта навсегда.

**Файлы:** `js/auth.js`

**Реализация:**
```javascript
// В register() и login() при записи сессии добавить:
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней
localStorage.setItem(AUTH_KEY, JSON.stringify({
  ...profile,
  _h: hash,
  expiresAt: Date.now() + SESSION_TTL
}));

// В _profileFromStored() добавить проверку:
_profileFromStored(d) {
  if (d.expiresAt && Date.now() > d.expiresAt) {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
  const { _h, passwordHash, expiresAt, ...profile } = d;
  return profile;
}

// В getProfile() — уже вызывает _profileFromStored, проверка применится автоматически
```

**Тест:** Вручную изменить `expiresAt` в DevTools → Application → LocalStorage на прошедшее время.
Обновить страницу — должен произойти редирект на index.html.

---

## Шаг 2 — Login rate limiting (защита от перебора) 🔴

**Проблема.** Нет ограничения на число попыток входа. Перебор паролей ничем не блокируется.
Client-side защита — не надёжная линия обороны, но без бэкенда это максимум достижимого.

**Файлы:** `js/auth.js` (или `js/auth-init.js`)

**Реализация:**
```javascript
// Хранить в localStorage
const ATTEMPTS_KEY = 'axoft_login_attempts';

function checkRateLimit(email) {
  const raw = localStorage.getItem(ATTEMPTS_KEY);
  const data = raw ? JSON.parse(raw) : {};
  const entry = data[email] || { count: 0, lockedUntil: 0 };

  if (entry.lockedUntil > Date.now()) {
    const mins = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    throw new Error(`Слишком много попыток. Повторите через ${mins} мин.`);
  }
  return entry;
}

function recordFailedAttempt(email) {
  const raw = localStorage.getItem(ATTEMPTS_KEY);
  const data = raw ? JSON.parse(raw) : {};
  const entry = data[email] || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 минут блокировки
    entry.count = 0;
  }
  data[email] = entry;
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
}

function clearAttempts(email) {
  const raw = localStorage.getItem(ATTEMPTS_KEY);
  if (!raw) return;
  const data = JSON.parse(raw);
  delete data[email];
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
}

// В login() вставить:
async login(email, password) {
  checkRateLimit(email); // бросает Error если заблокировано
  // ... существующая логика ...
  // При успехе:
  clearAttempts(email);
  // При неверном пароле (catch):
  recordFailedAttempt(email);
  throw error;
}
```

**Тест:** Ввести неверный пароль 5 раз → должно появиться сообщение с таймером блокировки.

---

## Шаг 3 — Content Security Policy 🟡

**Проблема.** Нет CSP — браузер не ограничивает загрузку внешних скриптов.
Если атакующий вставит XSS в данные Bitrix24 (например в название компании),
и `esc()` где-то пропущен — браузер выполнит произвольный скрипт.

**Файлы:** `index.html`, `cabinet.html`

**Реализация** (добавить в `<head>` обоих файлов):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net;
  font-src https://fonts.gstatic.com https://cdn.jsdelivr.net;
  img-src 'self' data: https:;
  connect-src 'self'
    https://*.bitrix24.tech
    https://suggestions.dadata.ru;
  frame-ancestors 'none';
">
```

**Важно:** `'unsafe-inline'` для скриптов нужен из-за inline `<script>` блоков в HTML.
Для снятия `'unsafe-inline'` потребуется вынести все inline скрипты во внешние файлы +
добавить nonce. Это отдельный шаг (см. Шаг 3а).

**Тест:** После добавления открыть DevTools → Console — не должно быть ошибок CSP.
Проверить, что Google Fonts, Tabler Icons и Bitrix API грузятся.

### Шаг 3а — убрать 'unsafe-inline' (дополнительно)
Вынести все inline `<script>` блоки в отдельные `.js` файлы:
- `js/auth-init.js` уже вынесен ✓
- `index.html`: inline скрипт `showTab()`, `validateINN()` → вынести в `js/index-init.js`
- `cabinet.html`: нет inline скриптов ✓

После выноса убрать `'unsafe-inline'` из CSP.

---

## Шаг 4 — Subresource Integrity для CDN 🟡

**Проблема.** `<link>` на jsDelivr (Tabler Icons) загружается без проверки целостности.
Если CDN скомпрометирован, атакующий может подменить CSS/JS файл.

**Файлы:** `index.html`, `cabinet.html`

**Реализация:**
```bash
# Вычислить SRI хэш для Tabler Icons
curl -s "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" \
  | openssl dgst -sha384 -binary | openssl base64 -A
```

```html
<!-- Было: -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/...">

<!-- Стало: -->
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/tabler-icons.min.css"
      integrity="sha384-ВСТАВИТЬ_ХЭШ"
      crossorigin="anonymous">
```

**Примечание:** Google Fonts не поддерживает SRI — они динамически выбирают CSS в зависимости
от браузера. Для полной изоляции шрифты можно скачать и хостить в репозитории.

**Тест:** После добавления открыть DevTools → Network — запрос к jsDelivr должен иметь
статус 200 (не заблокирован).

---

## Шаг 5 — Аудит XSS (проверка innerHTML) 🟡

**Проблема.** `esc()` добавлен в сессии 3, но нужно убедиться, что все точки вставки
пользовательских данных экранированы.

**Проверить вручную:**
```bash
# Найти все innerHTML / insertAdjacentHTML в JS файлах
grep -n "innerHTML\|insertAdjacentHTML" js/app.js js/bitrix.js js/orders.js js/auth.js
```

**Матрица опасных шаблонов:**

| Паттерн | Статус | Где |
|---------|--------|-----|
| `esc(profile.company)` в шаблонах app.js | ✅ Применён | buildPackageCard, buildServiceCard, orders table |
| `esc(mat.fileUrl)` + protocol check | ✅ Применён | buildMaterialCard |
| `esc(d.ogrn)` в DaData подсказке | ✅ Применён | index.html |
| Email activity body в bitrix.js | ⚠️ Не экранирован | `_sendEmailActivity`, `_sendVendorConfirmation` |

**Задача по Шагу 5:**
В `bitrix.js` функции `_sendEmailActivity()` и `_sendVendorConfirmation()` используют
интерполяцию данных вендора в HTML тело письма без экранирования.
Пример уязвимого места:
```javascript
`<td>${serviceData.name}</td>` // если name содержит <script> — XSS в письме
```
Добавить в `bitrix.js` функцию `esc()` и применить к name, block, company, inn, email.

---

## Шаг 6 — Webhook URL скрыт от браузера 🟡

**Проблема.** Сейчас webhook URL инжектируется в `js/bitrix.js` при сборке GitHub Actions.
Это правильно — URL не в репозитории. Но после деплоя URL виден в браузере:
DevTools → Sources → js/bitrix.js → const CRM_WEBHOOK = 'https://...'

Владея webhook URL, атакующий может напрямую обращаться к Bitrix24 API от имени сервиса
(создавать лиды, сделки и т.д. без авторизации).

**Решения (по нарастанию надёжности):**

### Вариант А — Cloudflare Worker (рекомендуется, бесплатно)
Создать Worker, который:
1. Принимает запросы от GitHub Pages (проверяет Origin header)
2. Добавляет реальный webhook URL и проксирует запрос в Bitrix24
3. Webhook URL остаётся только в переменных Cloudflare — никогда не попадает в браузер

```javascript
// cloudflare-worker.js (скелет)
export default {
  async fetch(request, env) {
    if (request.headers.get('Origin') !== 'https://kinspon8.github.io') {
      return new Response('Forbidden', { status: 403 });
    }
    const { method, path, body } = await request.json();
    const target = `${env.BITRIX_WEBHOOK}/${method}.json`;
    return fetch(target, { method: 'POST', body: JSON.stringify(body) });
  }
};
```

### Вариант Б — n8n webhook proxy
Уже используется в проекте (n8n упомянут в CLAUDE.md).
Создать n8n Workflow, принимающий запросы и проксирующий в Bitrix24.

### Вариант В — Минимальная защита сейчас (без бэкенда)
Добавить IP rate limiting на уровне Bitrix24 (если поддерживается).
Мониторить подозрительные лиды/сделки в CRM.

---

## Шаг 7 — Серверная аутентификация 🟢

**Проблема (архитектурная).**
SHA-256 хэш пароля вычисляется в браузере. SALT (`axoft-skolkovo-2025`) жёстко зашит
в `js/auth.js` — он виден в исходном коде. Атакующий, зная SALT, может строить
rainbow table для SHA-256(пароль + email + SALT) для часто используемых паролей.

**Правильное решение:**
Вынести проверку пароля на сервер (Node.js / Edge Function), использовать bcrypt или
Argon2id с уникальной солью на пользователя. Клиент только передаёт пароль по HTTPS
на защищённый endpoint.

**Это требует бэкенда** — минимально: Cloudflare Worker + KV Store (или Supabase Auth).

**Промежуточный шаг (без бэкенда):**
Добавить pepper-ротацию: хранить версию алгоритма в сессии, при входе мигрировать
на новый SALT. Это затрудняет использование предвычисленных таблиц.

---

## Шаг 8 — Security Headers через Cloudflare Pages 🟢

**Проблема.** GitHub Pages не позволяет устанавливать HTTP заголовки безопасности.
Следующие заголовки не применяются:
- `X-Frame-Options: DENY` — кликджекинг
- `X-Content-Type-Options: nosniff` — MIME-sniffing
- `Strict-Transport-Security` — HSTS (GitHub Pages ставит автоматически)
- `Permissions-Policy` — ограничение API браузера

**Решение:** Перенести деплой с GitHub Pages на Cloudflare Pages.
Cloudflare Pages поддерживает файл `_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Referrer-Policy: strict-origin-when-cross-origin
```

Бонус: встроенный CDN, Analytics, Custom Domains, WAF.

---

## Статус приоритетов

| Шаг | Приоритет | Сложность | Файлы | Статус |
|-----|-----------|-----------|-------|--------|
| 1 Session TTL | 🔴 Критично | Низкая (30 мин) | auth.js | Открыт |
| 2 Rate limiting | 🔴 Критично | Низкая (30 мин) | auth.js | Открыт |
| 3 CSP meta tag | 🟡 Важно | Средняя (1 ч) | index.html, cabinet.html | Открыт |
| 4 SRI для CDN | 🟡 Важно | Средняя (1 ч) | index.html, cabinet.html | Открыт |
| 5 XSS аудит | 🟡 Важно | Средняя (2 ч) | bitrix.js | Открыт |
| 6 Webhook proxy | 🟡 Важно | Высокая (полдня) | bitrix.js + Cloudflare/n8n | Открыт |
| 7 Серверная auth | 🟢 Улучшение | Очень высокая (3+ дня) | Новый бэкенд | Открыт |
| 8 Security headers | 🟢 Улучшение | Средняя (2 ч) | Перенос на CF Pages | Открыт |
