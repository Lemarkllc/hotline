# Design

## Context

Мотивация — proposal.md; требования — `specs/admin-vpn-management`, `specs/vpn-subscription`. Решения приняты в grill-me 2026-10-07 (15 пунктов).

Что есть сейчас:
- `vpnService`: `getOrCreateProfile` (создаёт клиента панели + один вспомогательный `-AWG2`), `revokeProfile` (удаляет основного и `-AWG2`, только если subId совпадает), `listOwnDevices`/`deleteOwnDevice`, `cleanupStaleDevices`, прокси подписки со слотами (`VPN_PROFILE_HWID_LIMIT = 2` слота).
- `VpnProfile` хранит один вспомогательный клиент полями `awgAuxPanelEmail` / `awgAuxSubId`; `VpnAwgSlot` — привязки HWID→слот.
- Панель 3X-UI: `clients/list` одним запросом отдаёт всех клиентов с subId и счётчиками трафика (`up`, `down`, `lastSubFetch`); истории трафика нет. Лимит устройств меняется `clients/bulkAdjust {emails, limitHwid}` (проверено вживую на сотруднике с лимитом 5). Устройства — `POST clients/hwids/{email}`.
- Пользователи: `User.status` (PENDING/ACTIVE/REJECTED/BLOCKED/ARCHIVED), заявки `AccessRequest`, одобрение — `userService.approveAccessRequest`. Права: Администратор = `user.manage`.
- Письма: `emailSendService` + `templates/lemarkEmailShell.ts`, системный отправитель.
- Коннектор: страница `/vpn-connect?url=` в web.

## Goals / Non-Goals

**Goals:** единый раздел управления VPN для Администратора (десктоп + PWA); ключи AmneziaWG по числу устройств до 5; трафик за 30 дней без нагрузки на панель.

**Non-Goals:** клиенты панели без сотрудника в базе; сообщения в Telegram при добавлении; доступ HRD; лимит устройств больше 5; квоты трафика.

## Decisions

