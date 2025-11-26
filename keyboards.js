// keyboards.js
const { Markup } = require("telegraf");
const { getCategoryNames } = require("./data");

// /start, menu utama
const mainMenuKeyboard = () =>
  Markup.keyboard([["🔐 List Token", "🤖 Daftar Bot"]])
    .resize()
    .oneTime(false);

// List Token (CRUD token dalam 1 grup)
const tokensMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Tambah", "🗑 Hapus"],
    ["✏️ Edit", "⬅️ Kembali"],
  ])
    .resize()
    .oneTime(false);

// Pilih cara tambah token (satuan / massal)
const tokensAddMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Satuan", "📥 Massal"],
    ["❌ Batal"],
  ])
    .resize()
    .oneTime(false);

// Daftar Bot – level kategori (CRUD kategori)
const botsCategoriesMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Tambah", "🗑 Hapus"],
    ["✏️ Edit", "⬅️ Kembali"],
  ])
    .resize()
    .oneTime(false);

// Daftar Bot – dalam 1 kategori (CRUD item)
const botItemsMenuKeyboard = () =>
  Markup.keyboard([
    ["➕ Tambah", "🗑 Hapus"],
    ["✏️ Edit", "⬅️ Kembali"],
  ])
    .resize()
    .oneTime(false);

// Keyboard khusus mode input (ada tombol Batal)
const cancelKeyboard = () =>
  Markup.keyboard([["❌ Batal"]]).resize().oneTime(false);

// Inline keyboard kategori bot (pin | haven | kitsu | ...)
const daftarBotInlineKeyboard = () => {
  const names = getCategoryNames();
  const rows = [];

  if (!names.length) {
    rows.push([
      Markup.button.callback("Belum ada kategori", "botcat:_none"),
    ]);
    return Markup.inlineKeyboard(rows);
  }

  for (let i = 0; i < names.length; i += 2) {
    const row = [];
    row.push(Markup.button.callback(names[i], `botcat:${names[i]}`));
    if (names[i + 1]) {
      row.push(Markup.button.callback(names[i + 1], `botcat:${names[i + 1]}`));
    }
    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
};

// Inline keyboard grup token (irwan | din)
const TOKEN_GROUPS = ["irwan", "din"];

const tokenGroupsInlineKeyboard = (currentGroup) => {
  const row = TOKEN_GROUPS.map((g) =>
    Markup.button.callback(
      g === currentGroup ? `▶ ${g}` : g,
      `tokengrp:${g}`
    )
  );
  return Markup.inlineKeyboard([row]);
};

module.exports = {
  mainMenuKeyboard,
  tokensMenuKeyboard,
  tokensAddMenuKeyboard,
  botsCategoriesMenuKeyboard,
  botItemsMenuKeyboard,
  cancelKeyboard,
  daftarBotInlineKeyboard,
  tokenGroupsInlineKeyboard,
};
