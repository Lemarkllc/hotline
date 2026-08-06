# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.4.0](///compare/v0.3.0...v0.4.0) (2026-08-06)


### Новые возможности

* add bot-customer to the production Docker build bb9c076
* **api:** Фаза 7.1 — backend for CUSTOMER channel (SALES role, ExternalContact flow) 99bbbf1
* **bot-employee:** удалять уволенного из чатов; бот только для личных сообщений 983bc2e
* **web:** dynamic channel switching for SALES role (Фаза 7.3) 07600c9
* **web:** live badge for pending registration requests in the sidebar 7974b84
* **web:** native-feeling mobile PWA layout for the staff panel b335adf
* **web:** pull-to-refresh + native launch sequence for mobile PWA d47e828
* **web:** PWA installability + offline app-shell cache (Фаза 7.4) 0bb6f97, closes #2
* **web:** replace PWA placeholder icons with real brand assets 17bc374
* временный пароль — письмом от сервера; фикс поллинга почты (пропуск бэклога) 50a29ec
* заявление на увольнение как тип обращения (bot-employee + web) 583c228
* миниатюры вложений, вложения из писем в «Заявках», дело + файлы в Bitrix24 d358ffe
* раздел «Заявки» — email-лиды с sales@ через robot@, стоп-лист, Bitrix24 d7cf1e2
* Фаза 7.2 — apps/bot-customer 6f9b3a7


### Исправления

* **api:** корректный DEADLINE для дела-звонка в Bitrix24 03e305e
* **api:** регэксп телефона в письме не ловил номера без 8/+7 и с типографским тире b49b80e
* **appeals:** show real author/staff names, wire up client correspondence for CUSTOMER channel 089fe7b
* **bot-employee:** drop hardcoded "HRD" from reply confirmation text 6ed689a
* **leads:** z.coerce.boolean() трактовал query-строку "false" как true cfe799f
* **leads:** не обрабатывать одно письмо параллельно/повторно cf640b3
* **notifications:** stop bot-employee/bot-customer from stealing each other's TELEGRAM notifications a089f09
* **web:** add back navigation on mobile screens that had none d9a64cb
* **web:** default appeals filter to "active" instead of "all statuses" 9281e0a
* **web:** re-fetch /auth/me on every fresh login, not just once per 15s 3481369
* **web:** shorten default appeals filter label to "Активные" 71b8eea
* **web:** stop iOS Safari auto-zoom on every mobile text input 1ba800d
* **web:** не разлогинивать на бизнес-401 (неверный текущий пароль и т.п.) 90d1f14
* **web:** поле подтверждения нового пароля на экране смены пароля ecac73b
* **web:** скрыть плитки/график увольнений на канале CUSTOMER (роль SALES) 02f7883
* вложения из бота нельзя было открыть — presigned URL вёл на внутренний minio:9000 0c69cf7
* жёсткий редирект на /login при истёкшей сессии; разблокировка пользователя 4b355f9


### Документация

* record Фаза 7 decisions (SALES role, NPS rating, bot-customer flow, PWA scope) 83de18e

## [0.3.0](///compare/v0.2.0...v0.3.0) (2026-07-29)


### Новые возможности

* **api,web:** @упоминания во Внутренней работе + потабовые бейджи непрочитанного 729be20
* **api,web:** HRD gets a narrow web page for access requests db6563b


### Исправления

* **bot-employee:** re-check account status before every command, not just /start 9b1f9a5

## [0.2.0](///compare/v0.1.0...v0.2.0) (2026-07-29)


### Новые возможности

* **api,bot,web:** HRD confirms access requests from Telegram; Administrator edits users 3dcbe18
* **api,web:** Administrator becomes a second trusted role for appeal data 7860ce7
* **api:** add demo data seed script 2b46d07
* **bot-employee:** populate Telegram command menu button eb2e418
* **bot:** split "Мои обращения" into tabs, in-thread Q&A, sticky action buttons 22f7c9f
* browser web push notifications; show final answer and prompt rating on close 06d71ce
* production Docker build, Caddy TLS reverse proxy, OBT deploy to hot.lemarkllc.ru 8e716b4
* **web:** make dashboard KPI cards and charts clickable 68ce38e
* **web:** merge Kanban into Обращения as a view toggle, add backlog/low-rating quick filters 6e22925
* **web:** unread-reply badge on appeal cards in Kanban and Реестр 03a44ae


### Исправления

* **bot-employee:** fix conversation hang after second attachment, add network timeouts 8bd907f, closes conversations#32
* **bot-employee:** serialize per-chat updates, remove dead attach button, guard empty text 7254146
* **deploy:** copy apps/web/public into Docker build context 2a5db2b
* **web:** dedicated 2FA screen instead of an inline login error 4dd05c3
* **web:** poll appeals list and detail on interval 160d72c
* **web:** support relative VITE_API_BASE_URL for same-origin production proxying 3aaa909

## 0.1.0 (2026-07-17)


### Новые возможности

* backend API - auth, users, appeal lifecycle, reports, audit eeaf2c6
* scaffold monorepo, docker infra, and Prisma data model 28139b1
* Telegram bot for employees (registration, appeal creation, notifications) 917d539
* web admin panel - dashboard, registry, kanban, appeal detail, users ade3261
