# Tasks

## 1. Данные и API подтверждения

- [x] 1.1 Prisma: поля `dataConfirmationDeadline`, `dataConfirmationRemindedAt`, `dataConfirmationRequestedById` у `User`; миграция применяется локально
- [x] 1.2 Чистая функция решения по сроку (`none` / `remind` / `block`) + unit-тесты (за 6 ч — ничего, за 5 ч — напоминание один раз, после срока — блокировка без напоминания)
- [x] 1.3 `blockUser` с исполнителем `null` и видом уведомления; unit-тест: системная блокировка шлёт `user_blocked_data_unconfirmed`, ручная — `employee_terminated`, VPN отзывается в обоих случаях
- [x] 1.4 `requestDataConfirmation` ставит срок 48 ч и кто запросил; `confirmDataSelf` и `fixFullNameSelf` снимают срок и уведомляют запросившего; `processDataConfirmationDeadlines` (напоминание/блокировка); unit-тесты с моками
- [x] 1.5 Бот-эндпоинт `POST /users/confirm-data-bot`; `setInterval` 10 мин в `server.ts`; `UserDTO` отдаёт срок; typecheck

## 2. Бот

- [x] 2.1 `confirm_data_request` — новый текст с ФИО, сроком и кнопкой «Данные верны»; `confirm_data_reminder`; `user_blocked_data_unconfirmed` (сообщение + удаление из чатов, общий код с `employee_terminated`); callback «Данные верны» → API; `ApiClient.confirmDataSelf`; typecheck

## 3. Веб

- [x] 3.1 `notifyNewAccessRequest` — WEB+push HRD и Администраторам; `describeNotification` для новых типов (`access_request_new`, `data_confirmed`, `user_blocked_data_unconfirmed`) и навигация (на `/access-requests` и `/users`)
- [x] 3.2 PWA: баннер заявок в `MobileShell`, пункт в `ProfilePage`, мобильная вёрстка `AccessRequestsCard`; проверить в браузере на ширине 390 px
- [x] 3.3 `UsersPage`: «ждёт подтверждения до …» у сотрудника; проверить в браузере

## 4. Выкатка

- [ ] 4.1 Деплой API, бота, веба; проверить на проде: запрос подтверждения себе/тестовому сотруднику, кнопка «Данные верны», заявки в PWA
