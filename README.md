# node-qbittorrent-api-client

Russian version: [README_RU.md](README_RU.md)

Node.js CLI client for the qBittorrent WebUI API.

## Requirements

- Node.js 18+
- qBittorrent WebUI enabled

## Configuration

The client does not read `config.json`. All configuration comes from environment variables with the `QBT_API_` prefix.

When the CLI starts, it also checks for a local `.env` file next to [`node-qbittorrent-api-client.js`](./node-qbittorrent-api-client.js) and uses values from it only for variables that are not already set in the process environment.

Required:

- `QBT_API_URL` — qBittorrent WebUI URL, for example `http://127.0.0.1:8080`

Required when creating or refreshing a session:

- `QBT_API_USERNAME`
- `QBT_API_PASSWORD`

Optional:

- `QBT_API_COOKIE_FILE` — path to the session cookie file

If `QBT_API_COOKIE_FILE` is not set, the cookie is stored locally next to the client script in `.qbt-api-cookie`.

Example:

```bash
export QBT_API_URL="http://127.0.0.1:8080"
export QBT_API_USERNAME="admin"
export QBT_API_PASSWORD="adminadmin"
```

You can also keep these variables in a local `.env` file next to the CLI:

```bash
QBT_API_URL="http://127.0.0.1:8080"
QBT_API_USERNAME="admin"
QBT_API_PASSWORD="adminadmin"
```

If the same variable is already exported in the shell, the exported value wins over `.env`.

## Usage

From the `node-qbittorrent-api-client` directory:

```bash
chmod +x ./node-qbittorrent-api-client.js
node ./node-qbittorrent-api-client.js version
```

With `npm`:

```bash
npm run help
npm run check
```

Directly:

```bash
./node-qbittorrent-api-client.js version
```

From any other directory:

```bash
node /path/to/node-qbittorrent-api-client/node-qbittorrent-api-client.js version
```

## Common Commands

List torrents:

```bash
node ./node-qbittorrent-api-client.js list
node ./node-qbittorrent-api-client.js list --filter downloading
node ./node-qbittorrent-api-client.js list --category movies --limit 20
```

Inspect a torrent:

```bash
node ./node-qbittorrent-api-client.js info <hash>
node ./node-qbittorrent-api-client.js files <hash>
node ./node-qbittorrent-api-client.js trackers <hash>
```

Add torrents:

```bash
node ./node-qbittorrent-api-client.js add "magnet:?xt=..."
node ./node-qbittorrent-api-client.js add "https://example.com/file.torrent" --category movies --tags cinema
node ./node-qbittorrent-api-client.js add-file ./example.torrent --paused
```

Control torrents:

```bash
node ./node-qbittorrent-api-client.js pause <hash>
node ./node-qbittorrent-api-client.js resume <hash>
node ./node-qbittorrent-api-client.js delete <hash>
node ./node-qbittorrent-api-client.js delete <hash> --files
node ./node-qbittorrent-api-client.js recheck <hash>
node ./node-qbittorrent-api-client.js reannounce <hash>
```

Categories and tags:

```bash
node ./node-qbittorrent-api-client.js categories
node ./node-qbittorrent-api-client.js tags
node ./node-qbittorrent-api-client.js set-category <hash> movies
node ./node-qbittorrent-api-client.js add-tags <hash> cinema,watchlist
node ./node-qbittorrent-api-client.js remove-tags <hash> watchlist
```

Transfer and preferences:

```bash
node ./node-qbittorrent-api-client.js transfer
node ./node-qbittorrent-api-client.js speedlimit
node ./node-qbittorrent-api-client.js set-speedlimit --down 10M --up 2M
node ./node-qbittorrent-api-client.js toggle-alt-speed
node ./node-qbittorrent-api-client.js preferences
```

Full help:

```bash
node ./node-qbittorrent-api-client.js --help
```

## Environment Variables

- `QBT_API_URL`
- `QBT_API_USERNAME`
- `QBT_API_PASSWORD`
- `QBT_API_COOKIE_FILE`

The CLI reads them in this order:

1. Existing process environment
2. Local `.env` next to the CLI, only for missing keys

## Tests

The Docker-based test setup lives in [`tests`](./tests).

Files:

- [`tests/docker-compose.test.yml`](./tests/docker-compose.test.yml)
- [`tests/test-lib.sh`](./tests/test-lib.sh)
- [`tests/smoke-test.sh`](./tests/smoke-test.sh)
- [`tests/integration-test.sh`](./tests/integration-test.sh)

Smoke test:

```bash
npm run smoke:test
```

It:

- starts `qbittorrentofficial/qbittorrent-nox:latest`
- waits for the temporary WebUI password from container logs
- exports `QBT_API_*`
- calls `version`, `preferences`, and `list`
- stops the container and removes the test cookie

Integration test:

```bash
npm run integration:test
```

It:

- adds a test magnet
- waits until the torrent appears in `list --tag`
- calls `info`
- removes the torrent with `delete`

Notes:

- the first run pulls the Docker image from the network
- qBittorrent `>= 4.6.1` uses a temporary WebUI password, so the tests read it from `docker logs`
- the Docker test setup is configured to avoid the `Invalid Host header, port mismatch` issue in newer qBittorrent releases
