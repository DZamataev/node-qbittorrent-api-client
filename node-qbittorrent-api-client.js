#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URLSearchParams } = require("url");

const SCRIPT_DIR = __dirname;
const DEFAULT_ENV_FILE = path.join(SCRIPT_DIR, ".env");
const DEFAULT_COOKIE_FILE = path.join(SCRIPT_DIR, ".qbt-api-cookie");

loadDotenvFile(DEFAULT_ENV_FILE);

const config = {
  url: process.env.QBT_API_URL || "",
  username: process.env.QBT_API_USERNAME || "",
  password: process.env.QBT_API_PASSWORD || "",
  cookieFile: process.env.QBT_API_COOKIE_FILE || DEFAULT_COOKIE_FILE,
};

function loadDotenvFile(envFile) {
  let content = "";

  try {
    content = fs.readFileSync(envFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const exportPrefix = line.startsWith("export ") ? "export " : "";
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(exportPrefix.length, separatorIndex).trim();
    if (!key || process.env[key] != null) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function writeStdout(value) {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value) {
  process.stderr.write(`${value}\n`);
}

function fail(message, code = 1) {
  writeStderr(message);
  process.exit(code);
}

function usage() {
  writeStdout(`qBittorrent WebUI API CLI

Usage: ${path.basename(process.argv[1])} <command> [options]

Environment:
  Values are loaded from ${DEFAULT_ENV_FILE} when present unless already set globally.
  QBT_API_URL            qBittorrent WebUI URL, required
  QBT_API_USERNAME       WebUI username
  QBT_API_PASSWORD       WebUI password
  QBT_API_COOKIE_FILE    Cookie file path (default: ${DEFAULT_COOKIE_FILE})

Commands:
  list [--filter F] [--category C] [--tag T] [--sort S] [--limit N] [--offset N]
  info <hash>                    Get torrent properties
  files <hash>                   Get torrent files
  trackers <hash>                Get torrent trackers

  add <url|magnet> [--category C] [--tags T] [--paused] [--skip-check]
  add-file <path> [--category C] [--tags T] [--paused]

  pause <hash|all>               Pause torrent(s)
  resume <hash|all>              Resume torrent(s)
  delete <hash> [--files]        Delete torrent (optionally with files)
  recheck <hash>                 Recheck torrent
  reannounce <hash>              Reannounce to trackers

  set-category <hash> <category>
  add-tags <hash> <tags>
  remove-tags <hash> <tags>

  categories                     List categories
  tags                           List tags

  transfer                       Global transfer info
  speedlimit                     Get speed limits
  set-speedlimit [--down D] [--up U]   Set limits (e.g. 5M, 1024K)
  toggle-alt-speed               Toggle alternative speed limits

  version                        App version
  preferences                    App preferences

Examples:
  ${path.basename(process.argv[1])} list --filter downloading
  ${path.basename(process.argv[1])} add "magnet:?xt=..." --category movies
  ${path.basename(process.argv[1])} pause all
  ${path.basename(process.argv[1])} set-speedlimit --down 10M`);
}

function ensureConfig() {
  if (!config.url) {
    fail("Error: QBT_API_URL must be set");
  }

  config.url = config.url.replace(/\/+$/, "");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.shift() || "";
  return { command, args };
}

function consumeValue(args, index, option) {
  const value = args[index + 1];
  if (value == null || value.startsWith("-")) {
    fail(`Option requires a value: ${option}`);
  }
  return value;
}

function parseKeyValueOptions(args, handlers) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const handler = handlers[token];

    if (!handler) {
      fail(`Unknown option: ${token}`);
    }

    if (handler.type === "flag") {
      options[handler.key] = true;
      continue;
    }

    const value = consumeValue(args, index, token);
    options[handler.key] = value;
    index += 1;
  }

  return options;
}

async function saveCookie(cookie) {
  await fsp.mkdir(path.dirname(config.cookieFile), { recursive: true });
  await fsp.writeFile(config.cookieFile, cookie, "utf8");
}

async function loadCookie() {
  const value = await fsp.readFile(config.cookieFile, "utf8");
  return value.trim();
}

async function fetchText(method, endpoint, { headers = {}, body } = {}) {
  const response = await fetch(`${config.url}${endpoint}`, {
    method,
    headers: {
      Referer: config.url,
      ...headers,
    },
    body,
  });

  const text = await response.text();
  return { response, text };
}

async function doLogin() {
  if (!config.username || !config.password) {
    fail(
      "Error: QBT_API_USERNAME and QBT_API_PASSWORD must be set to create a new session",
    );
  }

  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
  });

  const { response, text } = await fetchText("POST", "/api/v2/auth/login", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const setCookie = response.headers.get("set-cookie") || "";
  const sidMatch = setCookie.match(/SID=([^;]+)/i);

  if (!response.ok || !sidMatch || text.trim() !== "Ok.") {
    fail("Login failed");
  }

  await saveCookie(sidMatch[1]);
  return sidMatch[1];
}

