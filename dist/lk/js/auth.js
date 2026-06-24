// js/auth.js — клиент бэкенда ЛК.
// Авторизация и профиль идут через /api/*. Сессия — в HttpOnly-cookie (ставит сервер).
// На стороне фронта нет ни паролей, ни токенов, ни SALT, ни localStorage-сессий.

let _profile = null;   // кэш профиля после ensure()
let _loaded  = false;

function mapProfile(p) {
  if (!p) return null;
  return {
    company:      p.company_name || p.email || '',
    email:        p.email || '',
    inn:          p.inn || '',
    // в БД tier = 'base' | 'strategic'; кабинет ждёт 'base' | 'strat'
    tier:         p.tier === 'strategic' ? 'strat' : 'base',
    direction:    p.direction || '',
    stage:        p.stage || '',
    skolkovo:     !!p.skolkovo,
    registeredAt: p.created_at || new Date().toISOString(),
    bitrix:       p.bitrix || null,
  };
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return { ok: res.ok && data.ok !== false, status: res.status, data };
}

const Auth = {
  // Загрузить сессию один раз. Возвращает true, если вендор вошёл.
  // Вызывать в начале страницы (await) до обращения к getProfile()/isLoggedIn().
  async ensure() {
    if (_loaded) return _profile !== null;
    const r = await api('/api/profile');
    _profile = r.ok ? mapProfile(r.data.profile) : null;
    _loaded = true;
    return _profile !== null;
  },

  // Синхронно — корректно только ПОСЛЕ await ensure().
  isLoggedIn() { return _profile !== null; },

  getProfile() { return _profile; },

  async login(email, password) {
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error(r.data.error || 'Неверный email или пароль.');
    _loaded = false;
    await this.ensure();
    return _profile;
  },

  async logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    _profile = null;
    _loaded = true;
    window.location.href = 'index.html';
  },

  // «Забыли пароль»: запросить ссылку по email. Ответ всегда успешный
  // (не раскрываем, существует ли такой email).
  async requestReset(email) {
    await api('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
  },

  // Установка нового пароля по токену из письма (та же ручка, что set-password.html).
  async resetPassword(token, password) {
    const r = await api('/api/auth/password/set', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    if (!r.ok) throw new Error(r.data.error || 'Ссылка недействительна или истекла.');
    _loaded = false;
    await this.ensure();
  },
};

export default Auth;