1. **Вспомогательные клиенты — отдельная таблица `VpnAwgAuxClient(profileId, slot 2..5, panelEmail, subId)`**, уникальность `(profileId, slot)`. Миграция переносит `awgAuxPanelEmail/awgAuxSubId` в слот 2 и удаляет старые поля. Альтернатива «колонки aux2…aux5 в VpnProfile» отвергнута: код слотов стал бы веткой на каждый номер.
2. **Лимит устройств хранится в `VpnProfile.deviceLimit`** (по умолчанию 2) и применяется на панели через `bulkAdjust` по основному клиенту; число слотов = `min(deviceLimit, 5)`. Сейчас лимит сотрудника с лимитом 5 существует только на панели — бэкфилл читает `limitHwid` с панели и записывает в профиль.
3. **Синхронизация вспомогательных клиентов по лимиту** — одна функция `syncAwgAuxClients(profile)`: создаёт недостающие слоты (`bulkCreate`, один перезапуск Xray), удаляет лишние и их `VpnAwgSlot`. Вызывается при создании профиля, изменении лимита, перевыпуске, бэкфилле.
4. **Отзыв — один путь для увольнения, перевыпуска и отключения**: `revokeProfile` удаляет основного и всех вспомогательных клиентов (только при совпадении subId), очищает слоты; любой сбой удаления — профиль не трогаем, ошибка наверх (админу) и в лог.
5. **Перевыпуск** = `revokeProfile` + `getOrCreateProfile` с тем же `deviceLimit`. Логин может совпасть со старым, если тот освобождён. Сбой отзыва — новый не создаётся.
6. **Запрет VPN — `User.vpnDisabledAt` (+ `vpnDisabledById`)**. «Отключить VPN» = отзыв + установка; `getAccessFromBot` при запрете бросает `ForbiddenError("VPN отключён администратором")`; бот показывает текст ошибки API для 403 вместо общего «Не получилось…». «Создать VPN» снимает запрет.
7. **Добавление сотрудника — `adminVpnService.addEmployee`** по таблице из спеки; PENDING идёт через существующий `approveAccessRequest` (аудит и канал те же), REJECTED — сброс статуса + канал EMPLOYEE, нового — `userRepository.createTelegramEmployee` (status ACTIVE, канал EMPLOYEE, `deviceLimit`). Без уведомлений в бот: в одобрении заявки уведомление `notifyAccessDecision` для этого пути не вызывается (флаг `notify:false`).
8. **Список — данные из БД + один `clients/list`**: состояние «устарела» = нет клиента с логином профиля или subId другой; трафик «всего» = сумма `up+down` основного и вспомогательных; устройства и «за 30 дней» — из последнего снимка (см. 9). Карточка сотрудника грузит устройства живьём (`hwids`). Альтернатива «hwids по каждому сотруднику при открытии списка» отвергнута: ~70 запросов к панели на каждое открытие страницы.
9. **Снимки — `VpnUsageSnapshot(profileId, day, upBytes, downBytes, deviceCount)`**, уникальность `(profileId, day)`. Ночная задача (`server.ts`, проверка раз в час, выполнение один раз в сутки после 03:00 МСК): один `clients/list` + последовательно `hwids` по каждому профилю (≈70 лёгких запросов, по одному, без параллели). Трафик за 30 дней — чистая функция по ряду снимков: сумма `max(0, cur − prev)`; при уменьшении счётчика прирост дня = текущее значение. BigInt для байтов.
10. **Письмо — `templates/vpnAccess.ts`** в `lemarkEmailShell`, текст краткий; ссылки INCY в `vpnConfig`: App Store `https://apps.apple.com/app/incy/id6756943388`, Google Play `https://play.google.com/store/apps/details?id=llc.itdev.incy`. Ссылка коннектора = `${webAppUrl}/vpn-connect?url=<encodeURIComponent(подписка)>`.
11. **Email при отправке** сохраняется в `User.email`, если свободен (уникальное поле; входа в Lemark One без пароля не даёт); занят — 409 с ФИО владельца.
12. **API — `/admin/vpn/*`**, `requireWebAuth` + `requirePlainPermission("user.manage")`, контроллер `AdminVpnController`, сервис `adminVpnService`, валидаторы Zod. Аудит: `vpn.employee_added`, `vpn.profile_created`, `vpn.reissued`, `vpn.disabled`, `vpn.email_sent` (адрес в metadata), `vpn.limit_changed`, `vpn.device_deleted`. Ссылки и ключи в metadata не пишутся.
13. **Web**: страница `VpnAdminPage` (десктоп: таблица; мобильный вид: карточки через `useIsMobile`), карточка сотрудника — `Sheet`/диалог с кнопками; пункт «VPN» в группе «Администрирование» Sidebar при `user.manage`; в PWA — пункт «VPN-доступы» в Профиле, маршрут общий `/vpn-admin` под `RequirePermission user.manage`.

## Risks / Trade-offs

- [Удаление клиентов панели необратимо] → подтверждение в UI; сбой удаления ничего не меняет у нас; аудит.
- [Вспомогательные клиенты до 5 на сотрудника] → один путь отзыва для всех случаев + тесты на увольнение/перевыпуск/отключение со слотами 2…5.
- [Ночная задача нагружает панель или API-ВМ] → один `clients/list` + последовательные `hwids`, без параллели, один раз в сутки; на проде никаких тяжёлых вычислений (урок 2026-10-05).
- [Устройства в списке на день старые] → в списке подпись «на <время снимка>», в карточке живые данные.
- [Миграция aux-полей] → аддитивная таблица + перенос в той же миграции, затем удаление полей; бэкфилл проверяет соответствие панели.
- [Добавление поверх заявки двойным путём (бот и админ одновременно)] → одобрение идемпотентно по статусу; повторное — отказ «уже активен».

## Migration Plan

1. Миграция Prisma: `VpnAwgAuxClient` (перенос слота 2), `VpnProfile.deviceLimit`, `User.vpnDisabledAt/vpnDisabledById`, `VpnUsageSnapshot`; удаление `awgAuxPanelEmail/awgAuxSubId`.
2. Бэкфилл: `deviceLimit` из `limitHwid` панели; `syncAwgAuxClients` для профилей с лимитом > 2 (`--dry-run` сначала).
3. Деплой API, бота, веба. Первая ночная задача создаёт первый снимок.
Откат: веб-раздел можно скрыть, бот работает как раньше; миграция аддитивная, кроме удаления aux-полей — откат кода требует обратной миграции, поэтому перенос и удаление полей проверяются на локальной копии перед выкаткой.
