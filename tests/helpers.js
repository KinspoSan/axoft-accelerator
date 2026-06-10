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

// Открыть кабинет с заранее засеянной сессией
export async function openCabinet(page, session = TEST_SESSION) {
  await seedSession(page, session);
  await page.goto('./cabinet.html');
  // Ждём инициализации app.js (компания в тайтле)
  await page.waitForFunction(() =>
    document.getElementById('user-name')?.textContent?.trim() !== 'Загрузка...' &&
    document.getElementById('user-name')?.textContent?.trim() !== '',
    { timeout: 15_000 }
  );
}

// Перейти на страницу кабинета по навигации
export async function goPage(page, pageId) {
  await page.evaluate((id) => window.goPage(id), pageId);
  await page.waitForTimeout(300);
}
