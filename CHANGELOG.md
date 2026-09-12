# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [2.2.0](https://lemarkllc///compare/v2.1.0...v2.2.0) (2026-09-12)


### Новые возможности

* **api,web:** «SLA Лиды» — мониторинг зависших лидов Bitrix24 ([80d8cac](https://lemarkllc///commit/80d8cacd255c37ab9ee1332c7de0acbd4f8e3618))
* **api,web:** «Рейтинг менеджеров» по лидам Bitrix24 (lead-часть будущей аналитики) ([d555176](https://lemarkllc///commit/d5551765184b4700c9d44c700675f99ae14fbfc2))
* **api,web:** SLA-эскалация просроченных «Заявок» уведомлениями ([234164d](https://lemarkllc///commit/234164da79dcc435c481d7068880d2179b266db4))
* **api,web:** асимметричный авто-стоплист нерелевантных лидов от ИИ ([ff03f5a](https://lemarkllc///commit/ff03f5ab0cae117f86a5a6ef4637e32d99cf098e))
* **api,web:** причина авто-назначения лида видна на карточке ([e476e9e](https://lemarkllc///commit/e476e9e92eb39f23bb2ccceecbeddf56a128077a))
* **api,web:** честная воронка вместо тавтологичной "конверсии" + распределение по менеджерам ([d66e5dc](https://lemarkllc///commit/d66e5dcd5180e8d2774033fe4ed3754bbf99b046))
* **api:** еженедельная email-сводка «Рейтинг менеджеров» на почту руководства ([6641de2](https://lemarkllc///commit/6641de21478ea500bff19c8a58c3f2b163e37100))


### Исправления

* **api,web:** пагинация listAllLeads молча резала выгрузку + нечитаемые графики ([e22ffd5](https://lemarkllc///commit/e22ffd587f30d29459422084bbd5268d49e8b669))
* **api:** "Lemark HotLine" -> "Lemark One" в футере письма-сводки ([8928776](https://lemarkllc///commit/8928776d287f7b5c5d8fc8b677fd9dc64b0fc163))
* **api:** убрать маркетинговый хидер/футер из письма-сводки менеджеров ([25e7388](https://lemarkllc///commit/25e7388e55dc7f42c91bbdc20be6b73a33355227))
* **web:** «SLA Лиды» недостижима с телефона — добавить в мобильный таб-бар ([3f1309e](https://lemarkllc///commit/3f1309e120373ac104ed5bacda8358f94e458feb))
* **web:** пояснения к столбцам «Рейтинга менеджеров» вместо перестройки таблицы ([81e8e3d](https://lemarkllc///commit/81e8e3da3e6a9623e0cbeb1dce194dea1eee8362))

## [2.1.0](https://lemarkllc///compare/v0.4.0...v2.1.0) (2026-09-12)


### Новые возможности

* **api,bot-employee,web:** раздел «Отпуска» — Отпуск/Отсутствие/Командировка (PLAN.md §10) ([1bad368](https://lemarkllc///commit/1bad3681cf7398833250da989c4ba600292e3d00))
* **api,bot-employee,web:** роль HR и стадия «Оформление» для отпуска и увольнения ([4a020eb](https://lemarkllc///commit/4a020eb6b46ee56ce56527b4f52366421e201474))
* **api,web:** HRD-доступ к остаткам отпуска сотрудников + кастомный дата-пикер ([546392f](https://lemarkllc///commit/546392fa31c0f0f0c2f1c753e3b02fa3856e4f3a))
* **api,web:** авто-передача релевантных лидов в CRM с алгоритмическим назначением менеджера ([212b500](https://lemarkllc///commit/212b50004687407e680fe6c6da290b3e3d7e368a))
* **api,web:** ответственный по заявке — снимок Bitrix24-пользователя вместо внутреннего назначения ([f7dd201](https://lemarkllc///commit/f7dd201b56aa36069470532a08c803dd60307107))
* **api:** HTML-шаблон письма-ответа клиенту по заявке ([f4dcb0c](https://lemarkllc///commit/f4dcb0ce532becdf72b8accaae7e82da70e030c1))
* **api:** назначение ответственного, SLA и ответ клиенту по «Заявкам» ([53a1657](https://lemarkllc///commit/53a16574dc9080a98444fb2c26638a88de776d76))
* **leads:** вернуть заявку из стоп-листа в работу ([02f14a3](https://lemarkllc///commit/02f14a3e3e6d7762cf719584a5fec5f7c61fb4ce))
* **leads:** ИИ-классификация «Заявок» — режим наблюдения (Yandex AI Studio) ([3c27970](https://lemarkllc///commit/3c2797016f3a7544990ea517986015523e957286))
* push-уведомление и live-обновление для новых «Заявок» у SALES ([a906d64](https://lemarkllc///commit/a906d64fb8bf08a5a8a9269565993cb549653f30))
* **web,api:** дата-фильтр и метрика "качественных" лидов на странице Заявки ([fad6729](https://lemarkllc///commit/fad6729a2b11f50d8822a67d3a838d96930a68ea))
* **web:** дашборд «Обзор» под Lemark One ([543b6ba](https://lemarkllc///commit/543b6ba9c5206fd0054c1e388e4dad0b7920f1d3))
* **web:** дизайн-система Lemark One — токены, шрифты, примитивы UI ([04d79a3](https://lemarkllc///commit/04d79a352899e0904b679ca59f36a6e7e0be0520))
* **web:** единый тоггл темы в Topbar и профиле PWA ([59917e7](https://lemarkllc///commit/59917e7c54ac40b49f204132db6fa9ac73b4583c))
* **web:** единый тред обращения вместо шести вкладок ([0634c06](https://lemarkllc///commit/0634c060ef8ff63e7afac4b8e5dce917db7b3866))
* **web:** каркас Sidebar/Topbar под Lemark One ([ffbf771](https://lemarkllc///commit/ffbf771e25154a79a59b2a258d68c8e928064401))
* **web:** мобильные/PWA экраны под Lemark One ([f984e7e](https://lemarkllc///commit/f984e7e94c65fb8ae875fb9280cb3f43f410ac7d)), closes [#2563](https://lemarkllc///issues/2563) [#EFF6](https://lemarkllc///issues/EFF6) [#F1F5F9](https://lemarkllc///issues/F1F5F9)
* **web:** реестр и карточка «Заявок» под Lemark One ([b955044](https://lemarkllc///commit/b955044a8e81f7759c2ebf87af5947578de6870a))
* **web:** реестр обращений, Kanban, экран «нет прав», лист компонентов ([c00ba58](https://lemarkllc///commit/c00ba58350f6032b069d8cf9814bb127b9c6c622))
* **web:** экраны входа и 2FA под Lemark One ([7ae749d](https://lemarkllc///commit/7ae749d2a08d2579802aeb2749f312b4f0d046a4))


### Исправления

* **api,web:** PLAIN_PERMISSIONS, защита от пустых каналов, блокировка=увольнение, бейджи PENDING, фильтр статуса ([b97967d](https://lemarkllc///commit/b97967d7ffb75d2008feb2d0e131f774c4a4ba9c))
* **api,web:** письмо о доступе к панели — битая картинка логотипа и название бота вместо панели ([ecf6107](https://lemarkllc///commit/ecf61072475853ec42f763223b756e4dc5516521))
* **api:** "to" в фильтрах Заявок отсекал текущий день ([e4dd8cd](https://lemarkllc///commit/e4dd8cdc6a6e59606eb7700bcdcd6251bdb1b289))
* **api:** createWebAccount жёстко выдавал канал EMPLOYEE любой роли, включая SALES ([69ee2b9](https://lemarkllc///commit/69ee2b9ef74eb11af8dfbf74c32c80126e360014))
* **api:** SMTP-транспорт без таймаутов вешал отправку писем навечно ([a042229](https://lemarkllc///commit/a04222960855d96757727a453d103ec2652a6b8e))
* **api:** дело в Bitrix24 не заводилось при конвертации лида без телефона ([214d873](https://lemarkllc///commit/214d873deb91c5fcedf88e91470a884ba404da68))
* **api:** критический баг — Telegram-уведомления сотрудникам не доходили месяц ([69e00d7](https://lemarkllc///commit/69e00d70bf429439246150d4c6f0916238d61fea))
* **api:** очередь «Оформление» увольнений не фильтровала deletedAt ([b970a79](https://lemarkllc///commit/b970a79a2fde0e4aba665716ed19bcb695382d60))
* **api:** ссылка "Контакты" в шапке письма — /contacts/ вместо /kontakty/ ([931db59](https://lemarkllc///commit/931db596381c88029ed5c32d1276d794411ba502))
* **api:** текст HTML-only писем без text/plain части не сохранялся в Lead ([363b450](https://lemarkllc///commit/363b450fab73cf23166d6943961b8bdc2b78522e))
* **bot-employee:** раздел «Отпуска» недоступен из ☰-меню бота ([09af400](https://lemarkllc///commit/09af4007c2015afb9d570195a77dd3575c80cbb9))
* **leads:** защита классификатора от prompt injection в теле письма ([14356e3](https://lemarkllc///commit/14356e3705569fb2298adfd4e7aa644762dbead2))
* **leads:** заявка с формы сайта регистрировалась как "sales@ пишет сам себе" ([e1ae089](https://lemarkllc///commit/e1ae089a3edce53d798837853839916353dc41c6))
* **web,api:** исправления по живой критике impeccable на странице Заявки ([e0f9ed0](https://lemarkllc///commit/e0f9ed0b52a26be48c5c851d69a77bc9203fa765))
* **web:** «Активные» заявки не должны включать переданные в CRM ([a73fd95](https://lemarkllc///commit/a73fd9529e6bcbcba8f1d5c1a0e5ab1dfd07679d))
* **web:** «Реестр» в мобильной навигации для «Продаж» вёл на чужие обращения HRD ([70ff38d](https://lemarkllc///commit/70ff38db625c0fe02dc154cec6a94bce1ae19c9c))
* **web:** line-clamp вообще не работал — конфликт с классом block на том же элементе ([aae5c58](https://lemarkllc///commit/aae5c58e63765988a52cfbd79fa6dcc30b1c2834))
* **web:** PWA не подхватывала новую версию после деплоя даже после закрытия ([2d0b687](https://lemarkllc///commit/2d0b687ef0db49b1486f0b11b1d8c3dfb2d37387))
* **web:** безопасный дефолт роли EMPLOYEE вместо MANAGER при создании/правке пользователя ([2cb1508](https://lemarkllc///commit/2cb1508aace64d5778e49a2b2b0d248b142f398b))
* **web:** вернуть просмотр вложений — прошлый фикс навигации сломал его ([a4ca5d1](https://lemarkllc///commit/a4ca5d17266218ad2710bca539ae27728e173992))
* **web:** длинные статус-бейджи переносились на 2 строки и наезжали на соседние колонки ([663a906](https://lemarkllc///commit/663a9063d3830278fd593fda77870b2f69523cd9))
* **web:** длинный неразрывный текст мог переполнять карточку в мобильном реестре ([1b3fbda](https://lemarkllc///commit/1b3fbda5b6c27a4784cd9a4c65405eafab374a97))
* **web:** карточки мобильного реестра разной высоты из-за длины текста ([561fdb1](https://lemarkllc///commit/561fdb19e7648891a57d04189e7823632beecb73))
* **web:** миграция админ-контура на Lemark One + устранены native-диалоги в UsersPage ([44d89c1](https://lemarkllc///commit/44d89c1836fc773d0fff1d9a7ecdbeb751e5718f))
* **web:** мобильный таб-бар по правам вместо жёсткого выбора + карточки «Отпусков» ([7b44bc4](https://lemarkllc///commit/7b44bc474273474d2383d3538f2faecbef14fb52))
* **web:** нет пути назад после открытия вложения (особенно в PWA) ([c875484](https://lemarkllc///commit/c875484db6835f628638ca6abe6a9509028908f9))
* **web:** нижний блок Sidebar — только аватар с инициалами, имя в tooltip ([3c942d4](https://lemarkllc///commit/3c942d43c1b5d5349f2285983f91fe516fa8ba92))
* **web:** Отчёты на дизайн-токенах + общий EmptyChartState + «Забыли пароль» на мобильном входе ([48a7ab1](https://lemarkllc///commit/48a7ab1ec224f69d34172d0d352d6b35a0c7c1b7))
* **web:** усилить автообновление PWA — updateViaCache:none + периодическая проверка ([3c3e65c](https://lemarkllc///commit/3c3e65c0558de60b28f7a6967c20d52e4eda209f))
* **web:** устранены находки redesign-skill аудита (стоп-лист/блокировка/переоткрытие без window.prompt) ([163e814](https://lemarkllc///commit/163e81482929b239b3b4a2448c311dc06d7a2f5b))
* **web:** устранены находки прогона impeccable по обращениям и мобильной оболочке ([2d80d7b](https://lemarkllc///commit/2d80d7b65fb5f4c84359396861e1431af19a3979))
* **web:** явная кнопка «Закрыть» в диалоге просмотра вложения ([1b66668](https://lemarkllc///commit/1b666689c21b0655985a4b11d54855be76e99507))
* убрать реальные ID Telegram-чатов из .env.example ([bd6578c](https://lemarkllc///commit/bd6578cced3f522d7d7389ce9b174c99552d9dfc))


### Документация

* аудит роль↔канал всех пользователей завершён, расхождений нет ([46ce909](https://lemarkllc///commit/46ce909c112bc874f1962b71f860974c02d11be1))

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
