import Bitrix from './bitrix.js';

const AUTH_KEY = 'axoft_vendor_session';

const Auth = {
  async register(formData) {
    const existing = await Bitrix.findLeadByEmail(formData.email);
    if (existing) {
      throw new Error('Этот email уже зарегистрирован. Войдите в личный кабинет.');
    }

    const leadId = await Bitrix.createLead(formData);

    const profile = {
      leadId,
      email:       formData.email,
      company:     formData.company,
      inn:         formData.inn,
      direction:   formData.direction,
      stage:       formData.stage,
      skolkovo:    formData.skolkovo,
      tier:        'base',
      registeredAt: new Date().toISOString(),
      passwordHash: btoa(formData.password + formData.email)
    };

    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));

    try {
      await Bitrix.addActivity(leadId, `Вендор зарегистрировался в ЛК. Email: ${formData.email}`);
    } catch (e) {
      console.warn('Не удалось записать активность:', e.message);
    }

    return profile;
  },

  async login(email, password) {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const profile = JSON.parse(stored);
      if (profile.email === email) {
        const hash = btoa(password + email);
        if (profile.passwordHash === hash) return profile;
        throw new Error('Неверный пароль. Обратитесь в поддержку: program@axoft.ru');
      }
    }
    const lead = await Bitrix.findLeadByEmail(email);
    if (!lead) throw new Error('Пользователь не найден. Пройдите регистрацию.');
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
