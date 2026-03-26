# node-qbittorrent-api-client

English version: [README.md](README.md)

Node.js CLI-клиент для qBittorrent WebUI API.

## Требования

- Node.js 18+
- включённый WebUI в qBittorrent

## Конфигурация

Скрипт не читает `config.json`. Все параметры передаются через переменные окружения с префиксом `QBT_API_`.

Обязательные:

- `QBT_API_URL` — адрес qBittorrent WebUI, например `http://127.0.0.1:8080`

Для логина при создании или обновлении сессии:

- `QBT_API_USERNAME`
- `QBT_API_PASSWORD`

Опционально:

- `QBT_API_COOKIE_FILE` — путь к файлу cookie-сессии

Если `QBT_API_COOKIE_FILE` не задан, cookie хранится локально рядом со скриптом в `.qbt-api-cookie`.

Пример:

```bash
export QBT_API_URL="http://127.0.0.1:8080"
export QBT_API_USERNAME="admin"
export QBT_API_PASSWORD="adminadmin"
```

Можно хранить переменные в локальном `.env`, если ты сам загружаешь его через shell или свой tooling.

## Запуск

Из папки `node-qbittorrent-api-client`:

```bash
chmod +x ./node-qbittorrent-api-client.js
node ./node-qbittorrent-api-client.js version
```

Через `npm`:

```bash
npm run help
npm run check
```

Или напрямую:

```bash
./node-qbittorrent-api-client.js version
```

Из любой другой директории:

```bash
node /Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/node-qbittorrent-api-client.js version
```

## Основные команды

Список торрентов:

```bash
node ./node-qbittorrent-api-client.js list
node ./node-qbittorrent-api-client.js list --filter downloading
node ./node-qbittorrent-api-client.js list --category movies --limit 20
```

Информация по торренту:

```bash
node ./node-qbittorrent-api-client.js info <hash>
node ./node-qbittorrent-api-client.js files <hash>
node ./node-qbittorrent-api-client.js trackers <hash>
```

Добавление:

```bash
node ./node-qbittorrent-api-client.js add "magnet:?xt=..."
node ./node-qbittorrent-api-client.js add "https://example.com/file.torrent" --category movies --tags cinema
node ./node-qbittorrent-api-client.js add-file ./example.torrent --paused
```

Управление:

```bash
node ./node-qbittorrent-api-client.js pause <hash>
node ./node-qbittorrent-api-client.js resume <hash>
node ./node-qbittorrent-api-client.js delete <hash>
node ./node-qbittorrent-api-client.js delete <hash> --files
node ./node-qbittorrent-api-client.js recheck <hash>
node ./node-qbittorrent-api-client.js reannounce <hash>
```

Категории и теги:

```bash
node ./node-qbittorrent-api-client.js categories
node ./node-qbittorrent-api-client.js tags
node ./node-qbittorrent-api-client.js set-category <hash> movies
node ./node-qbittorrent-api-client.js add-tags <hash> cinema,watchlist
node ./node-qbittorrent-api-client.js remove-tags <hash> watchlist
```

Скорости и настройки:

```bash
node ./node-qbittorrent-api-client.js transfer
node ./node-qbittorrent-api-client.js speedlimit
node ./node-qbittorrent-api-client.js set-speedlimit --down 10M --up 2M
node ./node-qbittorrent-api-client.js toggle-alt-speed
node ./node-qbittorrent-api-client.js preferences
```

Полная справка:

```bash
node ./node-qbittorrent-api-client.js --help
```

## Переменные окружения

- `QBT_API_URL`
- `QBT_API_USERNAME`
- `QBT_API_PASSWORD`
- `QBT_API_COOKIE_FILE`

## Тесты

Тестовые сценарии и Docker compose лежат в [`/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests`](/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests).

Файлы:

- [`/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/docker-compose.test.yml`](/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/docker-compose.test.yml)
- [`/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/test-lib.sh`](/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/test-lib.sh)
- [`/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/smoke-test.sh`](/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/smoke-test.sh)
- [`/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/integration-test.sh`](/Users/frenzy/dev/homelab-openclaw-workspace/node-qbittorrent-api-client/tests/integration-test.sh)

Smoke test:

```bash
npm run smoke:test
```

Он:

- поднимает `qbittorrentofficial/qbittorrent-nox:latest`
- ждёт временный WebUI-пароль из логов контейнера
- подставляет его в `QBT_API_*`
- вызывает `version`, `preferences` и `list`
- останавливает контейнер и удаляет тестовый cookie

Integration test:

```bash
npm run integration:test
```

Он:

- добавляет тестовый magnet
- проверяет появление торрента через `list --tag`
- вызывает `info`
- удаляет торрент через `delete`

Важно:

- при первом запуске тесты тянут Docker image из сети
- для qBittorrent `>= 4.6.1` WebUI использует временный пароль, который тесты читают из `docker logs`
- тестовый Docker стенд настроен так, чтобы избежать ошибки `Invalid Host header, port mismatch` в новых версиях qBittorrent
