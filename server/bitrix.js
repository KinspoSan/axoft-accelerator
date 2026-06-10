// Server-side Bitrix24 wrapper — вебхуки читаются из env, не попадают в браузер

const CRM_WEBHOOK   = () => process.env.BITRIX_CRM_WEBHOOK;
const LISTS_WEBHOOK = () => process.env.BITRIX_LISTS_WEBHOOK;

async function call(webhook, method, params = {}) {
  const url = `${webhook}/${method}.json`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.result;
}

export const Bitrix = {
  async createLead(company) {
    return call(CRM_WEBHOOK(), 'crm.lead.add', {
      fields: {
        TITLE:         `[Сколково] ${company.company}`,
        COMPANY_TITLE: company.company,
        EMAIL:         [{ VALUE: company.email, VALUE_TYPE: 'WORK' }],
        COMMENTS: [
          `ИНН: ${company.inn}`,
          `Направление: ${company.direction}`,
          `Стадия: ${company.stage}`,
          `Резидент Сколково: ${company.skolkovo ? 'Да' : 'Нет'}`,
          `Источник: ЛК Axoft × Сколково`,
          `Дата: ${new Date().toLocaleString('ru')}`,
        ].join('\n'),
        SOURCE_ID:      'WEB',
        STATUS_ID:      'NEW',
        ASSIGNED_BY_ID: 1,
      },
    });
  },

  async createDeal(order, vendor) {
    return call(CRM_WEBHOOK(), 'crm.deal.add', {
      fields: {
        TITLE:       `[ЛК Сколково] ${order.serviceName} — ${vendor.company}`,
        OPPORTUNITY: order.price,
        CURRENCY_ID: 'RUB',
        STAGE_ID:    'NEW',
        SOURCE_ID:   'WEB',
        COMMENTS: [
          `Компания: ${vendor.company}`,
          `ИНН: ${vendor.inn}`,
          `Email: ${vendor.email}`,
          `Сервис: ${order.serviceName}`,
          `Стоимость: ${order.priceDisplay}`,
          `Оплата: ${order.paymentType}`,
        ].join('\n'),
        ...(vendor.bitrixLeadId ? { LEAD_ID: vendor.bitrixLeadId } : {}),
      },
    });
  },

  async addActivity(leadId, message) {
    return call(CRM_WEBHOOK(), 'crm.activity.add', {
      fields: {
        OWNER_TYPE_ID: 1,
        OWNER_ID:      leadId,
        TYPE_ID:       6,
        SUBJECT:       'Действие в ЛК',
        DESCRIPTION:   message,
        COMPLETED:     'Y',
      },
    });
  },

  async getListElements(listId) {
    return call(LISTS_WEBHOOK(), 'lists.element.get', {
      IBLOCK_TYPE_ID: 'lists',
      IBLOCK_ID:      listId,
    });
  },
};