async function ensureSession() {
  try {
    const sid = await loadCookie();
    const { response } = await fetchText("GET", "/api/v2/app/version", {
      headers: {
        Cookie: `SID=${sid}`,
      },
    });

    if (response.ok) {
      return sid;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return doLogin();
}

async function apiCall(
  method,
  endpoint,
  { headers = {}, body, expectJsonOk } = {},
) {
  const sid = await ensureSession();
  const { response, text } = await fetchText(method, endpoint, {
    headers: {
      Cookie: `SID=${sid}`,
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    fail(
      `Request failed: ${response.status} ${response.statusText}${text ? `\n${text}` : ""}`,
    );
  }

  if (expectJsonOk) {
    writeStdout(JSON.stringify({ status: "ok" }));
    return;
  }

  if (text.length > 0) {
    writeStdout(text);
  }
}

function buildQuery(params) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") {
      search.append(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

function parseSpeed(value) {
  if (/^\d+$/.test(value)) {
    return value;
  }

  const match = value.match(/^(\d+)([kKmMgG])$/);
  if (!match) {
    fail(`Invalid speed value: ${value}`);
  }

  const [, rawNumber, suffix] = match;
  const number = Number(rawNumber);

  switch (suffix.toLowerCase()) {
    case "k":
      return String(number * 1024);
    case "m":
      return String(number * 1024 * 1024);
    case "g":
      return String(number * 1024 * 1024 * 1024);
    default:
      return value;
  }
}

async function cmdList(args) {
  const options = parseKeyValueOptions(args, {
    "--filter": { key: "filter", type: "value" },
    "-f": { key: "filter", type: "value" },
    "--category": { key: "category", type: "value" },
    "-c": { key: "category", type: "value" },
    "--tag": { key: "tag", type: "value" },
    "-t": { key: "tag", type: "value" },
    "--sort": { key: "sort", type: "value" },
    "-s": { key: "sort", type: "value" },
    "--limit": { key: "limit", type: "value" },
    "-l": { key: "limit", type: "value" },
    "--offset": { key: "offset", type: "value" },
    "-o": { key: "offset", type: "value" },
  });

  await apiCall("GET", `/api/v2/torrents/info${buildQuery(options)}`);
}

async function cmdInfo(args) {
  const hash = args[0];
  if (!hash) {
    fail("Usage: info <hash>");
  }
  await apiCall(
    "GET",
    `/api/v2/torrents/properties?hash=${encodeURIComponent(hash)}`,
  );
}

async function cmdFiles(args) {
  const hash = args[0];
  if (!hash) {
    fail("Usage: files <hash>");
  }
  await apiCall(
    "GET",
    `/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`,
  );
}

async function cmdTrackers(args) {
  const hash = args[0];
  if (!hash) {
    fail("Usage: trackers <hash>");
  }
  await apiCall(
    "GET",
    `/api/v2/torrents/trackers?hash=${encodeURIComponent(hash)}`,
  );
}

async function cmdAdd(args) {
  const [url, ...rest] = args;
  if (!url) {
    fail(
      "Usage: add <url|magnet> [--category C] [--tags T] [--paused] [--skip-check]",
    );
  }

  const options = parseKeyValueOptions(rest, {
    "--category": { key: "category", type: "value" },
    "-c": { key: "category", type: "value" },
    "--tags": { key: "tags", type: "value" },
    "-t": { key: "tags", type: "value" },
    "--paused": { key: "paused", type: "flag" },
    "-p": { key: "paused", type: "flag" },
    "--skip-check": { key: "skipCheck", type: "flag" },
  });

  const { boundary, body } = buildMultipartBody({
    urls: url,
    paused: options.paused ? "true" : "false",
    skip_checking: options.skipCheck ? "true" : "false",
    ...(options.category ? { category: options.category } : {}),
    ...(options.tags ? { tags: options.tags } : {}),
  });

  await apiCall("POST", "/api/v2/torrents/add", {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    expectJsonOk: true,
  });
}

function buildMultipartBody(fields, fileFields = []) {
  const boundary = `----qbt-api-${Date.now().toString(16)}`;
  const chunks = [];

  Object.entries(fields).forEach(([name, value]) => {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  });

  fileFields.forEach((fileField) => {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\n` +
          `Content-Type: ${fileField.contentType || "application/octet-stream"}\r\n\r\n`,
      ),
    );
    chunks.push(fileField.content);
    chunks.push(Buffer.from("\r\n"));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    boundary,
    body: Buffer.concat(chunks),
  };
}

async function cmdAddFile(args) {
  const [filePathArg, ...rest] = args;
  if (!filePathArg) {
    fail("Usage: add-file <path> [--category C] [--tags T] [--paused]");
  }

  const options = parseKeyValueOptions(rest, {
    "--category": { key: "category", type: "value" },
    "-c": { key: "category", type: "value" },
    "--tags": { key: "tags", type: "value" },
    "-t": { key: "tags", type: "value" },
    "--paused": { key: "paused", type: "flag" },
    "-p": { key: "paused", type: "flag" },
  });

  const fileContent = await fsp.readFile(filePathArg);
  const { boundary, body } = buildMultipartBody(
    {
      paused: options.paused ? "true" : "false",
      ...(options.category ? { category: options.category } : {}),
      ...(options.tags ? { tags: options.tags } : {}),
    },
    [
      {
        name: "torrents",
        filename: path.basename(filePathArg),
        contentType: "application/x-bittorrent",
        content: fileContent,
      },
    ],
  );

  await apiCall("POST", "/api/v2/torrents/add", {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    expectJsonOk: true,
  });
}

async function cmdPause(args) {
  const hashes = args[0];
  if (!hashes) {
    fail("Usage: pause <hash|all>");
  }
  await apiCall("POST", "/api/v2/torrents/pause", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes }),
    expectJsonOk: true,
  });
}

async function cmdResume(args) {
  const hashes = args[0];
  if (!hashes) {
    fail("Usage: resume <hash|all>");
  }
  await apiCall("POST", "/api/v2/torrents/resume", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes }),
    expectJsonOk: true,
  });
}

async function cmdDelete(args) {
  const [hash, ...rest] = args;
  if (!hash) {
    fail("Usage: delete <hash> [--files]");
  }

  const options = parseKeyValueOptions(rest, {
    "--files": { key: "files", type: "flag" },
    "-f": { key: "files", type: "flag" },
  });

  await apiCall("POST", "/api/v2/torrents/delete", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      hashes: hash,
      deleteFiles: options.files ? "true" : "false",
    }),
    expectJsonOk: true,
  });
}

async function cmdRecheck(args) {
  const hash = args[0];
  if (!hash) {
    fail("Usage: recheck <hash>");
  }
  await apiCall("POST", "/api/v2/torrents/recheck", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes: hash }),
    expectJsonOk: true,
  });
}

async function cmdReannounce(args) {
  const hash = args[0];
  if (!hash) {
    fail("Usage: reannounce <hash>");
  }
  await apiCall("POST", "/api/v2/torrents/reannounce", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes: hash }),
    expectJsonOk: true,
  });
}

async function cmdSetCategory(args) {
  const [hashes, category] = args;
  if (!hashes || category == null) {
    fail("Usage: set-category <hash> <category>");
  }

  await apiCall("POST", "/api/v2/torrents/setCategory", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes, category }),
    expectJsonOk: true,
  });
}

async function cmdAddTags(args) {
  const [hashes, tags] = args;
  if (!hashes || tags == null) {
    fail("Usage: add-tags <hash> <tags>");
  }

  await apiCall("POST", "/api/v2/torrents/addTags", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes, tags }),
    expectJsonOk: true,
  });
}

async function cmdRemoveTags(args) {
  const [hashes, tags] = args;
  if (!hashes || tags == null) {
    fail("Usage: remove-tags <hash> <tags>");
  }

  await apiCall("POST", "/api/v2/torrents/removeTags", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ hashes, tags }),
    expectJsonOk: true,
  });
}

async function cmdCategories() {
  await apiCall("GET", "/api/v2/torrents/categories");
}

async function cmdTags() {
  await apiCall("GET", "/api/v2/torrents/tags");
}

async function cmdTransfer() {
  await apiCall("GET", "/api/v2/transfer/info");
}

async function cmdSpeedlimit() {
  const sid = await ensureSession();

  const download = await fetchText("GET", "/api/v2/transfer/downloadLimit", {
    headers: { Cookie: `SID=${sid}` },
  });
  const upload = await fetchText("GET", "/api/v2/transfer/uploadLimit", {
    headers: { Cookie: `SID=${sid}` },
  });

  if (!download.response.ok || !upload.response.ok) {
    fail("Failed to fetch speed limits");
  }

  writeStdout(
    JSON.stringify(
      {
        download: Number(download.text),
        upload: Number(upload.text),
      },
      null,
      2,
    ),
  );
}

async function cmdSetSpeedlimit(args) {
  const options = parseKeyValueOptions(args, {
    "--down": { key: "down", type: "value" },
    "-d": { key: "down", type: "value" },
    "--up": { key: "up", type: "value" },
    "-u": { key: "up", type: "value" },
  });

  if (!options.down && !options.up) {
    fail("Usage: set-speedlimit [--down D] [--up U]");
  }

  if (options.down) {
    await apiCall("POST", "/api/v2/transfer/setDownloadLimit", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ limit: parseSpeed(options.down) }),
      expectJsonOk: false,
    });
  }

  if (options.up) {
    await apiCall("POST", "/api/v2/transfer/setUploadLimit", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ limit: parseSpeed(options.up) }),
      expectJsonOk: false,
    });
  }

  writeStdout(JSON.stringify({ status: "ok" }));
}

async function cmdToggleAltSpeed() {
  await apiCall("POST", "/api/v2/transfer/toggleSpeedLimitsMode", {
    expectJsonOk: true,
  });
}

async function cmdVersion() {
  await apiCall("GET", "/api/v2/app/version");
}

async function cmdPreferences() {
  await apiCall("GET", "/api/v2/app/preferences");
}

const commands = {
  list: cmdList,
  info: cmdInfo,
  files: cmdFiles,
  trackers: cmdTrackers,
  add: cmdAdd,
  "add-file": cmdAddFile,
  pause: cmdPause,
  resume: cmdResume,
  delete: cmdDelete,
  recheck: cmdRecheck,
  reannounce: cmdReannounce,
  "set-category": cmdSetCategory,
  "add-tags": cmdAddTags,
  "remove-tags": cmdRemoveTags,
  categories: cmdCategories,
  tags: cmdTags,
  transfer: cmdTransfer,
  speedlimit: cmdSpeedlimit,
  "set-speedlimit": cmdSetSpeedlimit,
  "toggle-alt-speed": cmdToggleAltSpeed,
  version: cmdVersion,
  preferences: cmdPreferences,
};

async function main() {
  const { command, args } = parseArgs(process.argv);

  if (
    !command ||
    command === "-h" ||
    command === "--help" ||
    command === "help"
  ) {
    usage();
    return;
  }

  const handler = commands[command];
  if (!handler) {
    fail(`Unknown command: ${command}`);
  }

  ensureConfig();
  await handler(args);
}

main().catch((error) => {
  if (error && error.code === "ENOENT" && error.path) {
    fail(`File not found: ${error.path}`);
  }

  fail(error && error.message ? error.message : String(error));
});
