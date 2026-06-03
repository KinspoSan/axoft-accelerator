// js/content.js
// Данные о пакетах и материалах.
// LIST_IDS = null → mock-данные; установи ID после создания Universal Lists в Bitrix24.
import Bitrix from './bitrix.js';

const LIST_IDS = {
  packages:  123,  // «Пакеты консалтинга — Axoft × Сколково»
  materials: 125,  // «Материалы — Axoft × Сколково»
  services:  127   // «Услуги — Axoft × Сколково»
};

const FIELD_MAP = {
  packages: {
    number:          'PROPERTY_275',
    goal:            'PROPERTY_277',
    price:           'PROPERTY_279',
    priceDisplay:    'PROPERTY_281',
    engagement:      'PROPERTY_283',
    engagementLevel: 'PROPERTY_285',
    color:           'PROPERTY_287',
    result:          'PROPERTY_289',
    buttonType:      'PROPERTY_291'
  },
  materials: {
    type:        'PROPERTY_293',
    typeLabel:   'PROPERTY_295',
    pkg:         'PROPERTY_297',
    pkgLabel:    'PROPERTY_299',
    duration:    'PROPERTY_301',
    description: 'PROPERTY_303',
    fileId:      'PROPERTY_305'
  },
  services: {
    icon:        'PROPERTY_307',
    description: 'PROPERTY_309',
    price:       'PROPERTY_311',
    priceText:   'PROPERTY_313',
    pkg:         'PROPERTY_315',
    pkgLabel:    'PROPERTY_317',
    standalone:  'PROPERTY_319'
  }
};

const CACHE_TTL = 60 * 60 * 1000; // 1 час

// ── Mock-данные (текущий контент кабинета) ───────────────────────────────────

const MOCK_PACKAGES = [
  {
    id: 'pkg-diag',
    number: 1,
    name: 'Диагностика',
    goal: 'Понять стартовую позицию и логику партнёрского канала',
    price: 0,
    priceDisplay: 'Бесплатно',
    engagement: 'минимальная (1 встреча)',
    engagementLevel: 1,
    color: 'green',
    result: 'Понимаете логику канала и видите собственные пробелы через чек-лист',
    buttonType: 'diag',
    items: [
      { icon: 'ti-video',      text: 'Видеокурс: как устроена двухуровневая дистрибуция' },
      { icon: 'ti-list-check', text: 'Чек-лист самооценки готовности продукта к каналу' },
      { icon: 'ti-user-check', text: 'Онбординг-встреча с менеджером Axoft (до 1 ч.)' },
      { icon: 'ti-book-2',     text: 'Кейсы: как вендоры переходили на дистрибуцию' }
    ]
  },
  {
    id: 'pkg-audit',
    number: 2,
    name: 'Аудит',
    goal: 'Получить экспертную оценку и дорожную карту готовности',
    price: 100000,
    priceDisplay: 'от 100 000 ₽',
    engagement: 'средняя (2-3 рабочих сессии)',
    engagementLevel: 2,
    color: 'teal',
    result: 'Знаете, что мешает войти в канал, и имеете документированный план',
    buttonType: 'order',
    items: [
      { icon: 'ti-search',         text: 'Детальный аудит продукта на готовность к дистрибуции' },
      { icon: 'ti-chart-bar',      text: 'Анализ конкурентов: кто в канале и на каких условиях' },
      { icon: 'ti-eye',            text: 'Оценка продукта глазами реселлера' },
      { icon: 'ti-alert-triangle', text: 'Выявление пробелов: продукт, упаковка, ценообразование' },
      { icon: 'ti-users',          text: '2-3 рабочих сессии с экспертами Axoft' },
      { icon: 'ti-file-text',      text: 'Итоговый отчёт: разрыв-анализ и дорожная карта' }
    ]
  },
  {
    id: 'pkg-pack',
    number: 3,
    name: 'Упаковка',
    goal: 'Подготовить всё необходимое для работы с партнёрским каналом',
    price: 300000,
    priceDisplay: 'от 300 000 ₽',
    engagement: 'высокая (5+ сессий, выделенный ресурс)',
    engagementLevel: 3,
    color: 'blue',
    result: 'Готовы к двухуровневой дистрибуции: упаковка, партнёрская программа, материалы',
    buttonType: 'order',
    items: [
      { icon: 'ti-target',       text: 'Разработка УТП для B2B и партнёрского канала' },
      { icon: 'ti-briefcase',    text: 'Позиционирование продукта в портфеле реселлера' },
      { icon: 'ti-file-invoice', text: 'One-pager для партнёра + коммерческое предложение' },
      { icon: 'ti-speakerphone', text: 'Маркетинговые материалы для реселлеров' },
      { icon: 'ti-git-branch',   text: 'Разработка партнёрской программы' },
      { icon: 'ti-school',       text: 'Обучающие материалы для реселлеров' },
      { icon: 'ti-users',        text: '5+ рабочих сессий с выделенной командой Axoft' },
      { icon: 'ti-check-all',    text: 'Финальная сессия: оценка готовности к дистрибуции' }
    ]
  }
];

