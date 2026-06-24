// 07-skolkovo-course.spec.js — тесты блока «Полезное от Сколково»
// Запускать против mock-сервера: BASE_URL=http://localhost:3737 npx playwright test 07-skolkovo

import { test, expect } from '@playwright/test';

// Сброс серверного прогресса перед каждым тестом
test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3737/api/test/reset-progress');
});

// Открываем dist/lk/cabinet.html через mock-сервер.
// page.route перехватывает Bitrix-запросы, /api/profile уже отдаёт mock-сервер.
async function openCabinet(page) {
  // Заглушки Bitrix Lists / CRM — они содержат плейсхолдеры, но всё равно могут улететь
  await page.route('**/__BITRIX_CRM_WEBHOOK__/**',   r => r.fulfill({ contentType: 'application/json', body: '{"result":[]}' }));
  await page.route('**/__BITRIX_LISTS_WEBHOOK__/**', r => r.fulfill({ contentType: 'application/json', body: '{"result":[]}' }));
  // Любые внешние Bitrix-хосты (vibecode.bitrix24.tech и т.п.)
  await page.route('**/rest/**/*.json',              r => r.fulfill({ contentType: 'application/json', body: '{"result":[]}' }));

  // Подавляем тур при старте
  await page.addInitScript(() => localStorage.setItem('axoft_tour_done', '1'));

  await page.goto('http://localhost:3737/cabinet.html');

  // Ждём инициализации кабинета
  await page.waitForFunction(
    () => document.getElementById('user-name')?.textContent?.trim() !== 'Загрузка...'
       && document.getElementById('user-name')?.textContent?.trim() !== '',
    { timeout: 20_000 }
  );
}

// Переходим в нужный раздел и активируем фильтр «Полезное от Сколково»
async function openCourse(page) {
  await page.evaluate(() => window.goPage('materials'));
  await expect(page.locator('#page-materials')).toBeVisible();
  await page.click('button.mat-filters:has-text("Полезное от Сколково")');
  await expect(page.locator('#skolkovo-course')).toBeVisible({ timeout: 10_000 });
}

// ── 1. Переключение фильтра ───────────────────────────────────────────────────
test('скрывает сетку и показывает курс при выборе фильтра', async ({ page }) => {
  await openCabinet(page);
  await page.evaluate(() => window.goPage('materials'));
  await expect(page.locator('#page-materials')).toBeVisible();

  await expect(page.locator('#skolkovo-course')).toBeHidden();
  await expect(page.locator('#materials-grid-wrap')).toBeVisible();

  await page.click('button.mat-filters:has-text("Полезное от Сколково")');

  await expect(page.locator('#materials-grid-wrap')).toBeHidden();
  await expect(page.locator('#skolkovo-course')).toBeVisible();
});

// ── 2. Интро и 4 модуля ──────────────────────────────────────────────────────
test('показывает интро и 4 модуля после загрузки', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);

  await expect(page.locator('.sko-intro')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.mod-card')).toHaveCount(4, { timeout: 10_000 });

  await expect(page.locator('.mod-title').first()).toContainText('Рынок');
  await expect(page.locator('.mod-title').nth(3)).toContainText('Дорожная карта');
});

// ── 3. Тест скрыт до просмотра видео ────────────────────────────────────────
test('тест скрыт до просмотра видео, подсказка видна', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);
  await expect(page.locator('.mod-card')).toHaveCount(4, { timeout: 10_000 });

  await expect(page.locator('#test-market')).toHaveClass(/hidden/);
  await expect(page.locator('#wait-market')).toBeVisible();
});

// ── 4. video.ended → POST /api/modules/video → тест открыт ──────────────────
test('тест открывается после события ended и POST /api/modules/video', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);
  await expect(page.locator('.mod-card')).toHaveCount(4, { timeout: 10_000 });

  const [videoReq] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/api/modules/video') && r.method() === 'POST'),
    page.evaluate(() => document.getElementById('video-market')?.dispatchEvent(new Event('ended'))),
  ]);

  const body = JSON.parse(videoReq.postData() || '{}');
  expect(body.module).toBe('market');

  await expect(page.locator('#wait-market')).toBeHidden({ timeout: 5_000 });
  await expect(page.locator('#test-market')).not.toHaveClass(/hidden/);
});

