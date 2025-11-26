// config.js
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN belum di-set di .env");
}

// parse ADMIN_IDS jadi Set<number>
const ADMIN_IDS = new Set();
if (process.env.ADMIN_IDS) {
  process.env.ADMIN_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((id) => {
      const num = Number(id);
      if (!Number.isNaN(num)) ADMIN_IDS.add(num);
    });
}

const isAdmin = (userId) => ADMIN_IDS.has(userId);

const adminErrorMessage = (userId) =>
  "❌ Kamu belum terdaftar sebagai admin.\n" +
  `user_id kamu: <code>${userId}</code>\n` +
  "Minta owner bot untuk menambahkan ID ini ke ADMIN_IDS di file .env";

const log = (...args) => {
  const ts = new Date().toISOString();
  console.log(ts, "-", ...args);
};

module.exports = {
  BOT_TOKEN,
  isAdmin,
  adminErrorMessage,
  log,
};
