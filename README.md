# FullHub (Production Backend Edition)

FullHub — корпоративный портал с ролями **Администратор** и **Сотрудник**.

В этой версии логика авторизации и хранение данных вынесены на backend:
- frontend: `index.html` + `styles.css` + `app.js`;
- backend: `server.js` (Node.js + Express + SQLite);
- данные хранятся в `data/fullhub.db`.

---

## Что реализовано

## 1) Роли и авторизация
- Вход по телефону/паролю через backend API (`/api/auth/login`).
- Токен-сессия (JWT) хранится в браузере и используется для API-запросов.
- Данные приложения загружаются с сервера (`/api/state`) после входа.

## 2) Сотрудники
- Создание, редактирование (через шестерёнку), удаление.
- Справочники: должности, формы оплаты, отделы, графики.
- Поиск и фильтры.

## 3) Смены и графики
- Самара: 3 блока (логистика/упаковка/водители).
- Тольятти: отдельный блок.
- Автогенерация смен по графикам.
- Ручное назначение и редактирование смен.

## 4) QR-учёт
- QR для отметки прихода/ухода.
- Проверка токена дня.
- Поддержка fallback ручного ввода.

## 5) Финансы и аналитика
- Периодные фильтры и расчёты.
- Премии/штрафы/выплаты, автоштрафы.
- История операций, аналитика, экспорт.

## 6) Личный кабинет сотрудника
- KPI за месяц, QR-статус.
- Раскрывающиеся блоки профиля, смен и истории движения средств.

---

## Архитектура

### Frontend
- `index.html` — структура UI.
- `styles.css` — оформление.
- `app.js` — рендер, бизнес-логика UI, вызовы backend API.

### Backend
- `server.js` — API + раздача статических файлов.
- База данных: SQLite (`data/fullhub.db`).
- Основные API:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/state`
  - `PUT /api/state`
  - `POST /api/reset` (сброс демо-данных)

### Важно
Текущая модель хранения — единый JSON state в БД. Это уже серверное хранение и единый источник данных, но для enterprise-нагрузки рекомендуется следующий этап: декомпозиция на нормализованные таблицы (users/shifts/payouts/...), аудит, RBAC-политики, миграции схемы.

---

## Демо-доступ
- Администратор: `79990000000` / `admin123`
- Сотрудник: `79990000001` / `user123`

> После запуска в проде обязательно смените пароли и удалите/измените демо-учётки.

---

## Локальный запуск (production-подобно)

### 1. Установить зависимости
```bash
npm install
```

### 2. Запустить сервер
```bash
npm start
```

По умолчанию приложение доступно на:
- <http://localhost:4173>

---

## Переменные окружения

- `PORT` — порт сервера (по умолчанию `4173`).
- `JWT_SECRET` — секрет подписи JWT (в production обязательно задайте свой).

Пример:
```bash
PORT=4173 JWT_SECRET='replace-with-strong-secret' npm start
```

---

## Production checklist

- [ ] Задать сильный `JWT_SECRET`.
- [ ] Отключить публичный reset endpoint или закрыть его авторизацией/IP.
- [ ] Сменить демо-логины/пароли.
- [ ] Включить HTTPS.
- [ ] Настроить резервное копирование `data/fullhub.db`.
- [ ] Настроить логирование и мониторинг процесса.
- [ ] Ограничить доступ к серверу фаерволом.

---

## Деплой на hosting.timeweb + привязка домена

Ниже инструкция для **Node.js размещения** (VDS/VPS или тариф с поддержкой Node-процессов).

> Для «чистого» shared static hosting запуск Node backend обычно недоступен. В таком случае нужен VPS/VDS в Timeweb.

### Шаг 1. Подготовьте сервер
1. Создайте VDS в Timeweb.
2. Подключитесь по SSH.
3. Установите Node.js LTS (рекомендуется 20+).

### Шаг 2. Загрузите проект
Варианты:
- `git clone` репозитория,
- загрузка архивом,
- SFTP.

Допустим путь проекта:
```bash
/var/www/fullhub
```

### Шаг 3. Установите зависимости
```bash
cd /var/www/fullhub
npm install --omit=dev
```

### Шаг 4. Запуск через PM2 (рекомендуется)
```bash
npm i -g pm2
cd /var/www/fullhub
JWT_SECRET='very-strong-secret' PORT=4173 pm2 start server.js --name fullhub
pm2 save
pm2 startup
```

Проверка:
```bash
pm2 status
curl http://127.0.0.1:4173
```

### Шаг 5. Настройте Nginx reverse proxy
Пример конфига `/etc/nginx/sites-available/fullhub.conf`:

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

Активируйте:
```bash
ln -s /etc/nginx/sites-available/fullhub.conf /etc/nginx/sites-enabled/fullhub.conf
nginx -t
systemctl reload nginx
```

### Шаг 6. Привязка домена
В панели DNS (Timeweb или регистратор):
- `A` запись для `@` → IP вашего VDS,
- `A` или `CNAME` для `www`.

Дождитесь распространения DNS.

### Шаг 7. SSL (Let’s Encrypt)
```bash
apt-get update && apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.ru -d www.your-domain.ru
```

После этого включится HTTPS и редирект с HTTP.

---

## Бэкапы и обновления

## Бэкап БД
Минимально — ежедневная копия файла:
```bash
cp /var/www/fullhub/data/fullhub.db /var/backups/fullhub-$(date +%F).db
```

Лучше добавить cron + ротацию.

## Обновление релиза
```bash
cd /var/www/fullhub
git pull
npm install --omit=dev
pm2 restart fullhub
```

---

## Диагностика

### Не логинится
- Проверьте `JWT_SECRET` и актуальность кода (`pm2 logs fullhub`).
- Убедитесь, что API отвечает: `curl http://127.0.0.1:4173/api/auth/me` (с токеном).

### Не применяются изменения в интерфейсе
- Сделайте hard refresh (`Ctrl+F5`).
- Проверьте, что Nginx проксирует на правильный порт.

### Камера не открывается для QR
- Убедитесь, что сайт открывается по HTTPS.
- Проверьте browser permissions на камеру.

---

## Что улучшить дальше (enterprise roadmap)
- Хранить пользователей/смены/финансы в нормализованных таблицах.
- Хешировать пароли (`argon2`/`bcrypt`) вместо хранения в явном виде.
- Разделить API-права (админ/сотрудник) на уровне endpoint-ов.
- Добавить аудит действий и immutable-журнал изменений.
- Добавить миграции БД, CI/CD, тесты API и e2e.
