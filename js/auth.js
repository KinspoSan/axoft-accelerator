// Авторизация через REST API сервера (ветка backend-api)
// На GitHub Pages используется версия из main (Bitrix-напрямую)

const AUTH_KEY  = 'axoft_vendor_session';
const TOKEN_KEY = 'axoft_vendor_token';
const API       = '/api/auth';

const Auth = {

  async register(formData) {
    const res  = await this._post(`${API}/register`, formData);
    this._saveSession(res.token, res.profile);
    return res.profile;
  },

  async login(email, password) {
    const res = await this._post(`${API}/login`, { email, password });
    this._saveSession(res.token, res.profile);
    return res.profile;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = 'index.html';
  },

  getProfile() {
    try {
      const s = localStorage.getItem(AUTH_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  isLoggedIn() {
    return !!(this.getToken() && this.getProfile());
  },

  updateTier(tier) {
    const p = this.getProfile();
    if (p) {
      p.tier = tier;
      localStorage.setItem(AUTH_KEY, JSON.stringify(p));
    }
  },

  // ── Сброс пароля ──────────────────────────────────────────────────────────

  async requestPasswordReset(email) {
    const res = await this._post(`${API}/reset-request`, { email });
    return res.message;
  },

  async confirmPasswordReset(token, password) {
    const res = await this._post(`${API}/reset-confirm`, { token, password });
    return res.message;
  },

  // ── Внутренние ────────────────────────────────────────────────────────────

  _saveSession(token, profile) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
  },

  async _post(url, body) {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
    return data;
  },
};

export default Auth;
