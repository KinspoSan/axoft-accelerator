// Тесты авторизации — сессия через localStorage seed
import { test, expect } from '@playwright/test';
import { seedSession, TEST_SESSION } from './helpers.js';

test.describe('Защита маршрута', () => {
  test('cabinet.html без сессии → редирект на index.html', async ({ page }) => {
    // Очищаем хранилище
    await page.goto('.');
    await page.evaluate(() => localStorage.clear());

    await page.goto('./cabinet.html');
    // Должны оказаться на index.html (или #/)
    await page.waitForURL(/index\.html|^\/$|\/axoft-accelerator\/?$/, { timeout: 8000 });
    await expect(page.locator('#btn-login')).toBeVisible();
  });

  test('index.html с активной сессией → редирект на cabinet.html', async ({ page }) => {
    await seedSession(page);
    await page.goto('.');
    await page.waitForURL(/cabinet\.html/, { timeout: 8000 });
    await expect(page).toHaveURL(/cabinet\.html/);
  });
});

test.describe('Вход с локальной сессией', () => {
  test('вход с правильными данными → кабинет', async ({ page }) => {
    // Сначала сеем сессию (имитирует ранее выполненную регистрацию)
    await seedSession(page);
    await page.goto('.');
    // auth-init.js перенаправит в cabinet.html
    await page.waitForURL(/cabinet\.html/, { timeout: 8000 });
    await expect(page.locator('#user-name')).not.toHaveText('Загрузка...');
  });

  test('выход из кабинета → редирект на index.html', async ({ page }) => {
    await seedSession(page);
    await page.goto('./cabinet.html');
    await page.waitForSelector('.btn-logout', { timeout: 15_000 });
    await page.click('.btn-logout');
    await page.waitForURL(/index\.html|^\/$|\/axoft-accelerator\/?$/, { timeout: 8000 });
    await expect(page.locator('#btn-login')).toBeVisible();
  });

  test('после выхода — cabinet.html снова редиректит на index', async ({ page }) => {
    await seedSession(page);
    await page.goto('./cabinet.html');
    await page.waitForSelector('.btn-logout', { timeout: 15_000 });
    await page.click('.btn-logout');
    await page.waitForURL(/index\.html|^\/$|\/axoft-accelerator\/?$/, { timeout: 8000 });

    // Теперь пробуем зайти в кабинет напрямую
    await page.goto('./cabinet.html');
    await page.waitForURL(/index\.html|^\/$|\/axoft-accelerator\/?$/, { timeout: 8000 });
    await expect(page.locator('#btn-login')).toBeVisible();
  });
});

test.describe('Форма сброса пароля', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.');
    await page.waitForLoadState('domcontentloaded');
  });

  test('ссылка "Забыл пароль?" открывает форму запроса', async ({ page }) => {
    await expect(page.locator('#form-reset-req')).not.toBeVisible();
    await page.click('.forgot-link');
    await expect(page.locator('#form-reset-req')).toBeVisible();
  });

  test('запрос сброса с незарегистрированным email → ошибка', async ({ page }) => {
    await page.click('.forgot-link');
    await page.fill('#reset-email', 'nobody@nowhere.ru');
    await page.click('#btn-reset-req');
    const err = page.locator('#reset-req-error');
    await expect(err).toBeVisible({ timeout: 15_000 });
    await expect(err).not.toBeEmpty();
  });
});