const MOCK_MATERIALS = [
  {
    id: 'mat-1',
    name: 'Видеокурс: как устроена двухуровневая дистрибуция',
    type: 'video',
    typeLabel: 'Видео',
    pkg: 'diag',
    pkgLabel: 'Диагностика',
    duration: '20 мин',
    description: 'Базовый курс о модели дистрибьютор → реселлер → заказчик: экономика, роли, логика',
    fileId: null,
    fileUrl: null
  },
  {
    id: 'mat-2',
    name: 'Чек-лист самооценки готовности продукта к каналу',
    type: 'checklist',
    typeLabel: 'Чек-лист',
    pkg: 'diag',
    pkgLabel: 'Диагностика',
    duration: null,
    description: '42 критерия для самостоятельной проверки готовности продукта к работе с дистрибьютором',
    fileId: null,
    fileUrl: null
  },
  {
    id: 'mat-3',
    name: 'Кейсы: как вендоры переходили на дистрибуцию',
    type: 'case',
    typeLabel: 'Кейс',
    pkg: 'diag',
    pkgLabel: 'Диагностика',
    duration: null,
    description: 'Истории успеха 5 вендоров — от прямых продаж к партнёрскому каналу',
    fileId: null,
    fileUrl: null
  },
  {
    id: 'mat-4',
    name: 'Шаблон итогового отчёта аудита',
    type: 'doc',
    typeLabel: 'Шаблон',
    pkg: 'audit',
    pkgLabel: 'Аудит',
    duration: null,
    description: 'Структура отчёта: разрыв-анализ, ключевые пробелы, дорожная карта устранения',
    fileId: null,
    fileUrl: null
  },
  {
    id: 'mat-5',
    name: 'Шаблон one-pager для партнёра',
    type: 'doc',
    typeLabel: 'Шаблон',
    pkg: 'pack',
    pkgLabel: 'Упаковка',
    duration: null,
    description: 'Готовая структура одностраничника продукта для передачи реселлерам',
    fileId: null,
    fileUrl: null
  },
  {
    id: 'mat-6',
    name: 'Шаблон партнёрской программы',
    type: 'doc',
    typeLabel: 'Шаблон',
    pkg: 'pack',
    pkgLabel: 'Упаковка',
    duration: null,
    description: 'Условия для реселлеров: маржинальность, бонусы, требования, SLA',
    fileId: null,
    fileUrl: null
  }
];

