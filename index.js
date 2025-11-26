// index.js
const { Telegraf } = require("telegraf");

const { BOT_TOKEN, isAdmin, adminErrorMessage, log } = require("./config");
const {
  TOKENS,
  addToken,
  updateToken,
  deleteToken,
  getCategoryNames,
  getCategoryNameByIndex,
  addCategory,
  renameCategory,
  deleteCategory,
  addBotItem,
  updateBotItem,
  deleteBotItem,
} = require("./data");
const { getState, setState, clearState } = require("./state");
const {
  mainMenuKeyboard,
  tokensMenuKeyboard,
  tokensAddMenuKeyboard,
  botsCategoriesMenuKeyboard,
  botItemsMenuKeyboard,
  cancelKeyboard,
  daftarBotInlineKeyboard,
  tokenGroupsInlineKeyboard,
} = require("./keyboards");
const {
  buildListTokenTextByGroup,
  buildDaftarBotText,
  buildBotCategoryText,
} = require("./textBuilders");

// ===== VALIDASI =====
const isValidEmail = (email) => {
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(email);
};

const isValidToken = (token) => {
  if (!token) return false;
  if (token.length < 5) return false;
  if (/\s/.test(token)) return false;
  return true;
};

// YAML-ish parser (massal)
const parseYamlishTokens = (text) => {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed === "---") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else if (trimmed !== "") {
      current.push(trimmed);
    }
  }
  if (current.length > 0) blocks.push(current);

  const items = [];
  const errors = [];

  blocks.forEach((blockLines, idx) => {
    const obj = { email: "", token: "", username: "" };

    blockLines.forEach((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) return;
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      if (key === "email") obj.email = value;
      if (key === "token") obj.token = value;
      if (key === "username") obj.username = value;
    });

    const blockNum = idx + 1;
    if (!obj.email || !isValidEmail(obj.email)) {
      errors.push(`Blok #${blockNum}: email tidak valid.`);
      return;
    }
    if (!obj.token || !isValidToken(obj.token)) {
      errors.push(`Blok #${blockNum}: token tidak valid.`);
      return;
    }
    items.push(obj);
  });

  return { items, errors };
};

const bot = new Telegraf(BOT_TOKEN);
const CANCEL_TEXT = "❌ Batal";

// ===== /start =====
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  clearState(userId);
  log("START from", userId);

  await ctx.replyWithHTML(
    "🤖 <b>Selamat datang.</b>\nSilakan pilih menu di bawah.",
    mainMenuKeyboard()
  );
});

// ===== CALLBACK (inline kategori bot + grup token) =====
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.update.callback_query.data;
  log("CBQ", { userId, data });

  // token group: irwan / din
  if (data.startsWith("tokengrp:")) {
    const group = data.split(":")[1] || "irwan";
    const state = getState(userId);
    setState(userId, { ...state, mode: "tokens_menu", currentTokenGroup: group });

    return ctx
      .editMessageText(buildListTokenTextByGroup(group), {
        parse_mode: "HTML",
        ...tokenGroupsInlineKeyboard(group),
      })
      .catch(() => {});
  }

  if (data === "botcat:_none") {
    return ctx.answerCbQuery("Belum ada kategori bot.").catch(() => {});
  }

  // kategori bot
  if (data.startsWith("botcat:")) {
    const category = data.split(":")[1];

    setState(userId, {
      mode: "bot_category_menu",
      currentCategory: category,
    });

    await ctx
      .editMessageText(buildBotCategoryText(category), {
        parse_mode: "HTML",
        ...daftarBotInlineKeyboard(),
      })
      .catch(() => {});

    return ctx.reply(
      `Sedang mengelola kategori: ${category}\nPakai menu di bawah untuk tambah / edit / hapus bot.`,
      botItemsMenuKeyboard()
    );
  }

  await ctx.answerCbQuery().catch(() => {});
});

