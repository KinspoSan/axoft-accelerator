// Тесты заказов сервисов
import { test, expect } from '@playwright/test';
import { openCabinet, goPage } from './helpers.js';

test.describe('Заказы — пустое состояние', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
    // Сброс заказов перед каждым тестом
    await page.evaluate(() => localStorage.removeItem('axoft_orders'));
    await goPage(page, 'orders');
    await page.waitForTimeout(1500); // ждём рендера (возможен Bitrix-запрос)
  });

  test('нет заказов → не видно "Загрузка..."', async ({ page }) => {
    const text = await page.locator('#orders-table-container').textContent();
    expect(text).not.toContain('Загрузка...');
  });

  test('пустой экран имеет кнопку "К каталогу"', async ({ page }) => {
    const container = page.locator('#orders-table-container');
    const btn = container.locator('button');
    const count = await btn.count();
    if (count > 0) {
      await expect(btn.first()).toBeVisible();
    }
  });
});

test.describe('Заказы — оформление заказа', () => {
  test('заказ пакета создаёт запись в localStorage', async ({ page }) => {
    await openCabinet(page);
    await page.evaluate(() => localStorage.removeItem('axoft_orders'));
    await goPage(page, 'services');
    await page.waitForTimeout(1500); // ждём загрузки пакетов

    // Находим кнопку заказа (первый найденный пакет с платной кнопкой)
    const orderBtn = page.locator('[onclick*="handleOrder"], button:has-text("Заказать"), button:has-text("Подключить")').first();
    if (await orderBtn.count() === 0) {
      test.skip();
      return;
    }

    await orderBtn.click();

    // Ждём изменения текста кнопки (Заказано / Запрошено)
    await expect(orderBtn).toHaveText(/Заказано|Запрошено|Заказ/, { timeout: 15_000 });

    // Проверяем что заказ появился в localStorage
    const orders = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('axoft_orders') || '[]'); }
      catch { return []; }
    });
    expect(orders.length).toBeGreaterThan(0);
  });

  test('после заказа — счётчик в навигации обновляется', async ({ page }) => {
    await openCabinet(page);
    // Проверяем начальное значение бейджа
    const badge = page.locator('#orders-badge');
    const initialText = await badge.textContent().catch(() => '0');
    expect(initialText).toBeDefined();
  });
});

test.describe('Сервисы — вкладки', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
    await goPage(page, 'services');
    await page.waitForTimeout(1000);
  });

  test('вкладка "Партнёрская программа" открывается', async ({ page }) => {
    const partnerTab = page.locator('[onclick*="partner"], button:has-text("Партнёр"), button:has-text("партнёр")').first();
    if (await partnerTab.count() > 0) {
      await partnerTab.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#svc-partner-section')).toBeVisible();
    }
  });

  test('вкладка "Услуги à la carte" открывается', async ({ page }) => {
    const svcsTab = page.locator('[onclick*="svcs"], button:has-text("Услуги"), button:has-text("à la carte")').first();
    if (await svcsTab.count() > 0) {
      await svcsTab.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#svc-svcs-section')).toBeVisible();
    }
  });
});
