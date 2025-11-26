// keyboards.js
const { Markup } = require("telegraf");
const { BOTS } = require("./data");

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

// ketika pilih Tambah Token → pilih Satuan / Massal
const tokensAddMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Satuan", "📥 Massal"],
    ["⬅️ Batal"],
  ])
    .resize()
    .oneTime(false);

// MENU DAFTAR BOT: reply keyboard di bawah (CRUD)
const botsMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Tambah", "🗑 Hapus"],
    ["✏️ Edit", "⬅️ Kembali"],
  ])
    .resize()
    .oneTime(false);

// inline keyboard kategori bot (pin | haven | dll)
const daftarBotInlineKeyboard = () => {
  const names = Object.keys(BOTS);
  const rows = [];

  // 2 tombol per baris
  for (let i = 0; i < names.length; i += 2) {
    const row = [];
    row.push(Markup.button.callback(names[i], `botcat:${names[i]}`));
    if (names[i + 1]) {
      row.push(Markup.button.callback(names[i + 1], `botcat:${names[i + 1]}`));
    }
    rows.push(row);
  }

  if (!rows.length) {
    // kalau belum ada kategori, tetap kirim 1 tombol dummy
    rows.push([Markup.button.callback("Belum ada kategori", "botcat:_none")]);
  }

  return Markup.inlineKeyboard(rows);
};

module.exports = {
  mainMenuKeyboard,
  tokensMenuKeyboard,
  tokensAddMenuKeyboard,
  botsMenuKeyboard,
  daftarBotInlineKeyboard,
};
