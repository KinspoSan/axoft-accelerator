import Bitrix from './bitrix.js';

const AUTH_KEY = 'axoft_vendor_session';

const Auth = {
  async register(formData) {
    // Проверяем дубль только в локальном хранилище — Bitrix не блокирует регистрацию
    const existingLocal = this.getProfile();
    if (existingLocal && existingLocal.email === formData.email) {
      throw new Error('Этот email уже зарегистрирован. Войдите в личный кабинет.');
    }

    // Сохраняем сессию ДО вызова Bitrix — пользователь не потеряет доступ даже если API недоступен
    const profile = {
      leadId:       null,
      email:        formData.email,
      company:      formData.company,
      inn:          formData.inn,
      direction:    formData.direction,
      stage:        formData.stage,
      skolkovo:     formData.skolkovo,
      tier:         'base',
      registeredAt: new Date().toISOString(),
      passwordHash: btoa(unescape(encodeURIComponent(formData.password + formData.email)))
    };

    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));

    // Отправляем лид в Bitrix асинхронно — ошибка не блокирует вход
    try {
      const leadId = await Bitrix.createLead(formData);
      profile.leadId = leadId;
      localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
      Bitrix.addActivity(leadId, `Вендор зарегистрировался в ЛК. Email: ${formData.email}`).catch(() => {});
    } catch (e) {
      console.warn('Bitrix недоступен при регистрации, сессия сохранена локально:', e.message);
    }

    return profile;
  },

  async login(email, password) {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const profile = JSON.parse(stored);
      if (profile.email === email) {
        // Проверяем хэш в новом формате (с unescape/encodeURIComponent для поддержки Unicode)
        const hashNew = btoa(unescape(encodeURIComponent(password + email)));
        // Также проверяем старый формат (без unescape) для обратной совместимости
        const hashOld = (() => { try { return btoa(password + email); } catch { return null; } })();
        if (profile.passwordHash === hashNew || profile.passwordHash === hashOld) return profile;
        throw new Error('Неверный пароль. Обратитесь в поддержку: program@axoft.ru');
      }
    }
    // Сессия отсутствует (другое устройство или очищен кэш) — проверяем Bitrix
    let lead = null;
    try {
      lead = await Bitrix.findLeadByEmail(email);
    } catch (_) { /* Bitrix недоступен */ }

    if (!lead) {
      throw new Error('Компания не найдена. Пройдите регистрацию или войдите с устройства, где регистрировались.');
    }
    throw new Error('Войдите с устройства, где проходили регистрацию, или обратитесь в поддержку: program@axoft.ru');
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
  },

  getProfile() {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  isLoggedIn() {
    return !!this.getProfile();
  },

  updateTier(tier) {
    const profile = this.getProfile();
    if (profile) {
      profile.tier = tier;
      localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
    }
  }
};

export default Auth;
