// js/content.js
// Данные о пакетах и материалах.
// LIST_IDS = null → mock-данные; установи ID после создания Universal Lists в Bitrix24.
import Bitrix from './bitrix.js';

const LIST_IDS = {
  packages:  null,  // ID Universal List «Пакеты консалтинга» (напр. 47)
  materials: null   // ID Universal List «Материалы»           (напр. 49)
};

// Заполни FIELD_MAP после создания списков в Bitrix24 (Settings → Lists → свойства):
const FIELD_MAP = {
  packages: {
    number:          'PROPERTY_XXX',
    goal:            'PROPERTY_XXX',
    price:           'PROPERTY_XXX',
    priceDisplay:    'PROPERTY_XXX',
    engagement:      'PROPERTY_XXX',
    engagementLevel: 'PROPERTY_XXX',
    color:           'PROPERTY_XXX',
    result:          'PROPERTY_XXX',
    buttonType:      'PROPERTY_XXX'
  },
  materials: {
    type:        'PROPERTY_XXX',
    typeLabel:   'PROPERTY_XXX',
    pkg:         'PROPERTY_XXX',
    pkgLabel:    'PROPERTY_XXX',
    duration:    'PROPERTY_XXX',
    description: 'PROPERTY_XXX',
    fileId:      'PROPERTY_XXX'
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

  // Принудительно сбросить кэш (полезно при отладке)
  clearCache() {
    localStorage.removeItem('content_packages');
    localStorage.removeItem('content_materials');
  },

  // ── Bitrix24 Universal Lists ─────────────────────────────────────────────

  async _fetchPackages() {
    const elements = await Bitrix.getListElements(LIST_IDS.packages);
    const fm = FIELD_MAP.packages;
    return elements
      .map(el => ({
        id:              el.CODE || `pkg-${el.ID}`,
        number:          parseInt(el[fm.number]) || 0,
        name:            el.NAME,
        goal:            el[fm.goal] || '',
        price:           parseInt(el[fm.price]) || 0,
        priceDisplay:    el[fm.priceDisplay] || '',
        engagement:      el[fm.engagement] || '',
        engagementLevel: parseInt(el[fm.engagementLevel]) || 1,
        color:           el[fm.color] || 'teal',
        result:          el[fm.result] || '',
        buttonType:      el[fm.buttonType] || 'order',
        items:           []  // items из отдельного списка — добавь getPackageItems() при необходимости
      }))
      .sort((a, b) => a.number - b.number);
  },

  async _fetchMaterials() {
    const elements = await Bitrix.getListElements(LIST_IDS.materials);
    const fm = FIELD_MAP.materials;
    const mats = elements.map(el => ({
      id:          `mat-${el.ID}`,
      name:        el.NAME,
      type:        el[fm.type] || 'doc',
      typeLabel:   el[fm.typeLabel] || 'Документ',
      pkg:         el[fm.pkg] || 'all',
      pkgLabel:    el[fm.pkgLabel] || 'Все',
      duration:    el[fm.duration] || null,
      description: el[fm.description] || '',
      fileId:      el[fm.fileId] || null,
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
