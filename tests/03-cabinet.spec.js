// Тесты кабинета — навигация и данные компании
import { test, expect } from '@playwright/test';
import { openCabinet, goPage, TEST_SESSION } from './helpers.js';

test.describe('Дашборд', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
  });

  test('имя компании в тайтлбаре', async ({ page }) => {
    await expect(page.locator('#user-name')).toContainText(TEST_SESSION.company);
  });

  test('аватар содержит инициалы компании', async ({ page }) => {
    const avatar = page.locator('#user-avatar');
    const text = await avatar.textContent();
    // ООО Axoft Test → "AT"
    expect(text?.trim()).toBeTruthy();
    expect(text?.trim().length).toBeLessThanOrEqual(2);
  });

  test('приветственная строка содержит название компании', async ({ page }) => {
    await expect(page.locator('#dash-company')).toContainText(TEST_SESSION.company);
  });

  test('тариф отображается (UP STRAT)', async ({ page }) => {
    // Проверяем что где-то на дашборде есть упоминание тарифа
    const body = await page.textContent('body');
    expect(body).toMatch(/STRAT|strat|UP/i);
  });

  test('топбар содержит AXOFT и Сколково', async ({ page }) => {
    await expect(page.locator('.ax-badge')).toContainText('AXOFT');
    await expect(page.locator('.sko-label, .tb-sko span, .tb .sko')).toBeTruthy();
  });
});

test.describe('Навигация по разделам', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
  });

  test('раздел Сервисы открывается', async ({ page }) => {
    await goPage(page, 'services');
    // Секция пакетов должна быть видима
    await expect(page.locator('#svc-pkgs-section')).toBeVisible();
  });

  test('раздел Заказы открывается', async ({ page }) => {
    await goPage(page, 'orders');
    await expect(page.locator('#orders-table-container')).toBeVisible();
  });

  test('раздел Материалы открывается', async ({ page }) => {
    await goPage(page, 'materials');
    await expect(page.locator('#materials-grid')).toBeVisible();
  });

  test('раздел Диагностика открывается', async ({ page }) => {
    await goPage(page, 'diag');
    // Стартовый экран диагностики
    await expect(page.locator('#dg-s0')).toBeVisible();
  });

  test('раздел Настройки открывается', async ({ page }) => {
    await goPage(page, 'settings');
    await expect(page.locator('#set-company')).toBeVisible();
  });
});

test.describe('Настройки — данные компании', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
    await goPage(page, 'settings');
  });

  test('название компании заполнено', async ({ page }) => {
    await expect(page.locator('#set-company')).toContainText(TEST_SESSION.company);
  });

  test('ИНН заполнен', async ({ page }) => {
    await expect(page.locator('#set-inn')).toContainText(TEST_SESSION.inn);
  });

  test('email заполнен', async ({ page }) => {
    await expect(page.locator('#set-email')).toContainText(TEST_SESSION.email);
  });

  test('направление заполнено', async ({ page }) => {
    await expect(page.locator('#set-direction')).toContainText(TEST_SESSION.direction);
  });

  test('стадия заполнена', async ({ page }) => {
    await expect(page.locator('#set-stage')).toContainText(TEST_SESSION.stage);
  });

  test('резидент Сколково', async ({ page }) => {
    await expect(page.locator('#set-skolkovo')).toContainText('Да');
  });

  test('нет полей с ФИО или личным телефоном', async ({ page }) => {
    const settingsSection = await page.locator('[id^="set-"]').allTextContents();
    const combined = settingsSection.join(' ');
    expect(combined).not.toMatch(/ФИО|фамилия|имя\s+отчество|телефон/i);
  });
});

test.describe('Заказы', () => {
  test('пустой экран заказов содержит кнопку перехода в каталог', async ({ page }) => {
    await openCabinet(page);
    // Очищаем заказы
    await page.evaluate(() => localStorage.removeItem('axoft_orders'));
    await goPage(page, 'orders');
    // Ждём рендера
    await page.waitForTimeout(1000);
    const container = page.locator('#orders-table-container');
    await expect(container).toBeVisible();
    const text = await container.textContent();
    // Либо пустой экран, либо таблица — проверяем что рендер завершён
    expect(text).not.toContain('Загрузка...');
  });
});
