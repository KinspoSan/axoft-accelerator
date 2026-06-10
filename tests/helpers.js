// Тестовые данные и вспомогательные функции

export const TEST_SESSION = {
  leadId: null,
  email: 'test@axoft-vendor.ru',
  company: 'ООО Axoft Test',
  inn: '7712345671',
  direction: 'ИИ — ML/AI для B2B',
  stage: 'Стартап (до 3 лет), есть MVP',
  skolkovo: true,
  tier: 'strat',
  registeredAt: '2026-06-09T12:00:00.000Z',
  _h: 'f7c2bc942a1c9352f2b510a6e0c95a5fdb515d2991169c026d5b8d0098826049',
};

// Сид сессии через localStorage — обходит Bitrix при тестировании кабинета
export async function seedSession(page, session = TEST_SESSION) {
  await page.goto('.');
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('axoft_vendor_session', JSON.stringify(s));
  }, session);
}

// Открыть кабинет с заранее засеянной сессией.
// addInitScript устанавливает localStorage ДО запуска скриптов страницы —
// избегает двойной навигации (goto index + goto cabinet).
// page.route перехватывает Bitrix write-операции — предотвращает создание
// тестовых сделок/лидов/активностей в реальном CRM при каждом прогоне CI.
export async function openCabinet(page, session = TEST_SESSION) {
  // Паттерн /rest/<id>/ соответствует любому Bitrix webhook без знания токена
  await page.route(/\/rest\/\d+\//, route => {
    const url = route.request().url();
    if (url.includes('crm.deal.add'))         return route.fulfill({ contentType: 'application/json', body: '{"result":9999}' });
    if (url.includes('crm.lead.add'))         return route.fulfill({ contentType: 'application/json', body: '{"result":9998}' });
    if (url.includes('crm.activity.add'))     return route.fulfill({ contentType: 'application/json', body: '{"result":true}' });
    if (url.includes('lists.element.add'))    return route.fulfill({ contentType: 'application/json', body: '{"result":9997}' });
    if (url.includes('lists.element.update')) return route.fulfill({ contentType: 'application/json', body: '{"result":true}' });
    // Read-операции (crm.lead.list, lists.element.get, etc.) — пропускаем
    return route.continue();
  });

  await page.addInitScript((s) => {
    localStorage.clear();
    localStorage.setItem('axoft_vendor_session', JSON.stringify(s));
    localStorage.setItem('axoft_tour_done', '1'); // подавляем авто-тур в тестах
  }, session);
  await page.goto('./cabinet.html');
  await page.waitForFunction(() =>
    document.getElementById('user-name')?.textContent?.trim() !== 'Загрузка...' &&
    document.getElementById('user-name')?.textContent?.trim() !== '',
    { timeout: 25_000 }
  );
}

// Перейти на страницу кабинета по навигации
export async function goPage(page, pageId) {
  await page.evaluate((id) => window.goPage(id), pageId);
  await page.waitForTimeout(300);
}
