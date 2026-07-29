# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
