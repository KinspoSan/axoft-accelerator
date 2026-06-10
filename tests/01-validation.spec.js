// Тесты валидации форм — без обращений к Bitrix24
import { test, expect } from '@playwright/test';

// Хелпер: переключиться на вкладку регистрации
async function goToRegister(page) {
  await page.goto('.');
  await page.waitForFunction(() => typeof window.showTab === 'function', { timeout: 10_000 });
  await page.click('#tab-register');
  await expect(page.locator('#form-register')).toBeVisible();
}

// Хелпер: заполнить форму регистрации с корректными данными (кроме указанных)
async function fillValidForm(page, overrides = {}) {
  const data = {
    inn: '7712345671',
    company: 'ООО Тест',
    direction: 1,  // index
    stage: 1,
    email: 'test@example.ru',
    password: 'Password123',
    password2: 'Password123',
    ...overrides
  };
  // INN заполняется ПЕРВЫМ — его input-listener сбрасывает company
  await page.fill('#r-inn', data.inn);
  await page.fill('#r-company', data.company);
  if (data.direction !== null) await page.selectOption('#r-direction', { index: data.direction });
  if (data.stage !== null)     await page.selectOption('#r-stage', { index: data.stage });
  await page.fill('#r-email', data.email);
  await page.fill('#r-password', data.password);
  await page.fill('#r-password2', data.password2);
}

test.describe('Валидация формы регистрации', () => {
  test.beforeEach(async ({ page }) => {
    await goToRegister(page);
  });

  test('пустая форма → ИНН проверяется первым (реальное поведение)', async ({ page }) => {
    // INN проверяется ДО остальных полей — пустой INN даёт именно эту ошибку
    await page.click('#btn-register');
    const err = page.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('ИНН');
  });

  test('пустое название компании → ошибка', async ({ page }) => {
    await page.fill('#r-inn', '7712345671');
    // company остаётся пустым
    await page.selectOption('#r-direction', { index: 1 });
    await page.selectOption('#r-stage', { index: 1 });
    await page.fill('#r-email', 'test@example.ru');
    await page.fill('#r-password', 'Password123');
    await page.fill('#r-password2', 'Password123');
    await page.click('#btn-register');
    const err = page.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('компани');
  });

  test('ИНН 9 цифр → ошибка формата', async ({ page }) => {
    await fillValidForm(page, { inn: '123456789' });
    await page.click('#btn-register');
    const err = page.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('ИНН');
  });

  test('ИНН 10 цифр, неверная контрольная сумма → ошибка', async ({ page }) => {
    await fillValidForm(page, { inn: '7712345670' });
    await page.click('#btn-register');
    const err = page.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('ИНН');
  });

  test('пароль короче 8 символов → ошибка', async ({ page }) => {
    await fillValidForm(page, { password: 'short1', password2: 'short1' });
    await page.click('#btn-register');
    const err = page.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('8 символ');
  });

  test('пароли не совпадают → ошибка', async ({ page }) => {
    await fillValidForm(page, { password: 'Password123', password2: 'Different123' });
    await page.click('#btn-register');
    const err = page.locator('#reg-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('не совпадают');
  });

  test('ввод в поле скрывает ошибку', async ({ page }) => {
    await page.click('#btn-register');
    await expect(page.locator('#reg-error')).toBeVisible();
    // Ввод в любое поле должен скрывать ошибку
    await page.locator('#r-inn').press('1');
    await expect(page.locator('#reg-error')).not.toBeVisible();
  });
});

test.describe('Валидация формы входа', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.');
    await page.waitForFunction(() => typeof window.showTab === 'function', { timeout: 10_000 });
  });

  test('пустые поля → "Введите email и пароль"', async ({ page }) => {
    await page.click('#btn-login');
    const err = page.locator('#login-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('email и пароль');
  });

  test('только email → ошибка', async ({ page }) => {
    await page.fill('#l-email', 'test@example.ru');
    await page.click('#btn-login');
    const err = page.locator('#login-error');
    await expect(err).toBeVisible();
  });

  test('неверный пароль → ошибка (с ожиданием Bitrix)', async ({ page }) => {
    await page.fill('#l-email', 'nonexistent@example.ru');
    await page.fill('#l-password', 'WrongPass123');
    await page.click('#btn-login');
    const err = page.locator('#login-error');
    await expect(err).toBeVisible({ timeout: 15_000 });
    await expect(err).not.toBeEmpty();
  });
});

test.describe('Страница входа — структура', () => {
  test('топбар содержит AXOFT и Сколково', async ({ page }) => {
    await page.goto('.');
    await expect(page.locator('.ax-badge')).toContainText('AXOFT');
    await expect(page.locator('.tb-sko span')).toContainText('Сколково');
  });

  test('переключение вкладок Войти / Регистрация', async ({ page }) => {
    await page.goto('.');
    await page.waitForFunction(() => typeof window.showTab === 'function', { timeout: 10_000 });
    // По умолчанию — форма входа
    await expect(page.locator('#form-login')).toBeVisible();
    await expect(page.locator('#form-register')).not.toBeVisible();

    await page.click('#tab-register');
    await expect(page.locator('#form-register')).toBeVisible();
    await expect(page.locator('#form-login')).not.toBeVisible();

    await page.click('#tab-login');
    await expect(page.locator('#form-login')).toBeVisible();
    await expect(page.locator('#form-register')).not.toBeVisible();
  });

  test('дисклеймер на форме регистрации', async ({ page }) => {
    await goToRegister(page);
    await expect(page.locator('.disclaimer')).toContainText('Персональные данные физических лиц не собираются');
  });
});
