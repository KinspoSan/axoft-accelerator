// Мобильная адаптация (viewport iPhone 12: 390×844)
import { test, expect } from '@playwright/test';
import { openCabinet, goPage } from './helpers.js';

test.describe('Мобильный: страница входа', () => {
  test('форма входа видна целиком без горизонтального скролла', async ({ page }) => {
    await page.goto('.');
    const card = page.locator('.card');
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  });

  test('вкладки Войти/Регистрация переключаются', async ({ page }) => {
    await page.goto('.');
    await page.waitForFunction(() => typeof window.showTab === 'function', { timeout: 10_000 });
    await page.click('#tab-register');
    await expect(page.locator('#form-register')).toBeVisible();
  });
});

test.describe('Мобильный: кабинет', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
  });

  test('сайдбар/навбар видим', async ({ page }) => {
    // На мобильном может быть либо боттом-навбар, либо бургер-меню
    const nav = page.locator('.sb, .nav-bottom, .nb').first();
    await expect(nav).toBeVisible();
  });

  test('дашборд рендерится без горизонтального скролла', async ({ page }) => {
    const width = page.viewportSize().width;
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(width + 2);
  });

  test('раздел Настройки — данные не обрезаются', async ({ page }) => {
    await goPage(page, 'settings');
    await expect(page.locator('#set-company')).toBeVisible();
    await expect(page.locator('#set-inn')).toBeVisible();
  });

  test('раздел Заказы — таблица с горизонтальным скроллом (не ломает верстку)', async ({ page }) => {
    await goPage(page, 'orders');
    await page.waitForTimeout(1000);
    // Страница в целом не расширяется за viewport
    const vw = page.viewportSize().width;
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(vw + 2);
  });
});