// ===== TEXT HANDLER =====
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  let state = getState(userId);
  let mode = state.mode;

  log("MSG", { userId, mode, text });

  // ===== GLOBAL BATAL =====
  if (text === CANCEL_TEXT) {
    // baca ulang state ter-update
    state = getState(userId);
    mode = state.mode;

    // mode-mode token
    const tokenModes = [
      "adding_token_single_email",
      "adding_token_single_token",
      "adding_token_single_username",
      "adding_token_bulk",
      "editing_token_select",
      "editing_token_input",
      "deleting_token_select",
      "token_add_choice",
    ];
    if (tokenModes.includes(mode)) {
      const group = state.currentTokenGroup || "irwan";
      setState(userId, { mode: "tokens_menu", currentTokenGroup: group });
      const msg =
        "Dibatalkan.\n\n" + buildListTokenTextByGroup(group);
      return ctx.replyWithHTML(msg, tokensMenuKeyboard());
    }

    // mode kategori bot
    const catModes = [
      "bot_cat_add_name",
      "bot_cat_edit_input",
      "bot_cat_delete_select",
    ];
    if (catModes.includes(mode)) {
      setState(userId, { mode: "bots_menu", currentCategory: null });
      await ctx.replyWithHTML(
        buildDaftarBotText(),
        daftarBotInlineKeyboard()
      );
      return ctx.reply(
        "Dibatalkan. Kelola kategori bot dengan menu di bawah:",
        botsCategoriesMenuKeyboard()
      );
    }

    // mode item bot
    const itemModes = ["bot_item_add", "bot_item_edit", "bot_item_delete"];
    if (itemModes.includes(mode)) {
      const category = state.currentCategory;
      if (category) {
        setState(userId, {
          mode: "bot_category_menu",
          currentCategory: category,
        });
        const msg =
          "Dibatalkan.\n\n" + buildBotCategoryText(category);
        return ctx.replyWithHTML(msg, botItemsMenuKeyboard());
      }
    }

    // fallback: ke menu utama
    clearState(userId);
    return ctx.replyWithHTML(
      "Dibatalkan. Kembali ke menu utama.",
      mainMenuKeyboard()
    );
  }

  // ===== MENU UTAMA =====
  if (!mode) {
    if (text === "🔐 List Token") {
      const group = "irwan";
      setState(userId, { mode: "tokens_menu", currentTokenGroup: group });

      await ctx.replyWithHTML(
        buildListTokenTextByGroup(group),
        tokenGroupsInlineKeyboard(group)
      );
      return ctx.reply(
        "Kelola token grup ini dengan menu di bawah:",
        tokensMenuKeyboard()
      );
    }

    if (text === "🤖 Daftar Bot") {
      setState(userId, { mode: "bots_menu", currentCategory: null });
      await ctx.replyWithHTML(
        buildDaftarBotText(),
        daftarBotInlineKeyboard()
      );
      return ctx.reply(
        "Kelola kategori bot dengan menu di bawah:",
        botsCategoriesMenuKeyboard()
      );
    }
  }

  // =========================
  // MENU LIST TOKEN (per grup)
  // =========================
  if (mode === "tokens_menu") {
    const group = state.currentTokenGroup || "irwan";

    if (text === "➕ Tambah") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, {
        mode: "token_add_choice",
        currentTokenGroup: group,
      });
      return ctx.replyWithHTML(
        "Pilih cara tambah data token:",
        tokensAddMenuKeyboard()
      );
    }

    if (text === "🗑 Hapus") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, {
        mode: "deleting_token_select",
        currentTokenGroup: group,
      });
      const msg =
        buildListTokenTextByGroup(group) +
        "\n\n🗑 Kirim nomor token yang mau dihapus.\nContoh: <code>1</code>";
      return ctx.replyWithHTML(msg, {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (text === "✏️ Edit") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, {
        mode: "editing_token_select",
        currentTokenGroup: group,
      });
      const msg =
        buildListTokenTextByGroup(group) +
        "\n\n✏️ Kirim nomor token yang mau di-edit.\nContoh: <code>1</code>";
      return ctx.replyWithHTML(msg, {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (text === "⬅️ Kembali") {
      clearState(userId);
      return ctx.replyWithHTML("Kembali ke menu utama.", mainMenuKeyboard());
    }
  }

  // ===== PILIH TAMBAH TOKEN (SATUAN/MASSAL) =====
  if (mode === "token_add_choice") {
    const group = state.currentTokenGroup || "irwan";

    if (text === "➕ Satuan") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, {
        mode: "adding_token_single_email",
        currentTokenGroup: group,
        tempToken: {},
      });
      return ctx.replyWithHTML(
        "📧 Silakan kirim email:\nContoh: <code>user@example.com</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    if (text === "📥 Massal") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, {
        mode: "adding_token_bulk",
        currentTokenGroup: group,
      });
      return ctx.replyWithHTML(
        "📥 <b>Tambah Data Massal (YAML-ish)</b>\n\n" +
          "Kirim data dengan format per-blok, dipisah dengan <code>---</code>:\n\n" +
          "email: user1@example.com\n" +
          "token: 123456:AAA\n" +
          "username: @user1\n" +
          "---\n" +
          "email: user2@example.com\n" +
          "token: 999999:BBB\n" +
          "username:\n",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
  }

  // ===== WIZARD TAMBAH TOKEN SATUAN =====
  if (mode === "adding_token_single_email") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    if (!isValidEmail(text)) {
      return ctx.replyWithHTML(
        "❌ Format email tidak valid.\n" +
          "Gunakan format: <code>nama@domain.com</code>\n" +
          "Coba kirim lagi.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    setState(userId, {
      mode: "adding_token_single_token",
      tempToken: { email: text, token: "", username: "" },
    });

    return ctx.replyWithHTML(
      "🔑 Silakan kirim token:\nContoh: <code>123456:ABCDEF</code>",
      { parse_mode: "HTML", ...cancelKeyboard() }
    );
  }

  if (mode === "adding_token_single_token") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    if (!isValidToken(text)) {
      return ctx.replyWithHTML(
        "❌ Format token tidak valid.\n" +
          "Token minimal 5 karakter dan tidak boleh ada spasi.\n" +
          "Coba kirim ulang token yang benar.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    const temp = getState(userId).tempToken || {};
    temp.token = text;

    setState(userId, {
      mode: "adding_token_single_username",
      tempToken: temp,
    });

    return ctx.replyWithHTML(
      "👤 Kirim username (opsional).\n\n" +
        "Jika tidak ingin mengisi, ketik: <code>skip</code>",
      { parse_mode: "HTML", ...cancelKeyboard() }
    );
  }

  if (mode === "adding_token_single_username") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const temp = getState(userId).tempToken || {};
    const group = state.currentTokenGroup || "irwan";
    let username = "";

    if (text.toLowerCase() === "skip") {
      username = "";
    } else {
      username = text.trim();
      if (!username) {
        return ctx.replyWithHTML(
          "❌ Username tidak valid.\n" +
            "Kirim username atau ketik <code>skip</code>.",
          { parse_mode: "HTML", ...cancelKeyboard() }
        );
      }
    }

    temp.username = username;

    addToken({
      email: temp.email,
      token: temp.token,
      username: temp.username,
      group,
    });

    setState(userId, { mode: "tokens_menu", currentTokenGroup: group });

    const msg =
      "✅ Data baru berhasil ditambahkan.\n\n" +
      buildListTokenTextByGroup(group);
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== TAMBAH MASSAL =====
  if (mode === "adding_token_bulk") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const group = state.currentTokenGroup || "irwan";
    const { items, errors } = parseYamlishTokens(text);

    if (errors.length > 0) {
      return ctx.replyWithHTML(
        "❌ Terjadi kesalahan pada data massal:\n\n" +
          errors.map((e) => `- ${e}`).join("\n") +
          "\n\nPerbaiki dan kirim ulang.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    if (!items.length) {
      return ctx.replyWithHTML(
        "Tidak ada blok data yang terbaca.\nPastikan format sudah benar.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    items.forEach((obj) => {
      addToken({
        email: obj.email,
        token: obj.token,
        username: obj.username || "",
        group,
      });
    });

    setState(userId, { mode: "tokens_menu", currentTokenGroup: group });

    const msg =
      `✅ Berhasil menambahkan ${items.length} data token.\n\n` +
      buildListTokenTextByGroup(group);
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== EDIT TOKEN PILIH NOMOR (per grup) =====
  if (mode === "editing_token_select") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const group = state.currentTokenGroup || "irwan";
    const list = require("./data").getTokensByGroup(group);

    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
    if (num < 1 || num > list.length) {
      return ctx.replyWithHTML("Nomor di luar range.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    const { index, token } = list[num - 1];
    setState(userId, {
      mode: "editing_token_input",
      editTokenIndex: index,
      currentTokenGroup: group,
    });

    return ctx.replyWithHTML(
      "Data saat ini:\n" +
        `username: ${token.username || "(kosong)"}\n` +
        `email: ${token.email || "(kosong)"}\n` +
        `token: <code>${token.token || "(kosong)"}</code>\n\n` +
        "Kirim data baru dengan format:\n" +
        "<code>email;token;[username optional]</code>",
      { parse_mode: "HTML", ...cancelKeyboard() }
    );
  }

  // ===== EDIT TOKEN INPUT BARU =====
  if (mode === "editing_token_input") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const group = state.currentTokenGroup || "irwan";
    const idx = state.editTokenIndex;
    if (idx == null || idx >= TOKENS.length) {
      setState(userId, { mode: "tokens_menu", currentTokenGroup: group });
      return ctx.replyWithHTML("Index token tidak ditemukan.", tokensMenuKeyboard());
    }

    const parts = text.split(";").map((s) => s.trim());
    if (parts.length < 2) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>email;token;[username]</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    const email = parts[0];
    const tokenStr = parts[1];
    const username = parts[2] || "";
    if (!isValidEmail(email)) {
      return ctx.replyWithHTML(
        "❌ Email tidak valid.\nGunakan format: <code>nama@domain.com</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
    if (!isValidToken(tokenStr)) {
      return ctx.replyWithHTML(
        "❌ Token tidak valid.\nMinimal 5 karakter dan tidak boleh spasi.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    const old = TOKENS[idx] || {};
    const tokenGroup = old.group || group;

    updateToken(idx, {
      email,
      token: tokenStr,
      username,
      group: tokenGroup,
    });

    setState(userId, { mode: "tokens_menu", currentTokenGroup: tokenGroup });

    const msg =
      "✅ Token berhasil di-update.\n\n" +
      buildListTokenTextByGroup(tokenGroup);
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== HAPUS TOKEN =====
  if (mode === "deleting_token_select") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const group = state.currentTokenGroup || "irwan";
    const list = require("./data").getTokensByGroup(group);

    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
    if (num < 1 || num > list.length) {
      return ctx.replyWithHTML("Nomor di luar range.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    const { index, token } = list[num - 1];
    deleteToken(index);

    setState(userId, { mode: "tokens_menu", currentTokenGroup: group });

    const msg =
      "✅ Token berikut telah dihapus:\n" +
      `email: ${token.email}\n` +
      `token: <code>${token.token}</code>\n\n` +
      buildListTokenTextByGroup(group);
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // =========================
  // MENU DAFTAR BOT – LEVEL KATEGORI
  // =========================
  if (mode === "bots_menu") {
    if (text === "➕ Tambah") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "bot_cat_add_name" });
      return ctx.replyWithHTML(
        "Kirim nama kategori bot baru.\nContoh: <code>pin</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    if (text === "✏️ Edit") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      const names = getCategoryNames();
      if (!names.length) {
        return ctx.replyWithHTML("Belum ada kategori bot.");
      }
      setState(userId, { mode: "bot_cat_edit_input" });
      const lines = ["Daftar kategori:"];
      names.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push(
        "",
        "Kirim format: <code>nomor;nama_baru</code>",
        "Contoh: <code>1;pin-baru</code>"
      );
      return ctx.replyWithHTML(lines.join("\n"), {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (text === "🗑 Hapus") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      const names = getCategoryNames();
      if (!names.length) {
        return ctx.replyWithHTML("Belum ada kategori bot.");
      }
      setState(userId, { mode: "bot_cat_delete_select" });
      const lines = ["Pilih nomor kategori yang mau dihapus:"];
      names.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push("Kirim angka, contoh: <code>1</code>");
      return ctx.replyWithHTML(lines.join("\n"), {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (text === "⬅️ Kembali") {
      clearState(userId);
      return ctx.replyWithHTML("Kembali ke menu utama.", mainMenuKeyboard());
    }
  }

  // ===== TAMBAH KATEGORI BOT =====
  if (mode === "bot_cat_add_name") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
    const name = text.trim();
    if (!name) {
      return ctx.replyWithHTML("Nama kategori tidak boleh kosong.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }
    if (!addCategory(name)) {
      return ctx.replyWithHTML("Nama kategori sudah ada.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    setState(userId, { mode: "bots_menu", currentCategory: null });
    await ctx.replyWithHTML(
      "✅ Kategori bot baru ditambahkan.\n\n" + buildDaftarBotText(),
      daftarBotInlineKeyboard()
    );
    return ctx.reply(
      "Kelola kategori bot dengan menu di bawah:",
      botsCategoriesMenuKeyboard()
    );
  }

  // ===== EDIT KATEGORI BOT =====
  if (mode === "bot_cat_edit_input") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const parts = text.split(";").map((s) => s.trim());
    if (parts.length !== 2) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>nomor;nama_baru</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
    const num = Number(parts[0]);
    const newName = parts[1];
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }
    const oldName = getCategoryNameByIndex(num - 1);
    if (!oldName) {
      return ctx.replyWithHTML("Nomor kategori tidak ditemukan.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (!renameCategory(oldName, newName)) {
      return ctx.replyWithHTML(
        "Gagal rename kategori. Mungkin nama baru sudah dipakai.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    setState(userId, { mode: "bots_menu", currentCategory: null });
    await ctx.replyWithHTML(
      `✅ Kategori '${oldName}' di-rename menjadi '${newName}'.\n\n` +
        buildDaftarBotText(),
      daftarBotInlineKeyboard()
    );
    return ctx.reply(
      "Kelola kategori bot dengan menu di bawah:",
      botsCategoriesMenuKeyboard()
    );
  }

  // ===== HAPUS KATEGORI BOT =====
  if (mode === "bot_cat_delete_select") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }
    const name = getCategoryNameByIndex(num - 1);
    if (!name) {
      return ctx.replyWithHTML("Nomor kategori tidak ditemukan.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    deleteCategory(name);

    setState(userId, { mode: "bots_menu", currentCategory: null });
    await ctx.replyWithHTML(
      `✅ Kategori '${name}' telah dihapus.\n\n` + buildDaftarBotText(),
      daftarBotInlineKeyboard()
    );
    return ctx.reply(
      "Kelola kategori bot dengan menu di bawah:",
      botsCategoriesMenuKeyboard()
    );
  }

  // =========================
  // MENU DI DALAM KATEGORI BOT (CRUD item)
  // =========================
  if (mode === "bot_category_menu") {
    const category = state.currentCategory;

    if (text === "➕ Tambah") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "bot_item_add", currentCategory: category });
      return ctx.replyWithHTML(
        `Tambah bot di kategori <b>${category}</b>.\n` +
          "Kirim data dengan format:\n" +
          "<code>lokasi_vps;token;[username optional]</code>\n\n" +
          "Contoh:\n" +
          "<code>SG-1;123456:ABCDEF;@botakun</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    if (text === "✏️ Edit") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "bot_item_edit", currentCategory: category });
      const msg =
        buildBotCategoryText(category) +
        "\n\n✏️ Kirim format:\n" +
        "<code>nomor;lokasi_vps;token;[username optional]</code>\n" +
        "Contoh:\n" +
        "<code>1;SG-2;999999:NEWTOKEN;@usernamebaru</code>";
      return ctx.replyWithHTML(msg, {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (text === "🗑 Hapus") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "bot_item_delete", currentCategory: category });
      const msg =
        buildBotCategoryText(category) +
        "\n\n🗑 Kirim nomor bot yang mau dihapus.\n" +
        "Contoh: <code>1</code>";
      return ctx.replyWithHTML(msg, {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    if (text === "⬅️ Kembali") {
      setState(userId, { mode: "bots_menu", currentCategory: null });
      await ctx.replyWithHTML(
        buildDaftarBotText(),
        daftarBotInlineKeyboard()
      );
      return ctx.reply(
        "Kelola kategori bot dengan menu di bawah:",
        botsCategoriesMenuKeyboard()
      );
    }
  }

  // ===== TAMBAH ITEM BOT =====
  if (mode === "bot_item_add") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
    const category = state.currentCategory;
    const parts = text.split(";").map((s) => s.trim());
    if (parts.length < 2) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>lokasi_vps;token;[username]</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
    const lokasi_vps = parts[0];
    const tokenStr = parts[1];
    const username = parts[2] || "";

    if (!isValidToken(tokenStr)) {
      return ctx.replyWithHTML(
        "❌ Token tidak valid.\nMinimal 5 karakter dan tidak boleh spasi.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    addBotItem(category, { lokasi_vps, username, token: tokenStr });

    setState(userId, {
      mode: "bot_category_menu",
      currentCategory: category,
    });

    const msg =
      `✅ Bot baru ditambahkan di kategori ${category}.\n\n` +
      buildBotCategoryText(category);
    return ctx.replyWithHTML(msg, botItemsMenuKeyboard());
  }

  // ===== EDIT ITEM BOT =====
  if (mode === "bot_item_edit") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
    const category = state.currentCategory;
    const parts = text.split(";").map((s) => s.trim());
    if (parts.length < 3) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>nomor;lokasi_vps;token;[username]</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }
    const num = Number(parts[0]);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }
    const lokasi_vps = parts[1];
    const tokenStr = parts[2];
    const username = parts[3] || "";
    if (!isValidToken(tokenStr)) {
      return ctx.replyWithHTML(
        "❌ Token tidak valid.\nMinimal 5 karakter dan tidak boleh spasi.",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    if (!updateBotItem(category, num - 1, { lokasi_vps, username, token: tokenStr })) {
      return ctx.replyWithHTML("Index bot tidak ditemukan.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    setState(userId, {
      mode: "bot_category_menu",
      currentCategory: category,
    });

    const msg =
      "✅ Data bot berhasil di-update.\n\n" +
      buildBotCategoryText(category);
    return ctx.replyWithHTML(msg, botItemsMenuKeyboard());
  }

  // ===== HAPUS ITEM BOT =====
  if (mode === "bot_item_delete") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
    const category = state.currentCategory;
    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML", ...cancelKeyboard() }
      );
    }

    if (!deleteBotItem(category, num - 1)) {
      return ctx.replyWithHTML("Index bot tidak ditemukan.", {
        parse_mode: "HTML",
        ...cancelKeyboard(),
      });
    }

    setState(userId, {
      mode: "bot_category_menu",
      currentCategory: category,
    });

    const msg =
      "✅ Bot berhasil dihapus.\n\n" + buildBotCategoryText(category);
    return ctx.replyWithHTML(msg, botItemsMenuKeyboard());
  }

  // ===== DEFAULT =====
  return ctx.replyWithHTML(
    "Kalau mau mulai lagi, kirim /start lalu pilih menu di bawah.",
    mainMenuKeyboard()
  );
});

// ===== LOG ERROR GLOBAL =====
bot.catch((err, ctx) => {
  log("BOT ERROR", err.message, "ctx:", ctx.updateType);
});

process.on("unhandledRejection", (reason) => {
  log("UNHANDLED_REJECTION", reason);
});
process.on("uncaughtException", (err) => {
  log("UNCAUGHT_EXCEPTION", err);
});

// ===== RUN =====
bot.launch().then(() => {
  log("Bot sudah jalan 🚀");
});

process.once("SIGINT", () => {
  log("SIGINT diterima, stop bot");
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  log("SIGTERM diterima, stop bot");
  bot.stop("SIGTERM");
});
