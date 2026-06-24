// js/skolkovo.js — обучающий блок «Полезное от Сколково»

const INTRO = [
  'Мы подготовили видеолекции по ключевым темам, необходимым любому стартапу: Рынок и профиль клиента, ' +
  'Ценностное предложение, Бизнес-модель, Дорожная карта и масштабирование. Эти материалы помогут ' +
  'структурировать идею, проверить гипотезы и увидеть стратегию целиком. По итогам каждого модуля ' +
  'необходимо пройти небольшое тестирование.',
  'Если вы станете участником проекта Сколково, ваша экосистема возможностей расширится: станут доступны ' +
  'бесплатные онлайн-курсы с шаблонами и готовыми материалами по развитию технологий, выходу на ' +
  'международные рынки, организации продаж и привлечению инвестиций.'
];

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  return data;
}

async function getModules() {
  const res = await fetch('/api/modules', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  return data.modules;
}

// Собрать ответы из формы по массиву вопросов
function collectAnswers(formEl, questions) {
  const answers = {};
  questions.forEach(q => {
    if (q.multiple) {
      answers[q.id] = [...formEl.querySelectorAll(`input[data-qid="${q.id}"]:checked`)]
        .map(el => el.value);
    } else {
      const sel = formEl.querySelector(`input[data-qid="${q.id}"]:checked`);
      answers[q.id] = sel ? sel.value : '';
    }
  });
  return answers;
}

// Разметка одного вопроса
function buildQuestion(key, q) {
  const inputType = q.multiple ? 'checkbox' : 'radio';
  const inputName = q.multiple ? undefined : `q_${key}_${q.id}`;
  const opts = Object.entries(q.options).map(([optKey, optText]) => `
    <label class="q-opt" data-qid="${q.id}" data-opt="${optKey}">
      <input type="${inputType}" ${inputName ? `name="${inputName}"` : ''} value="${optKey}"
        data-qid="${q.id}">
      <span>${optText}</span>
    </label>`).join('');
  return `<div class="q-block" data-qid="${q.id}">
    <div class="q-text">${q.text}</div>
    ${opts}
  </div>`;
}

// Пометить варианты ответа по results {qid: true/false}
function markResults(formEl, results) {
  Object.entries(results).forEach(([qid, correct]) => {
    formEl.querySelectorAll(`label.q-opt[data-qid="${qid}"]`).forEach(label => {
      label.classList.remove('correct', 'wrong');
      label.classList.add(correct ? 'correct' : 'wrong');
    });
    // Заблокировать ввод после проверки
    formEl.querySelectorAll(`input[data-qid="${qid}"]`).forEach(inp => inp.disabled = true);
  });
}

// Показать результат и кнопку «Пройти заново»
function showResult(formEl, key, score, total, passed, results, questions) {
  markResults(formEl, results);

  const resultEl = formEl.querySelector('.test-result-area');
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="test-result ${passed ? 'passed' : 'failed'}">
        ${score} из ${total} — тест ${passed ? 'сдан ✓' : 'не сдан'}
      </div>`;
  }

  if (passed) {
    const badge = document.getElementById(`badge-${key}`);
    if (badge) {
      badge.className = 'mod-badge done';
      badge.textContent = `Пройдено ✓ (${score}/${total})`;
    }
  }

  const submitBtn = formEl.querySelector('.test-submit-btn');
  if (submitBtn) {
    submitBtn.style.display = 'none';
    const retry = formEl.querySelector('.test-retry-btn');
    if (retry) retry.style.display = '';
  }
}

// Привязать обработчики кнопок формы
function bindTestForm(formEl, key, questions) {
  const submitBtn = formEl.querySelector('.test-submit-btn');
  const retryBtn  = formEl.querySelector('.test-retry-btn');

  async function doSubmit() {
    const answers = collectAnswers(formEl, questions);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Проверяем...';
    try {
      const data = await post('/api/modules/test', { module: key, answers });
      showResult(formEl, key, data.score, data.total, data.passed, data.results, questions);
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Проверить';
      const ra = formEl.querySelector('.test-result-area');
      if (ra) ra.innerHTML = `<div class="test-result failed">Ошибка: ${e.message}</div>`;
    }
  }

  function doReset() {
    // Снять все отметки и пометки
    formEl.querySelectorAll('input[data-qid]').forEach(i => { i.checked = false; i.disabled = false; });
    formEl.querySelectorAll('label.q-opt').forEach(l => l.classList.remove('correct', 'wrong'));
    const ra = formEl.querySelector('.test-result-area');
    if (ra) ra.innerHTML = '';
    submitBtn.style.display = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Проверить';
    retryBtn.style.display = 'none';
  }

  submitBtn.addEventListener('click', doSubmit);
  retryBtn.addEventListener('click', doReset);
}

// Построить полный блок теста
function buildTestBlock(key, questions, progress) {
  const block = document.createElement('div');
  block.className = 'test-block';
  block.id = `test-${key}`;

  const alreadyWatched = progress && progress.video_watched;

  block.innerHTML = `
    <div class="q-form" id="qform-${key}">
      ${questions.map(q => buildQuestion(key, q)).join('')}
      <div class="test-result-area"></div>
      <div style="margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="sko-btn sko-btn-p test-submit-btn">Проверить</button>
        <button class="sko-btn sko-btn-r test-retry-btn" style="display:none">Пройти заново</button>
      </div>
    </div>`;

  if (!alreadyWatched) {
    block.classList.add('hidden');
  }

  // Если уже есть пройденный результат — показать сразу
  if (progress && progress.test_passed) {
    requestAnimationFrame(() => {
      const formEl = block.querySelector('.q-form');
      if (formEl) showResult(formEl, key, progress.score, progress.total, true,
        Object.fromEntries(questions.map(q => [q.id, true])), questions);
    });
  }

  requestAnimationFrame(() => {
    const formEl = block.querySelector('.q-form');
    if (formEl) bindTestForm(formEl, key, questions);
  });

  return block;
}

// Построить карточку одного модуля
function buildModuleCard(mod) {
  const { key, title, video, questions, progress } = mod;
  const passed  = progress && progress.test_passed;
  const watched = progress && progress.video_watched;
  const score   = (progress && progress.score) || 0;
  const total   = (progress && progress.total)  || questions.length;

  const card = document.createElement('div');
  card.className = 'mod-card';
  card.id = `mod-${key}`;

  // Шапка
  const hd = document.createElement('div');
  hd.className = 'mod-hd';
  hd.innerHTML = `
    <div class="mod-title">${title}</div>
    <span class="mod-badge ${passed ? 'done' : 'pending'}" id="badge-${key}">
      ${passed ? `Пройдено ✓ (${score}/${total})` : 'Не пройдено'}
    </span>`;
  card.appendChild(hd);

  // Видео
  const videoWrap = document.createElement('div');
  videoWrap.className = 'video-embed';
  videoWrap.innerHTML = `<video id="video-${key}" controls preload="metadata" src="${video}">
    Ваш браузер не поддерживает видео.
  </video>`;
  card.appendChild(videoWrap);

  // Подсказка «досмотрите видео»
  if (!watched) {
    const wait = document.createElement('div');
    wait.className = 'test-wait';
    wait.id = `wait-${key}`;
    wait.innerHTML = `<i class="ti ti-player-play" style="color:var(--teal);font-size:15px"></i>
      Досмотрите видео до конца, чтобы открыть тест`;
    card.appendChild(wait);
  }

  // Блок теста
  const testBlock = buildTestBlock(key, questions, progress);
  card.appendChild(testBlock);

  // Обработчик события «видео просмотрено»
  if (!watched) {
    requestAnimationFrame(() => {
      const videoEl = document.getElementById(`video-${key}`);
      if (!videoEl) return;
      videoEl.addEventListener('ended', async () => {
        try { await post('/api/modules/video', { module: key }); } catch (_) { /* не критично */ }
        document.getElementById(`wait-${key}`)?.remove();
        document.getElementById(`test-${key}`)?.classList.remove('hidden');
      }, { once: true });
    });
  }

  return card;
}

const Skolkovo = {
  async render(container) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--txt2)">Загрузка курса...</div>`;

    let modules;
    try {
      modules = await getModules();
    } catch (e) {
      container.innerHTML = `<div style="padding:20px;color:#c00">Не удалось загрузить курс: ${e.message}</div>`;
      return;
    }

    container.innerHTML = '';

    // Интро
    const intro = document.createElement('div');
    intro.className = 'sko-intro';
    intro.innerHTML = INTRO.map(p => `<p style="margin-bottom:10px">${p}</p>`).join('');
    container.appendChild(intro);

    // Модули
    modules.forEach(mod => container.appendChild(buildModuleCard(mod)));
  }
};

export default Skolkovo;
