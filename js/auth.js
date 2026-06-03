import Bitrix from './bitrix.js';

const AUTH_KEY = 'axoft_vendor_session';
const SALT     = 'axoft-skolkovo-2025';

// SHA-256 через Web Crypto API
async function sha256(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, email) {
  return sha256(password + email + SALT);
}

const Auth = {
  async register(formData) {
    // Проверяем: нет ли уже такого email в Bitrix
    const existing = await Bitrix.findVendorByEmail(formData.email).catch(() => null);
    if (existing) {
      throw new Error('Этот email уже зарегистрирован. Войдите в личный кабинет.');
    }

    const hash = await hashPassword(formData.password, formData.email);

    const profile = {
      leadId:       null,
      email:        formData.email,
      company:      formData.company,
      inn:          formData.inn,
      direction:    formData.direction,
      stage:        formData.stage,
      skolkovo:     formData.skolkovo,
      tier:         'base',
      registeredAt: new Date().toISOString()
    };

    // Сохраняем сессию локально сразу — вход не зависит от Bitrix
    localStorage.setItem(AUTH_KEY, JSON.stringify({ ...profile, _h: hash }));

    // Сохраняем в Bitrix (параллельно: CRM лид + список вендоров)
    try {
      const [leadId] = await Promise.all([
        Bitrix.createLead(formData),
        Bitrix.saveVendorCredentials(formData.email, hash, profile)
      ]);
      profile.leadId = leadId;
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...profile, _h: hash }));
      Bitrix.addActivity(leadId, `Вендор зарегистрировался в ЛК. Email: ${formData.email}`).catch(() => {});
    } catch (e) {
      console.warn('Bitrix недоступен при регистрации, сессия сохранена локально:', e.message);
    }

    return profile;
  },

  async login(email, password) {
    const hash = await hashPassword(password, email);

    // 1. Быстрый путь — локальная сессия
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const local = JSON.parse(stored);
        if (local.email === email) {
          if (local._h === hash) {
            return this._profileFromStored(local);
          }
          // Старый формат хэша (btoa) — миграция
          const oldHash = (() => { try { return btoa(unescape(encodeURIComponent(password + email))); } catch { return null; } })();
          if (local.passwordHash === oldHash || local.passwordHash === btoa(password + email)) {
            // Обновляем до нового хэша
            const updated = { ...local, _h: hash, passwordHash: undefined };
            localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
            this._migrateToNewHash(email, hash, this._profileFromStored(local)).catch(() => {});
            return this._profileFromStored(updated);
          }
          throw new Error('Неверный пароль.');
        }
      } catch (e) {
        if (e.message === 'Неверный пароль.') throw e;
      }
    }

    // 2. Другое устройство — проверяем Bitrix
    let vendor = null;
    try {
      vendor = await Bitrix.findVendorByEmail(email);
    } catch (_) {}

    if (!vendor) {
      // Нет в списке вендоров — может быть старая регистрация до этого обновления
      const lead = await Bitrix.findLeadByEmail(email).catch(() => null);
      if (!lead) throw new Error('Компания не найдена. Пройдите регистрацию.');
      throw new Error('Для входа с нового устройства нужно сбросить пароль. Напишите на program@axoft.ru');
    }

    // Сравниваем хэш
    const storedHash = vendor['PROPERTY_325']
      ? Object.values(vendor['PROPERTY_325'])[0]
      : null;

    if (!storedHash || storedHash !== hash) {
      throw new Error('Неверный пароль.');
    }

    // Восстанавливаем профиль из Bitrix
    let profile;
    try {
      const raw = vendor['PROPERTY_327'] ? Object.values(vendor['PROPERTY_327'])[0] : null;
      profile = raw ? JSON.parse(raw) : {};
    } catch (_) {
      profile = {};
    }

    profile.email = email;
    if (!profile.company) profile.company = vendor.NAME || email;

    // Записываем сессию локально
    localStorage.setItem(AUTH_KEY, JSON.stringify({ ...profile, _h: hash }));
    return profile;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
  },

  getProfile() {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    try {
      const d = JSON.parse(stored);
      return this._profileFromStored(d);
    } catch (_) { return null; }
  },

  isLoggedIn() {
    return !!this.getProfile();
  },

  updateTier(tier) {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return;
    try {
      const d = JSON.parse(stored);
      d.tier = tier;
      localStorage.setItem(AUTH_KEY, JSON.stringify(d));
      // Обновляем профиль в Bitrix (не критично)
      const profile = this._profileFromStored(d);
      Bitrix.updateVendorCredentials(d.email, d._h, profile).catch(() => {});
    } catch (_) {}
  },

  // Миграция старых записей на новый хэш SHA-256
  async _migrateToNewHash(email, newHash, profile) {
    try {
      await Bitrix.saveVendorCredentials(email, newHash, profile);
    } catch (_) {}
  },

  _profileFromStored(d) {
    const { _h, passwordHash, ...profile } = d;
    return profile;
  }
};

export default Auth;
