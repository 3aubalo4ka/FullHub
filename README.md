# FullHub — Production Backend Edition

FullHub — корпоративный портал (SPA) с backend на Node.js.

## Что сделано для production

В текущей версии выполнены ключевые требования production-hardening:

- ✅ Логика и хранение вынесены на backend (`server.js`, SQLite).
- ✅ `JWT_SECRET` обязателен и валидируется (минимум 32 символа).
- ✅ Публичный reset endpoint закрыт: только для `admin` + опциональный IP allowlist.
- ✅ Демо-логины/пароли обновлены на новые значения.
- ✅ Пароли хранятся в хешированном виде (`bcryptjs`).
- ✅ API-права разделены (RBAC на endpoint-ах).
- ✅ Добавлен аудит с immutable chain hash (`audit_log`).
- ✅ Добавлены миграции БД (`schema_migrations`).
- ✅ Добавлены API smoke-тесты (`node --test`) и CI workflow.
- ✅ Добавлены скрипты резервного копирования БД и пример настройки UFW.
- ✅ Дана инструкция по HTTPS (Nginx + Let’s Encrypt).

---

## Архитектура

### Frontend
- `index.html`, `styles.css`, `app.js`
- SPA работает через API:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/state`
  - `PUT /api/state` (только admin)
  - `POST /api/attendance/mark`
  - `POST /api/reset` (только admin + optional IP allowlist)

### Backend
- `server.js` (Express)
- `better-sqlite3` (SQLite)
- `jsonwebtoken` (JWT)
- `bcryptjs` (hash паролей)

### База данных (нормализованные таблицы)
- `users`
- `dictionaries`
- `shifts`
- `payouts`
- `adjustments`
- `settings`
- `holiday_days`
- `audit_log` (immutable запись через hash chain)
- `schema_migrations`

---

## Новые демо-учётки

- **Администратор**: `79991112233` / `Adm!n-FullHub-2026`
- **Сотрудник**: `79992223344` / `User-FullHub-2026!`

> Сразу после деплоя в боевую среду смените эти пароли.

---

## Быстрый старт

### 1) Установка
```bash
npm install
```

### 2) Запуск
```bash
JWT_SECRET='replace-with-very-strong-secret-min-32-chars' npm start
```

По умолчанию:
- `PORT=4173`

### 3) Проверка
```bash
curl http://127.0.0.1:4173/api/health
```

---

## Переменные окружения

- `JWT_SECRET` — **обязателен**, минимум 32 символа.
- `PORT` — порт приложения (по умолчанию `4173`).
- `RESET_IP_ALLOWLIST` — список IP для `/api/reset`, через запятую.

Пример:
```bash
JWT_SECRET='super-long-random-secret-64chars...' \
PORT=4173 \
RESET_IP_ALLOWLIST='127.0.0.1,10.0.0.10' \
npm start
```

---

## RBAC и безопасность API

- `GET /api/state`:
  - admin: полный state,
  - employee: только собственные данные (users/shifts/payouts/adjustments фильтруются).
- `PUT /api/state`: только admin.
- `POST /api/reset`: только admin (+ optional IP allowlist).
- `POST /api/attendance/mark`: авторизованный пользователь.

---

## HTTPS (обязательно для продакшена)

Рекомендуемая схема: Nginx reverse proxy + Let’s Encrypt.

### Nginx (пример)
```nginx
server {
    listen 80;
    server_name your-domain.ru www.your-domain.ru;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Выпуск SSL
```bash
apt-get update && apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.ru -d www.your-domain.ru
```

---

## Резервное копирование БД

Добавлен скрипт:
- `scripts/backup_db.sh`

Запуск вручную:
```bash
./scripts/backup_db.sh
```

По умолчанию бэкапы складываются в `/var/backups/fullhub`.

Пример cron (ежедневно в 02:30):
```cron
30 2 * * * /var/www/fullhub/scripts/backup_db.sh >> /var/log/fullhub-backup.log 2>&1
```

---

## Логирование и мониторинг процесса

- Access log пишется в `data/access.log`.
- Audit log пишется в таблицу `audit_log`.
- Health endpoint: `GET /api/health`.

### Рекомендуемый запуск в проде
Через PM2:
```bash
npm i -g pm2
cd /var/www/fullhub
JWT_SECRET='super-strong-secret' PORT=4173 pm2 start server.js --name fullhub
pm2 save
pm2 startup
```

Мониторинг:
```bash
pm2 status
pm2 logs fullhub
```

---

## Ограничение доступа (фаервол)

Добавлен пример скрипта:
- `scripts/firewall_ufw_example.sh`

Он настраивает UFW с политикой deny incoming и открывает только 22/80/443.
Перед применением обязательно проверьте SSH-доступ.

---

## Миграции БД

Миграции выполняются на старте сервера.
Хранятся в `server.js` (`MIGRATIONS`) и фиксируются в таблице `schema_migrations`.

---

## Тесты и CI/CD

### Локально
```bash
npm test
```

Проверяются:
- health endpoint,
- логин seeded admin.

### CI
Добавлен workflow:
- `.github/workflows/ci.yml`

Он выполняет:
- `npm ci`
- `node --check app.js`
- `node --check server.js`
- `npm test`

---


## Рекомендованная ОС для Timeweb Cloud

Для FullHub оптимально выбирать:
- **Ubuntu 24.04 LTS** (рекомендуется),
- либо Ubuntu 22.04 LTS.

Почему Ubuntu LTS:
- стабильные пакеты и долгий срок поддержки,
- простая установка Node.js, Nginx, Certbot, PM2,
- предсказуемая эксплуатация и много готовых инструкций.

---

## Авторазвёртывание на Timeweb Cloud через user-data скрипт

Да, поле «Автоматизируйте первоначальную настройку сервера…» подходит идеально.

В репозитории добавлен скрипт:
- `scripts/timeweb_cloud_init.sh`

Он автоматически:
1. устанавливает Node.js, Nginx, PM2, UFW, Certbot;
2. клонирует проект;
3. создаёт `.env` c `JWT_SECRET` (или генерирует его);
4. ставит зависимости `npm ci --omit=dev`;
5. запускает приложение через PM2;
6. настраивает Nginx reverse proxy;
7. включает firewall (22/80/443);
8. включает HTTPS (Let’s Encrypt), если задан домен.

### Как использовать в Timeweb Cloud

1. При создании «Облачного сервера» выберите **Ubuntu 24.04 LTS**.
2. В поле user-data вставьте скрипт `scripts/timeweb_cloud_init.sh`.
3. Перед вставкой обязательно поменяйте значения в блоке `CONFIGURE THESE VALUES`:

   Для вашего кейса домен уже зафиксирован: `fullhub.website` (и `www.fullhub.website`).
   - `REPO_URL`
   - `REPO_BRANCH`
   - `DOMAIN`
   - `EMAIL`
   - `JWT_SECRET` (можно оставить пустым для автогенерации)
4. Дождитесь завершения инициализации.
5. Проверьте:
   - `https://ваш-домен/api/health`
   - `pm2 status`

> Важно: если репозиторий приватный, задайте `GIT_TOKEN` в скрипте (лучше временный токен с минимальными правами).

---
## Деплой на hosting.timeweb (VDS/VPS)

### 1. Создать VDS
В панели Timeweb создайте VDS, подключитесь по SSH.

### 2. Развернуть проект
```bash
cd /var/www
git clone <your-repo> fullhub
cd fullhub
npm install --omit=dev
```

### 3. Запустить backend
```bash
JWT_SECRET='super-strong-secret' PORT=4173 pm2 start server.js --name fullhub
pm2 save
```

### 4. Привязка домена
В DNS:
- `A @ -> <IP VDS>`
- `A/CNAME www -> @`

### 5. Nginx + SSL
Настроить reverse proxy и выпустить сертификат Let’s Encrypt.

---

## Что можно улучшать дальше

- Вынести миграции в отдельную директорию/инструмент (umzug/knex migration).
- Добавить refresh-token схему и ротацию ключей.
- Добавить rate-limit на login.
- Добавить e2e браузерные тесты в CI.
