const fs = require("fs");
const path = require("path");
const readline = require("readline");
const P = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore
} = require("@whiskeysockets/baileys");
const config = require("./config");
const { sanitizeNumber } = require("./lib/helper");

const startTime = Date.now();
const store = makeInMemoryStore({ logger: P({ level: "silent" }).child({ level: "silent" }) });

function loadPlugins() {
  const dir = path.join(__dirname, "plugins");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".js")) : [];
  return files.map(file => {
    const plugin = require(path.join(dir, file));
    return { file, ...plugin };
  });
}

const plugins = loadPlugins();

function getCommand(text) {
  if (!text) return null;
  const prefix = config.prefix || ".";
  if (!text.startsWith(prefix)) return null;
  const [cmd, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  return { cmd: (cmd || "").toLowerCase(), args };
}

async function askNumber() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise(resolve => rl.question(q, resolve));
  const input = await question("Masukkan nomor WhatsApp (contoh 62812xxxx): ");
  rl.close();
  return sanitizeNumber(input);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "session"));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["HEXZ-BOT-WA", "Chrome", "1.0.0"]
  });

  store.bind(sock.ev);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("QR diterima. Login via pairing code.");
    }

    if (connection === "open") {
      console.log("Bot aktif.");
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      console.log("Koneksi terputus:", reason, shouldReconnect ? "reconnect" : "logout");
      if (shouldReconnect) startBot();
    }
  });

  if (!state.creds.registered) {
    const number = await askNumber();
    if (!number) {
      console.log("Nomor tidak valid.");
      process.exit(1);
    }
    const code = await sock.requestPairingCode(number);
    console.log(`Pairing code untuk ${config.pairingLabel}:`, code.match(/.{1,4}/g)?.join("-") || code);
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.remoteJid === "status@broadcast") continue;
        if (msg.key.fromMe) continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          "";

        const parsed = getCommand(text);
        if (!parsed) continue;

        const { cmd, args } = parsed;
        const prefix = config.prefix || ".";
        const handler = plugins.find(p => Array.isArray(p.names) && p.names.includes(cmd));
        if (!handler) continue;

        await handler.run({
          sock,
          msg,
          args,
          text: args.join(" "),
          prefix,
          config,
          startTime
        });
      } catch (e) {
        console.error("Handler error:", e);
      }
    }
  });

  return sock;
}

process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection:", err);
});

startBot();