// ── 5. Правильные ответы → «сдан», бейдж обновлён ───────────────────────────
test('правильные ответы → тест сдан, бейдж «Пройдено»', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);
  await expect(page.locator('.mod-card')).toHaveCount(4, { timeout: 10_000 });

  await page.evaluate(() => document.getElementById('video-market')?.dispatchEvent(new Event('ended')));
  await expect(page.locator('#test-market')).not.toHaveClass(/hidden/, { timeout: 5_000 });

  // Правильные ответы: q1→'a', q2→['a','b','c']
  await page.locator('#test-market input[data-qid="q1"][value="a"]').check();
  await page.locator('#test-market input[data-qid="q2"][value="a"]').check();
  await page.locator('#test-market input[data-qid="q2"][value="b"]').check();
  await page.locator('#test-market input[data-qid="q2"][value="c"]').check();

  const [testResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/modules/test')),
    page.locator('#test-market .test-submit-btn').click(),
  ]);

  const respBody = await testResp.json();
  expect(respBody.ok).toBe(true);
  expect(respBody.passed).toBe(true);
  expect(respBody.score).toBe(2);

  await expect(page.locator('#test-market .test-result.passed')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#test-market .test-result')).toContainText('сдан');
  await expect(page.locator('#badge-market')).toHaveClass(/done/);
  await expect(page.locator('#badge-market')).toContainText('Пройдено');
  await expect(page.locator('#test-market .test-retry-btn')).toBeVisible();
  await expect(page.locator('#test-market .test-submit-btn')).toBeHidden();
});

// ── 6. Неправильные ответы → «не сдан» ───────────────────────────────────────
test('неправильные ответы → тест не сдан, бейдж pending', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);
  await expect(page.locator('.mod-card')).toHaveCount(4, { timeout: 10_000 });

  await page.evaluate(() => document.getElementById('video-market')?.dispatchEvent(new Event('ended')));
  await expect(page.locator('#test-market')).not.toHaveClass(/hidden/, { timeout: 5_000 });

  await page.locator('#test-market input[data-qid="q1"][value="b"]').check();

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/modules/test')),
    page.locator('#test-market .test-submit-btn').click(),
  ]);

  await expect(page.locator('#test-market .test-result.failed')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#test-market .test-result')).toContainText('не сдан');
  await expect(page.locator('#badge-market')).toHaveClass(/pending/);
});

// ── 7. «Пройти заново» сбрасывает форму ─────────────────────────────────────
test('«пройти заново» сбрасывает форму и убирает пометки', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);
  await expect(page.locator('.mod-card')).toHaveCount(4, { timeout: 10_000 });

  await page.evaluate(() => document.getElementById('video-market')?.dispatchEvent(new Event('ended')));
  await expect(page.locator('#test-market')).not.toHaveClass(/hidden/, { timeout: 5_000 });

  await page.locator('#test-market input[data-qid="q1"][value="a"]').check();
  await page.locator('#test-market input[data-qid="q2"][value="a"]').check();

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/modules/test')),
    page.locator('#test-market .test-submit-btn').click(),
  ]);

  await expect(page.locator('#test-market .test-retry-btn')).toBeVisible({ timeout: 5_000 });
  await page.locator('#test-market .test-retry-btn').click();

  await expect(page.locator('#test-market .test-submit-btn')).toBeVisible();
  await expect(page.locator('#test-market .test-result-area')).toBeEmpty();

  const opts = page.locator('#test-market label.q-opt');
  for (let i = 0; i < await opts.count(); i++) {
    await expect(opts.nth(i)).not.toHaveClass(/correct/);
    await expect(opts.nth(i)).not.toHaveClass(/wrong/);
  }
});

// ── 8. /api/modules не содержит правильных ответов ───────────────────────────
test('/api/modules не раскрывает правильные ответы', async ({ page }) => {
  await openCabinet(page);
  await page.evaluate(() => window.goPage('materials'));

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/modules')
      && !r.url().includes('/video') && !r.url().includes('/test')),
    page.click('button.mat-filters:has-text("Полезное от Сколково")'),
  ]);

  const body = await resp.json();
  expect(body.ok).toBe(true);
  body.modules?.forEach(m => {
    m.questions?.forEach(q => {
      expect(Object.keys(q)).not.toContain('correct');
      expect(Object.keys(q)).not.toContain('answer');
    });
  });
});

// ── 9. Переключение обратно ──────────────────────────────────────────────────
test('фильтр «Все» скрывает курс и возвращает сетку', async ({ page }) => {
  await openCabinet(page);
  await openCourse(page);
  await expect(page.locator('.sko-intro')).toBeVisible({ timeout: 10_000 });

  await page.click('button.mat-filters:has-text("Все")');

  await expect(page.locator('#skolkovo-course')).toBeHidden();
  await expect(page.locator('#materials-grid-wrap')).toBeVisible();
});
