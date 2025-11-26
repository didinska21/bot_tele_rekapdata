// keyboards.js
const { Markup } = require("telegraf");

// /start, menu utama
const mainMenuKeyboard = () =>
  Markup.keyboard([["🔐 List Token", "🤖 Daftar Bot"]])
    .resize()
    .oneTime(false);

// ketika berada di menu List Token
const tokensMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Tambah", "🗑 Hapus"],
    ["✏️ Edit", "⬅️ Kembali"],
  ])
    .resize()
    .oneTime(false);

// ketika pilih Tambah → user disuruh pilih Satuan / Massal
const tokensAddMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Satuan", "📥 Massal"],
    ["⬅️ Batal"],
  ])
    .resize()
    .oneTime(false);

// Daftar Bot (versi simple dulu)
const botsMenuKeyboard = () =>
  Markup.keyboard([
    ["📂 Lihat Bot", "➕ Tambah Bot"],
    ["🗑 Hapus Bot", "⬅️ Kembali"],
  ])
    .resize()
    .oneTime(false);

module.exports = {
  mainMenuKeyboard,
  tokensMenuKeyboard,
  tokensAddMenuKeyboard,
  botsMenuKeyboard,
};
