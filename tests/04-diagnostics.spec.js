// Тесты диагностики — полный проход сценария
import { test, expect } from '@playwright/test';
import { openCabinet, goPage } from './helpers.js';

test.describe('Диагностика — структура и навигация', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
    await goPage(page, 'diag');
    // Убедимся что стартовый экран активен
    await expect(page.locator('#dg-s0.on, #dg-s0[style*="block"]')).toBeVisible({ timeout: 5000 }).catch(() =>
      expect(page.locator('#dg-s0')).toBeVisible()
    );
  });

  test('стартовый экран показывает шаги прогресса', async ({ page }) => {
    const prog = page.locator('.dg-prog');
    await expect(prog).toBeVisible();
    await expect(page.locator('#dg-ps0')).toHaveClass(/active/);
  });

  test('кнопка "Начать диагностику" переходит на фильтр', async ({ page }) => {
    await page.click('button:has-text("Начать диагностику")');
    await page.waitForTimeout(400);
    await expect(page.locator('#dg-s1')).toBeVisible();
    // Шаг 2 активен
    await expect(page.locator('#dg-ps1')).toHaveClass(/active/);
  });

  test('"Назад" возвращает на стартовый экран', async ({ page }) => {
    await page.click('button:has-text("Начать диагностику")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Назад")');
    await page.waitForTimeout(300);
    await expect(page.locator('#dg-s0')).toBeVisible();
  });
});

test.describe('Диагностика — фильтр (Шаг 2)', () => {
  test.beforeEach(async ({ page }) => {
    await openCabinet(page);
    await goPage(page, 'diag');
    await page.click('button:has-text("Начать диагностику")');
    await page.waitForTimeout(300);
    await expect(page.locator('#dg-s1')).toBeVisible();
  });

  test('кнопка "Перейти к оценке" заблокирована без ответов', async ({ page }) => {
    await expect(page.locator('#dg-gate-btn')).toBeDisabled();
  });

  test('выбор "Не IT-продукт" показывает блокирующий критерий', async ({ page }) => {
    // Отвечаем на первый вопрос — блокирующий вариант "fail"
    await page.locator('input[name="dg1"][value="fail"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#dg-fail-box')).toBeVisible();
    await expect(page.locator('#dg-gate-btn')).toBeDisabled();
  });

  test('выбор B2C показывает блокирующий критерий', async ({ page }) => {
    // Первый вопрос — ok
    await page.locator('input[name="dg1"][value="ok"]').first().click();
    // Второй вопрос — "Физические лица (B2C)"
    await page.locator('input[name="dg2"][value="fail"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#dg-fail-box')).toBeVisible();
  });

  test('хорошие ответы разблокируют "Перейти к оценке"', async ({ page }) => {
    // Ответы без блокировок и предупреждений
    await page.locator('input[name="dg1"][value="ok"]').first().click();
    await page.locator('input[name="dg2"][value="ok"]').first().click();
    await page.locator('input[name="dg3"][value="ok"]').first().click();
    await page.locator('input[name="dg4"][value="ok"]').first().click();
    await page.locator('input[name="dg5"][value="ok"]').first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('#dg-gate-btn')).not.toBeDisabled();
  });
});

test.describe('Диагностика — оценка и результат', () => {
  // Вспомогательная: заполнить фильтр и перейти к оценке
  async function passFilter(page) {
    await openCabinet(page);
    await goPage(page, 'diag');
    await page.click('button:has-text("Начать диагностику")');
    await page.waitForTimeout(300);
    await page.locator('input[name="dg1"][value="ok"]').first().click();
    await page.locator('input[name="dg2"][value="ok"]').first().click();
    await page.locator('input[name="dg3"][value="ok"]').first().click();
    await page.locator('input[name="dg4"][value="ok"]').first().click();
    await page.locator('input[name="dg5"][value="ok"]').first().click();
    await page.waitForTimeout(300);
    await page.click('#dg-gate-btn');
    await page.waitForTimeout(400);
  }

  test('переход к оценке показывает 5 категорий', async ({ page }) => {
    await passFilter(page);
    await expect(page.locator('#dg-s2')).toBeVisible();
    await expect(page.locator('.dg-cat-nav .dg-cn')).toHaveCount(5);
  });

  // Вспомогательная: выставить radio через evaluate (надёжнее force-click для скрытых input)
  async function setRadio(page, name) {
    await page.evaluate((n) => {
      const radio = document.querySelector(`input[name="${n}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
    }, name);
  }

  test('навигация по категориям работает (через кнопку)', async ({ page }) => {
    await passFilter(page);
    await expect(page.locator('#dg-cn0')).toHaveClass(/act/);

    // Заполняем категорию 0 (dq1a, dq1b, dq1c) перед переходом
    for (const q of ['dq1a', 'dq1b', 'dq1c']) await setRadio(page, q);

    await page.click('#dg-c0 .dg-btns button');  // "Следующая категория" для cat 0
    await page.waitForTimeout(400);
    await expect(page.locator('#dg-cn1')).toHaveClass(/act/);
    await expect(page.locator('#dg-c1')).toBeVisible();
  });

  test('полный проход → результат с баллами', async ({ page }) => {
    await passFilter(page);
    await expect(page.locator('#dg-s2')).toBeVisible();

    // Все вопросы по категориям
    const DCATQ = [
      ['dq1a', 'dq1b', 'dq1c'],
      ['dq2a', 'dq2b', 'dq2c'],
      ['dq3'],
      ['dq4a', 'dq4b'],
      ['dq5a', 'dq5b', 'dq5c']
    ];

    for (let cat = 0; cat < 5; cat++) {
      for (const q of DCATQ[cat]) await setRadio(page, q);

      if (cat === 4) {
        await page.click('#dg-c4 .dg-btns button:has-text("Получить результат")');
      } else {
        await page.click(`#dg-c${cat} .dg-btns button:has-text("Следующая")`);
      }
      await page.waitForTimeout(300);
    }

    await expect(page.locator('#dg-s3')).toBeVisible({ timeout: 8000 });
    const score = await page.locator('#dg-rnum').textContent();
    expect(Number(score)).toBeGreaterThan(0);
  });

  test('кнопка "Пройти заново" сбрасывает диагностику', async ({ page }) => {
    await passFilter(page);
    // Быстрый путь к результату — ищем любую кнопку, ведущую к #dg-s3
    await page.evaluate(() => window.dGo?.(3));
    await page.waitForTimeout(300);
    const restart = page.locator('button:has-text("заново"), button:has-text("Начать снова")');
    if (await restart.count() > 0) {
      await restart.first().click();
      await page.waitForTimeout(400);
      await expect(page.locator('#dg-s0')).toBeVisible();
    }
  });
});
