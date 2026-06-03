const WEBHOOK = 'https://axoft.bitrix24.ru/rest/1/eismn5zly34zgq99';

const Bitrix = {
  async call(method, params = {}) {
    const res = await fetch(`${WEBHOOK}/${method}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data.result;
  },

  async findLeadByEmail(email) {
    const result = await this.call('crm.lead.list', {
      filter: { 'EMAIL': email },
      select: ['ID', 'TITLE', 'COMPANY_TITLE', 'STATUS_ID']
    });
    return result && result.length > 0 ? result[0] : null;
  },

  async createLead(vendorData) {
    return await this.call('crm.lead.add', {
      fields: {
        TITLE:         `Новый вендор: ${vendorData.company}`,
        EMAIL:         [{ VALUE: vendorData.email, VALUE_TYPE: 'WORK' }],
        COMPANY_TITLE: vendorData.company,
        COMMENTS: `ИНН: ${vendorData.inn}
Направление: ${vendorData.direction}
Стадия: ${vendorData.stage}
Резидент Сколково: ${vendorData.skolkovo ? 'Да' : 'Нет'}
Источник: ЛК Axoft × Сколково`,
        SOURCE_ID:      'WEB',
        STATUS_ID:      'NEW',
        ASSIGNED_BY_ID: 1
      }
    });
  },

  async createDeal(orderData, vendorProfile) {
    return await this.call('crm.deal.add', {
      fields: {
        TITLE:       `[ЛК Сколково] ${orderData.serviceName} — ${vendorProfile.company}`,
        OPPORTUNITY: orderData.price,
        CURRENCY_ID: 'RUB',
        STAGE_ID:    'NEW',
        SOURCE_ID:   'WEB',
        COMMENTS: `Вендор: ${vendorProfile.company}
ИНН: ${vendorProfile.inn}
Email: ${vendorProfile.email}

Сервис: ${orderData.serviceName}
Блок: ${orderData.block}
Стоимость: ${orderData.priceDisplay}`,
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

  // ── Universal Lists ──────────────────────────────────────────────────────

  async getListElements(listId) {
    const result = await this.call('lists.element.get', {
      IBLOCK_TYPE_ID: 'lists',
      IBLOCK_ID:      listId,
      FILTER:         { ACTIVE: 'Y' }
    });
    return result || [];
  },

  // ── Bitrix24 Disk ────────────────────────────────────────────────────────

  async getDiskFileLink(fileId) {
    const result = await this.call('disk.file.getExternalLink', { id: fileId });
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
