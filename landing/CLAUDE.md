# [Project Name] — Конституция проекта

## Что это за проект
<!-- Опиши проект в 2–4 строках: что делает, для кого, какую задачу решает -->

## Технологический стек

### Frontend
- Framework: React 19 / Next.js 15 (App Router) или Vite + React
- Язык: TypeScript (strict mode)
- Стили: Tailwind CSS 4 + CSS Modules для изолированных компонентов
- Состояние: Zustand / React Query (TanStack Query v5)
- Тесты: Vitest + React Testing Library + Playwright (e2e)

### Backend / API
- Runtime: Node.js 22 + TypeScript
- Framework: Fastify 5 / Hono (для edge) / Express (если legacy)
- База данных: PostgreSQL 15 + Drizzle ORM / Prisma
- Кэш: Redis 7
- Auth: NextAuth.js / Lucia / собственный JWT

### Инфраструктура
- Хостинг: Vercel / Yandex Cloud / VPS
- CDN: Cloudflare
- Мониторинг: Sentry + Grafana
- CI/CD: GitHub Actions

## Структура репозитория
```
src/
  app/          — страницы и роутинг (Next.js App Router)
  components/   — UI-компоненты (атомарные и составные)
  features/     — фичи (модули по доменам)
  lib/          — утилиты, хелперы, конфиги
  server/       — серверный код (actions, API routes)
    controllers/
    services/
    repositories/
  types/        — глобальные TypeScript-типы
public/         — статика
docs/           — документация
plans/          — планы от planner-агента (не коммитить)
```

## Ключевые команды
- `pnpm dev` — локальный сервер (порт 3000)
- `pnpm build` — production сборка
- `pnpm test` — все тесты (unit + integration)
- `pnpm test:e2e` — Playwright e2e тесты
- `pnpm lint` — ESLint + Prettier проверка
- `pnpm typecheck` — TypeScript проверка без сборки
- `pnpm db:migrate` — применить миграции
- `pnpm db:studio` — Drizzle/Prisma Studio

## CRITICAL RULES — НАРУШАТЬ НЕЛЬЗЯ
1. NEVER удалять или переписывать рабочие тесты без явного запроса
2. NEVER менять схему БД без создания файла миграции
3. NEVER хардкодить секреты — только через `.env` / `.env.local`
4. NEVER удалять файлы без подтверждения
5. NEVER вносить изменения в несколько несвязанных модулей одновременно
6. ALWAYS запускать `pnpm typecheck && pnpm test` после изменений в коде
7. ALWAYS делать git checkpoint перед крупными изменениями
8. ALWAYS если задача сложная — сначала используй planner агента
9. Одна задача за раз — не трогай несвязанный код
10. Если непонятно — СПРОСИ, не угадывай

## Архитектурные принципы

### Frontend
- Компоненты: атомарные, без бизнес-логики
- Бизнес-логика — в хуках (`use*.ts`) или в слое `features/`
- Нет `any` без крайней необходимости
- Server Components по умолчанию, `"use client"` — только по необходимости
- Все строки для i18n — через `next-intl` / `react-i18next`
- Доступность (a11y): семантический HTML, ARIA только при необходимости

### Backend / API
- Чистая архитектура: Controller → Service → Repository
- Каждый модуль: `controller.ts`, `service.ts`, `repository.ts`, `types.ts`
- Ошибки через кастомные классы, не строки
- Логирование через `pino`
- Валидация входящих данных: Zod на всех API-эндпоинтах

### Database
- Каждое изменение схемы = новый файл миграции в `migrations/`
- UUID для всех первичных ключей
- Имена таблиц и колонок в `snake_case`
- Индексы — явно, не полагаться на ORM-дефолты

## Безопасность
- HTTPS везде, HSTS заголовки
- CSP (Content Security Policy) настроен
- Rate limiting на все публичные эндпоинты
- Все пользовательские данные — валидация на сервере (Zod)
- XSS: не использовать `dangerouslySetInnerHTML` без санитизации
- CSRF: токены на всех мутирующих запросах
- Зависимости: регулярный `pnpm audit`
- Переменные среды: никогда не в git, `.env.example` — в репозитории

## Производительность
- Core Web Vitals как KPI: LCP < 2.5s, CLS < 0.1, INP < 200ms
- Изображения через `next/image` или аналог с lazy loading
- Шрифты — `font-display: swap`, preload критичных
- Bundle analysis при каждом крупном релизе (`pnpm build --analyze`)
- Динамические импорты для тяжёлых компонентов

## Агенты
- **planner** — для любой задачи сложнее простой правки: составляет план, разбивает на шаги
- **tester** — запускается после КАЖДОГО изменения кода
- **code-reviewer** — перед КАЖДЫМ коммитом в main/master