const MOCK_SERVICES = [
  // ── Диагностика ──────────────────────────────────────────────────────────
  { id:'svc-1',  name:'Видеокурс: двухуровневая дистрибуция',
    icon:'ti-video',          pkg:'diag', pkgLabel:'Диагностика',
    price:0, priceText:'Бесплатно', standalone:true,
    description:'Структура партнёрского канала, роли и экономика дистрибуции' },
  { id:'svc-2',  name:'Чек-лист самооценки готовности',
    icon:'ti-list-check',     pkg:'diag', pkgLabel:'Диагностика',
    price:0, priceText:'Бесплатно', standalone:true,
    description:'42 критерия для самостоятельной оценки готовности продукта к каналу' },
  { id:'svc-3',  name:'Онбординг-встреча с Axoft (до 1 ч.)',
    icon:'ti-user-check',     pkg:'diag', pkgLabel:'Диагностика',
    price:0, priceText:'По запросу', standalone:true,
    description:'Персональная встреча с менеджером для обсуждения стратегии входа в канал' },
  { id:'svc-4',  name:'Кейсы вендоров: переход на дистрибуцию',
    icon:'ti-book-2',         pkg:'diag', pkgLabel:'Диагностика',
    price:0, priceText:'Бесплатно', standalone:true,
    description:'5 историй успеха вендоров, прошедших путь от прямых продаж к партнёрскому каналу' },
  // ── Аудит ────────────────────────────────────────────────────────────────
  { id:'svc-5',  name:'Детальный аудит продукта',
    icon:'ti-search',         pkg:'audit', pkgLabel:'Аудит',
    price:0, priceText:'По запросу', standalone:true,
    description:'Экспертная оценка готовности продукта к дистрибуции по 5 ключевым категориям' },
  { id:'svc-6',  name:'Анализ конкурентов в партнёрском канале',
    icon:'ti-chart-bar',      pkg:'audit', pkgLabel:'Аудит',
    price:0, priceText:'По запросу', standalone:true,
    description:'Кто уже в канале Axoft, на каких условиях, и как ваш продукт дифференцируется' },
  { id:'svc-7',  name:'Оценка продукта глазами реселлера',
    icon:'ti-eye',            pkg:'audit', pkgLabel:'Аудит',
    price:0, priceText:'По запросу', standalone:true,
    description:'Аудит с позиции партнёра: насколько просто продавать, какие вопросы возникнут' },
  { id:'svc-8',  name:'Выявление пробелов в упаковке и ценообразовании',
    icon:'ti-alert-triangle', pkg:'audit', pkgLabel:'Аудит',
    price:0, priceText:'По запросу', standalone:true,
    description:'Диагностика слабых мест: продукт, упаковка, ценообразование для канала' },
  { id:'svc-9',  name:'Рабочие сессии с экспертами Axoft (2–3)',
    icon:'ti-users',          pkg:'audit', pkgLabel:'Аудит',
    price:0, priceText:'По запросу', standalone:true,
    description:'Структурированные рабочие сессии по результатам аудита с командой Axoft' },
  { id:'svc-10', name:'Итоговый отчёт: разрыв-анализ + дорожная карта',
    icon:'ti-file-text',      pkg:'audit', pkgLabel:'Аудит',
    price:0, priceText:'По запросу', standalone:true,
    description:'Документ с результатами аудита и пошаговым планом устранения пробелов' },
  // ── Упаковка ─────────────────────────────────────────────────────────────
  { id:'svc-11', name:'Разработка УТП для B2B и партнёрского канала',
    icon:'ti-target',         pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Формулировка уникального предложения под корпоративных заказчиков и реселлеров' },
  { id:'svc-12', name:'Позиционирование в портфеле реселлера',
    icon:'ti-briefcase',      pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Как встроить продукт в корзину реселлера и продавать его в связке с другими решениями' },
  { id:'svc-13', name:'One-pager + коммерческое предложение для партнёра',
    icon:'ti-file-invoice',   pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Одностраничник продукта для партнёра и шаблон КП под корпоративные сделки' },
  { id:'svc-14', name:'Маркетинговые материалы для реселлеров',
    icon:'ti-speakerphone',   pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Презентации, pitch deck и FAQ для продажи продукта через партнёрскую сеть' },
  { id:'svc-15', name:'Разработка партнёрской программы',
    icon:'ti-git-branch',     pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Условия для реселлеров: маржа, бонусы, обязательства сторон, тиры партнёрства' },
  { id:'svc-16', name:'Обучающие материалы для реселлеров',
    icon:'ti-school',         pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Учебные материалы для онбординга партнёров без участия вендора' },
  { id:'svc-17', name:'Рабочие сессии с командой Axoft (5+)',
    icon:'ti-users',          pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Интенсивная работа с выделенной командой экспертов — от стратегии до запуска' },
  { id:'svc-18', name:'Финальная оценка готовности к дистрибуции',
    icon:'ti-check-all',      pkg:'pack', pkgLabel:'Упаковка',
    price:0, priceText:'По запросу', standalone:true,
    description:'Итоговая верификация всей подготовительной работы и допуск к запуску канала' },
];

// ── Основной модуль ──────────────────────────────────────────────────────────

const Content = {
  async getPackages() {
    return this._withCache('content_packages', () =>
      LIST_IDS.packages
        ? this._fetchPackages()
        : Promise.resolve(MOCK_PACKAGES)
    );
  },

  async getMaterials() {
    return this._withCache('content_materials', () =>
      LIST_IDS.materials
        ? this._fetchMaterials()
        : Promise.resolve(MOCK_MATERIALS)
    );
  },

  async getServices() {
    return this._withCache('content_services', () =>
      LIST_IDS.services
        ? this._fetchServices()
        : Promise.resolve(MOCK_SERVICES)
    );
  },

  // Принудительно сбросить кэш (полезно при отладке)
  clearCache() {
    localStorage.removeItem('content_packages');
    localStorage.removeItem('content_materials');
    localStorage.removeItem('content_services');
  },

  // ── Bitrix24 Universal Lists ─────────────────────────────────────────────

  // Значения свойств в Bitrix приходят как {"<internal_id>": "<value>"} — берём первое значение
  _pv(el, fieldId) {
    const v = el[fieldId];
    if (!v || typeof v !== 'object') return v || '';
    const vals = Object.values(v);
    return vals.length ? String(vals[0]) : '';
  },

  async _fetchPackages() {
    const elements = await Bitrix.getListElements(LIST_IDS.packages);
    const fm = FIELD_MAP.packages;
    return elements
      .map(el => ({
        id:              el.CODE || `pkg-${el.ID}`,
        number:          parseInt(this._pv(el, fm.number)) || 0,
        name:            el.NAME,
        goal:            this._pv(el, fm.goal) || '',
        price:           parseInt(this._pv(el, fm.price)) || 0,
        priceDisplay:    this._pv(el, fm.priceDisplay) || '',
        engagement:      this._pv(el, fm.engagement) || '',
        engagementLevel: parseInt(this._pv(el, fm.engagementLevel)) || 1,
        color:           this._pv(el, fm.color) || 'teal',
        result:          this._pv(el, fm.result) || '',
        buttonType:      this._pv(el, fm.buttonType) || 'order',
        items:           MOCK_PACKAGES.find(p => p.id === el.CODE)?.items || []
      }))
      .sort((a, b) => a.number - b.number);
  },

  async _fetchMaterials() {
    const elements = await Bitrix.getListElements(LIST_IDS.materials);
    const fm = FIELD_MAP.materials;
    const mats = elements.map(el => ({
      id:          el.CODE || `mat-${el.ID}`,
      name:        el.NAME,
      type:        this._pv(el, fm.type) || 'doc',
      typeLabel:   this._pv(el, fm.typeLabel) || 'Документ',
      pkg:         this._pv(el, fm.pkg) || 'all',
      pkgLabel:    this._pv(el, fm.pkgLabel) || 'Все',
      duration:    this._pv(el, fm.duration) || null,
      description: this._pv(el, fm.description) || '',
      fileId:      this._pv(el, fm.fileId) || null,
      fileUrl:     null
    }));

    // Получаем ссылки для файлов, у которых есть fileId
    await Promise.all(
      mats
        .filter(m => m.fileId)
        .map(async m => {
          try { m.fileUrl = await Bitrix.getDiskFileLink(m.fileId); }
          catch (_) {}
        })
    );

    return mats;
  },

  async _fetchServices() {
    const elements = await Bitrix.getListElements(LIST_IDS.services);
    const fm = FIELD_MAP.services;
    return elements.map(el => ({
      id:          el.CODE || `svc-${el.ID}`,
      name:        el.NAME,
      icon:        this._pv(el, fm.icon) || 'ti-tool',
      description: this._pv(el, fm.description) || '',
      price:       parseInt(this._pv(el, fm.price)) || 0,
      priceText:   this._pv(el, fm.priceText) || 'По запросу',
      pkg:         this._pv(el, fm.pkg) || 'all',
      pkgLabel:    this._pv(el, fm.pkgLabel) || '',
      standalone:  this._pv(el, fm.standalone) === 'Y'
    }));
  },

  // ── Cache ────────────────────────────────────────────────────────────────

  async _withCache(key, fetcher) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch (_) {}

    const data = await fetcher();
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (_) {}
    return data;
  }
};

export default Content;
