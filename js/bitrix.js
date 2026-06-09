// Два webhook: CRM (лиды, сделки, активности) и Lists (универсальные списки)
const CRM_WEBHOOK   = 'https://axoft.bitrix24.ru/rest/1/itnzkkug13yjhs7v';
const LISTS_WEBHOOK = 'https://axoft.bitrix24.ru/rest/1/eismn5zly34zgq99';

// Импортируем Content для чтения настроек (lazy — чтобы не было циклической зависимости)
let _Content = null;
async function getContent() {
  if (!_Content) _Content = (await import('./content.js')).default;
  return _Content;
}

const Bitrix = {
  async call(method, params = {}, webhook = CRM_WEBHOOK) {
    const res = await fetch(`${webhook}/${method}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data.result;
  },

  // ── Вендоры: регистрация ─────────────────────────────────────────────────

  async findLeadByEmail(email) {
    const result = await this.call('crm.lead.list', {
      filter: { 'EMAIL': email },
      select: ['ID', 'TITLE', 'COMPANY_TITLE', 'STATUS_ID']
    });
    return result?.length > 0 ? result[0] : null;
  },

  async createLead(vendorData) {
    return await this.call('crm.lead.add', {
      fields: {
        TITLE:         `Новый вендор: ${vendorData.company}`,
        EMAIL:         [{ VALUE: vendorData.email, VALUE_TYPE: 'WORK' }],
        COMPANY_TITLE: vendorData.company,
        COMMENTS: [
          `ИНН: ${vendorData.inn}`,
          `Направление: ${vendorData.direction}`,
          `Стадия: ${vendorData.stage}`,
          `Резидент Сколково: ${vendorData.skolkovo ? 'Да' : 'Нет'}`,
          `Источник: ЛК Axoft × Сколково`
        ].join('\n'),
        SOURCE_ID:      'WEB',
        STATUS_ID:      'NEW',
        ASSIGNED_BY_ID: 1
      }
    });
  },

  // ── Пакеты: заказы → Сделки ──────────────────────────────────────────────

  async createDeal(orderData, vendorProfile) {
    const dealId = await this.call('crm.deal.add', {
      fields: {
        TITLE:       `[ЛК Сколково] ${orderData.serviceName} — ${vendorProfile.company}`,
        OPPORTUNITY: orderData.price,
        CURRENCY_ID: 'RUB',
        STAGE_ID:    'NEW',
        SOURCE_ID:   'WEB',
        ASSIGNED_BY_ID: 1,
        COMMENTS: [
          `Вендор: ${vendorProfile.company}`,
          `ИНН: ${vendorProfile.inn}`,
          `Email: ${vendorProfile.email}`,
          ``,
          `Сервис: ${orderData.serviceName}`,
          `Блок: ${orderData.block}`,
          `Стоимость: ${orderData.priceDisplay}`
        ].join('\n'),
        ...(vendorProfile.leadId ? { LEAD_ID: vendorProfile.leadId } : {})
      }
    });

    this._sendVendorConfirmation(dealId, 5, {
      name:         orderData.serviceName,
      block:        orderData.block,
      priceDisplay: orderData.priceDisplay || 'По запросу'
    }, vendorProfile).catch(() => {});

    return dealId;
  },

  async getDeals(companyName) {
    const result = await this.call('crm.deal.list', {
      filter: { '%TITLE%': companyName },
      select: ['ID', 'TITLE', 'OPPORTUNITY', 'STAGE_ID', 'DATE_CREATE']
    });
    return result || [];
  },

  async getDealsByIds(ids) {
    if (!ids.length) return [];
    const result = await this.call('crm.deal.list', {
      filter: { 'ID': ids },
      select: ['ID', 'STAGE_ID']
    });
    return result || [];
  },

  async getLeadsByIds(ids) {
    if (!ids.length) return [];
    const result = await this.call('crm.lead.list', {
      filter: { 'ID': ids },
      select: ['ID', 'STATUS_ID']
    });
    return result || [];
  },

  // ── Услуги à la carte: запросы → Лиды ───────────────────────────────────

  async createServiceRequest(serviceData, vendorProfile) {
    const now = new Date().toLocaleString('ru');

    // Читаем настройки из Bitrix24 — email и ID ответственного
    let notifyEmail    = 'konstantin.simakov@axoftglobal.ru';
    let responsibleId  = 1;
    try {
      const Content  = await getContent();
      const settings = await Content.getSettings();
      if (settings.notify_email)          notifyEmail   = settings.notify_email;
      if (settings.notify_responsible_id) responsibleId = parseInt(settings.notify_responsible_id);
    } catch (_) { /* fallback к значениям по умолчанию */ }

    const leadId = await this.call('crm.lead.add', {
      fields: {
        TITLE:          `[Запрос услуги] ${serviceData.name} — ${vendorProfile.company}`,
        COMPANY_TITLE:  vendorProfile.company,
        EMAIL:          [{ VALUE: vendorProfile.email, VALUE_TYPE: 'WORK' }],
        SOURCE_ID:      'WEB',
        STATUS_ID:      'NEW',
        ASSIGNED_BY_ID: responsibleId,
        COMMENTS: [
          `═══ ЗАПРОС НА УСЛУГУ ═══`,
          `Услуга:   ${serviceData.name}`,
          `Пакет:    ${serviceData.block}`,
          `Стоимость: ${serviceData.priceDisplay}`,
          ``,
          `═══ КОМПАНИЯ ═══`,
          `Название: ${vendorProfile.company}`,
          `ИНН:      ${vendorProfile.inn}`,
          `Email:    ${vendorProfile.email}`,
          `Тариф:    ${vendorProfile.tier === 'strat' ? 'UP STRAT' : 'UP BASE'}`,
          ``,
          `Дата запроса: ${now}`,
          `Источник: Личный кабинет Axoft × Сколково`
        ].join('\n')
      }
    });

    // Уведомление менеджеру
    await this._sendEmailActivity(leadId, serviceData, vendorProfile, now, notifyEmail);

    // Подтверждение вендору
    this._sendVendorConfirmation(leadId, 1, {
      name:         serviceData.name,
      block:        serviceData.block,
      priceDisplay: serviceData.priceDisplay || 'По запросу'
    }, vendorProfile).catch(() => {});

    return leadId;
  },

  async _sendEmailActivity(leadId, serviceData, vendorProfile, now, notifyEmail) {
    const subject = `[Запрос услуги] ${serviceData.name} — ${vendorProfile.company}`;
    const body = `
<h3>Новый запрос на услугу</h3>
<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
  <tr><td><b>Услуга</b></td><td>${serviceData.name}</td></tr>
  <tr><td><b>Пакет</b></td><td>${serviceData.block}</td></tr>
  <tr><td><b>Стоимость</b></td><td>${serviceData.priceDisplay}</td></tr>
  <tr><td colspan="2" style="padding-top:12px"><b>Компания-вендор</b></td></tr>
  <tr><td><b>Название</b></td><td>${vendorProfile.company}</td></tr>
  <tr><td><b>ИНН</b></td><td>${vendorProfile.inn}</td></tr>
  <tr><td><b>Email</b></td><td>${vendorProfile.email}</td></tr>
  <tr><td><b>Тариф</b></td><td>${vendorProfile.tier === 'strat' ? 'UP STRAT' : 'UP BASE'}</td></tr>
  <tr><td><b>Дата</b></td><td>${now}</td></tr>
</table>
<p style="color:#666;font-size:12px;margin-top:16px">
  Запрос создан через Личный кабинет Axoft × Сколково
</p>
    `.trim();

    try {
      await this.call('crm.activity.add', {
        fields: {
          OWNER_TYPE_ID:    1,         // 1 = Lead
          OWNER_ID:         leadId,
          TYPE_ID:          4,         // 4 = Email
          DIRECTION:        2,         // Исходящее
          SUBJECT:          subject,
          DESCRIPTION:      body,
          DESCRIPTION_TYPE: 3,         // HTML
          COMPLETED:        'N',       // N = Bitrix попытается отправить
          COMMUNICATIONS: [{
            VALUE:       notifyEmail,
            ENTITY_TYPE: 'CRM_LEAD'
          }]
        }
      });
    } catch (e) {
      // Не критично — основной лид уже создан
      console.warn('Email activity not created:', e.message);
    }
  },

  async _sendVendorConfirmation(entityId, entityTypeId, item, vendorProfile) {
    const now = new Date().toLocaleString('ru');
    const subject = `Заявка принята: ${item.name} — Axoft × Сколково`;
    const body = `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;color:#1e2849">
  <div style="background:#1e2849;padding:18px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:10px">
    <span style="background:#00b0bd;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:4px;letter-spacing:.5px">AXOFT</span>
    <span style="color:rgba(255,255,255,.55);font-size:12px">× Сколково Channel Readiness</span>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #e0e4ef;border-top:none;border-radius:0 0 8px 8px">
    <h2 style="font-size:17px;font-weight:700;margin:0 0 6px;color:#1e2849">Заявка принята ✓</h2>
    <p style="font-size:13px;color:#6b7290;margin:0 0 22px;line-height:1.5">
      Ваша заявка зарегистрирована. Менеджер Axoft свяжется с вами по этому адресу в течение 1 рабочего дня.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5">
      <tr>
        <td style="padding:9px 0;color:#6b7290;width:38%;border-top:1px solid #f0f2f7">Услуга</td>
        <td style="padding:9px 0;font-weight:600;border-top:1px solid #f0f2f7">${item.name}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#6b7290;border-top:1px solid #f0f2f7">Блок</td>
        <td style="padding:9px 0;border-top:1px solid #f0f2f7">${item.block || '—'}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#6b7290;border-top:1px solid #f0f2f7">Стоимость</td>
        <td style="padding:9px 0;border-top:1px solid #f0f2f7">${item.priceDisplay}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#6b7290;border-top:1px solid #f0f2f7">Компания</td>
        <td style="padding:9px 0;border-top:1px solid #f0f2f7">${vendorProfile.company}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#6b7290;border-top:1px solid #f0f2f7">Дата</td>
        <td style="padding:9px 0;border-top:1px solid #f0f2f7">${now}</td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:11px;color:#9aa0b8;border-top:1px solid #f0f2f7;padding-top:16px;line-height:1.6">
      Это письмо отправлено автоматически. Отвечать на него не нужно.<br>
      По вопросам программы: <a href="mailto:program@axoft.ru" style="color:#00b0bd;text-decoration:none">program@axoft.ru</a>
    </p>
  </div>
</div>`.trim();

    await this.call('crm.activity.add', {
      fields: {
        OWNER_TYPE_ID:    entityTypeId,
        OWNER_ID:         entityId,
        TYPE_ID:          4,
        DIRECTION:        2,
        SUBJECT:          subject,
        DESCRIPTION:      body,
        DESCRIPTION_TYPE: 3,
        COMPLETED:        'N',
        COMMUNICATIONS: [{
          VALUE:       vendorProfile.email,
          ENTITY_TYPE: 'EMAIL'
        }]
      }
    });
  },

  // ── Вендоры: аутентификация ──────────────────────────────────────────────

  async saveVendorCredentials(email, hash, profile) {
    // CODE = email (ключ поиска), NAME = название компании
    const fields = {
      NAME:   profile.company,
      SORT:   '100',
      ACTIVE: 'Y',
      'PROPERTY_325': hash,
      'PROPERTY_327': JSON.stringify(profile)
    };
    return await this.call('lists.element.add', {
      IBLOCK_TYPE_ID: 'lists',
      IBLOCK_ID:      131,
      ELEMENT_CODE:   encodeURIComponent(email),
      FIELDS:         fields
    }, LISTS_WEBHOOK);
  },

  async findVendorByEmail(email) {
    const result = await this.call('lists.element.get', {
      IBLOCK_TYPE_ID: 'lists',
      IBLOCK_ID:      131,
      FILTER:         { CODE: encodeURIComponent(email), ACTIVE: 'Y' }
    }, LISTS_WEBHOOK);
    return result?.length > 0 ? result[0] : null;
  },

  async updateVendorCredentials(email, hash, profile) {
    // Находим элемент и обновляем
    const existing = await this.findVendorByEmail(email);
    if (!existing) return this.saveVendorCredentials(email, hash, profile);
    return await this.call('lists.element.update', {
      IBLOCK_TYPE_ID: 'lists',
      IBLOCK_ID:      131,
      ELEMENT_ID:     existing.ID,
      FIELDS: {
        'PROPERTY_325': hash,
        'PROPERTY_327': JSON.stringify(profile)
      }
    }, LISTS_WEBHOOK);
  },

  // ── Universal Lists ──────────────────────────────────────────────────────

  async getListElements(listId) {
    const result = await this.call('lists.element.get', {
      IBLOCK_TYPE_ID: 'lists',
      IBLOCK_ID:      listId,
      FILTER:         { ACTIVE: 'Y' }
    }, LISTS_WEBHOOK);
    return result || [];
  },

  // ── Disk ─────────────────────────────────────────────────────────────────

  async getDiskFileLink(fileId) {
    const result = await this.call('disk.file.getExternalLink', { id: fileId }, LISTS_WEBHOOK);
    return result || null;
  },

  // ── Activities ───────────────────────────────────────────────────────────

  async addActivity(leadId, message) {
    try {
      await this.call('crm.activity.add', {
        fields: {
          OWNER_TYPE_ID: 1,
          OWNER_ID:      leadId,
          TYPE_ID:       6,
          SUBJECT:       'Действие в ЛК',
          DESCRIPTION:   message,
          COMPLETED:     'Y'
        }
      });
    } catch (e) {
      console.warn('Activity not saved:', e.message);
    }
  }
};

export default Bitrix;
