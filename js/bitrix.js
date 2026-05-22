// Bitrix24 REST API wrapper
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

  async createLead(vendorData) {
    return await this.call('crm.lead.add', {
      fields: {
        TITLE:         `Новый вендор: ${vendorData.company}`,
        NAME:          vendorData.contactName || vendorData.company,
        EMAIL:         [{ VALUE: vendorData.email, VALUE_TYPE: 'WORK' }],
        COMPANY_TITLE: vendorData.company,
        UF_CRM_INN:    vendorData.inn,
        COMMENTS: `Направление: ${vendorData.direction}
Стадия: ${vendorData.stage}
Резидент Сколково: ${vendorData.skolkovo ? 'Да' : 'Нет'}
Тариф: UP BASE
Источник: ЛК Axoft × Сколково`.trim(),
        SOURCE_ID:      'WEB',
        STATUS_ID:      'NEW',
        ASSIGNED_BY_ID: 1
      }
    });
  },

  async findLeadByEmail(email) {
    const result = await this.call('crm.lead.list', {
      filter: { 'EMAIL': email },
      select: ['ID', 'TITLE', 'NAME', 'COMPANY_TITLE', 'COMMENTS', 'STATUS_ID']
    });
    return result && result.length > 0 ? result[0] : null;
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
Стоимость: ${orderData.priceDisplay}
Оплата: ${orderData.paymentType}
Тариф вендора: ${vendorProfile.tier}`.trim(),
        ...(vendorProfile.leadId ? { LEAD_ID: vendorProfile.leadId } : {})
      }
    });
  },

  async getDeals(email) {
    const result = await this.call('crm.deal.list', {
      filter: { 'TITLE': `%${email}%` },
      select: ['ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID', 'STAGE_ID', 'DATE_CREATE', 'COMMENTS']
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
