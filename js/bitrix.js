// Два webhook: CRM (лиды, сделки, активности) и Lists (универсальные списки)
const CRM_WEBHOOK   = 'https://axoft.bitrix24.ru/rest/1/itnzkkug13yjhs7v';
const LISTS_WEBHOOK = 'https://axoft.bitrix24.ru/rest/1/eismn5zly34zgq99';

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
    return await this.call('crm.deal.add', {
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
  },

  async getDeals(email) {
    const result = await this.call('crm.deal.list', {
      filter: { '%TITLE': email },
      select: ['ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID', 'STAGE_ID', 'DATE_CREATE']
    });
    return result || [];
  },

  // ── Услуги à la carte: запросы → Лиды ───────────────────────────────────

  async createServiceRequest(serviceData, vendorProfile) {
    const now = new Date().toLocaleString('ru');
    const leadId = await this.call('crm.lead.add', {
      fields: {
        TITLE:         `[Запрос услуги] ${serviceData.name} — ${vendorProfile.company}`,
        COMPANY_TITLE: vendorProfile.company,
        EMAIL:         [{ VALUE: vendorProfile.email, VALUE_TYPE: 'WORK' }],
        SOURCE_ID:     'WEB',
        STATUS_ID:     'NEW',
        ASSIGNED_BY_ID: 1,
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

    // Email-activity — дублирует уведомление в почту (если настроен коннектор)
    await this._sendEmailActivity(leadId, serviceData, vendorProfile, now);

    return leadId;
  },

  async _sendEmailActivity(leadId, serviceData, vendorProfile, now) {
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
            VALUE:       'konstantin.simakov@axoftglobal.ru',
            ENTITY_TYPE: 'CRM_LEAD'
          }]
        }
      });
    } catch (e) {
      // Не критично — основной лид уже создан
      console.warn('Email activity not created:', e.message);
    }
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
