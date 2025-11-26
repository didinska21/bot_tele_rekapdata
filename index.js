// index.js
const { Telegraf } = require("telegraf");

const { BOT_TOKEN, isAdmin, adminErrorMessage, log } = require("./config");
const { TOKENS } = require("./data");
const { getState, setState, clearState } = require("./state");
const {
  mainMenuKeyboard,
  tokensMenuKeyboard,
  tokensAddMenuKeyboard,
  botsMenuKeyboard,
  daftarBotInlineKeyboard,
} = require("./keyboards");
const {
  buildListTokenText,
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

// ===== CALLBACK UNTUK INLINE (DAFTAR BOT) =====
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.update.callback_query.data;
  log("CBQ", { userId, data });

  // klik "Belum ada kategori"
  if (data === "botcat:_none") {
    return ctx.answerCbQuery("Belum ada kategori bot.").catch(() => {});
  }

  if (data.startsWith("botcat:")) {
    const category = data.split(":")[1];
    const msg = buildBotCategoryText(category);
    // edit pesan daftar bot supaya isinya jadi list kategori terpilih,
    // tapi inline keyboard kategori tetap muncul
    return ctx
      .editMessageText(msg, {
        parse_mode: "HTML",
        ...daftarBotInlineKeyboard(),
      })
      .catch(() => {});
  }

  await ctx.answerCbQuery().catch(() => {});
});

// ===== TEXT HANDLER =====
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = getState(userId);
  const mode = state.mode;

  log("MSG", { userId, mode, text });

  // ===== MENU UTAMA =====
  if (!mode) {
    if (text === "🔐 List Token") {
      setState(userId, { mode: "tokens_menu" });
      const msg = buildListTokenText();
      return ctx.replyWithHTML(msg, tokensMenuKeyboard());
    }
    if (text === "🤖 Daftar Bot") {
      setState(userId, { mode: "bots_menu" });
      // 1) kirim pesan dengan inline kategori bot
      await ctx.replyWithHTML(
        buildDaftarBotText(),
        daftarBotInlineKeyboard()
      );
      // 2) kirim pesan untuk set reply keyboard CRUD di bawah
      return ctx.reply("Pilih menu di bawah untuk kelola bot:", botsMenuKeyboard());
    }
  }

  // ==============
  // MENU LIST TOKEN
  // ==============
  if (mode === "tokens_menu") {
    if (text === "➕ Tambah") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "token_add_choice" });
      return ctx.replyWithHTML(
        "Pilih cara tambah data token:",
        tokensAddMenuKeyboard()
      );
    }

    if (text === "🗑 Hapus") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "deleting_token_select" });
      const msg =
        buildListTokenText() +
        "\n\n🗑 Kirim nomor token yang mau dihapus.\nContoh: <code>1</code>";
      return ctx.replyWithHTML(msg, { parse_mode: "HTML" });
    }

    if (text === "✏️ Edit") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "editing_token_select" });
      const msg =
        buildListTokenText() +
        "\n\n✏️ Kirim nomor token yang mau di-edit.\nContoh: <code>1</code>";
      return ctx.replyWithHTML(msg, { parse_mode: "HTML" });
    }

    if (text === "⬅️ Kembali") {
      clearState(userId);
      return ctx.replyWithHTML(
        "Kembali ke menu utama.",
        mainMenuKeyboard()
      );
    }
  }

  // ===== PILIH TAMBAH TOKEN (SATUAN/MASSAL) =====
  if (mode === "token_add_choice") {
    if (text === "➕ Satuan") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, {
        mode: "adding_token_single_email",
        tempToken: {},
      });
      return ctx.replyWithHTML(
        "📧 Silakan kirim email:\nContoh: <code>user@example.com</code>",
        { parse_mode: "HTML" }
      );
    }

    if (text === "📥 Massal") {
      if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));
      setState(userId, { mode: "adding_token_bulk" });
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
        { parse_mode: "HTML" }
      );
    }

    if (text === "⬅️ Batal") {
      setState(userId, { mode: "tokens_menu" });
      const msg = buildListTokenText();
      return ctx.replyWithHTML(msg, tokensMenuKeyboard());
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
        { parse_mode: "HTML" }
      );
    }

    setState(userId, {
      mode: "adding_token_single_token",
      tempToken: { email: text, token: "", username: "" },
    });

    return ctx.replyWithHTML(
      "🔑 Silakan kirim token:\nContoh: <code>123456:ABCDEF</code>",
      { parse_mode: "HTML" }
    );
  }

  if (mode === "adding_token_single_token") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    if (!isValidToken(text)) {
      return ctx.replyWithHTML(
        "❌ Format token tidak valid.\n" +
          "Token minimal 5 karakter dan tidak boleh ada spasi.\n" +
          "Coba kirim ulang token yang benar.",
        { parse_mode: "HTML" }
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
      { parse_mode: "HTML" }
    );
  }

  if (mode === "adding_token_single_username") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const temp = getState(userId).tempToken || {};
    let username = "";

    if (text.toLowerCase() === "skip") {
      username = "";
    } else {
      username = text.trim();
      if (!username) {
        return ctx.replyWithHTML(
          "❌ Username tidak valid.\n" +
            "Kirim username atau ketik <code>skip</code>.",
          { parse_mode: "HTML" }
        );
      }
    }

    temp.username = username;

    TOKENS.push({
      email: temp.email,
      token: temp.token,
      username: temp.username,
    });

    setState(userId, { mode: "tokens_menu" });

    const msg =
      "✅ Data baru berhasil ditambahkan.\n\n" + buildListTokenText();
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== TAMBAH MASSAL =====
  if (mode === "adding_token_bulk") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const { items, errors } = parseYamlishTokens(text);

    if (errors.length > 0) {
      return ctx.replyWithHTML(
        "❌ Terjadi kesalahan pada data massal:\n\n" +
          errors.map((e) => `- ${e}`).join("\n") +
          "\n\nPerbaiki dan kirim ulang.",
        { parse_mode: "HTML" }
      );
    }

    if (!items.length) {
      return ctx.replyWithHTML(
        "Tidak ada blok data yang terbaca.\nPastikan format sudah benar.",
        { parse_mode: "HTML" }
      );
    }

    items.forEach((obj) => {
      TOKENS.push({
        email: obj.email,
        token: obj.token,
        username: obj.username || "",
      });
    });

    setState(userId, { mode: "tokens_menu" });

    const msg =
      `✅ Berhasil menambahkan ${items.length} data token.\n\n` +
      buildListTokenText();
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== EDIT TOKEN PILIH NOMOR =====
  if (mode === "editing_token_select") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML" }
      );
    }
    if (num < 1 || num > TOKENS.length) {
      return ctx.replyWithHTML("Nomor di luar range.");
    }

    const item = TOKENS[num - 1];
    setState(userId, { mode: "editing_token_input", editIndex: num - 1 });

    return ctx.replyWithHTML(
      "Data saat ini:\n" +
        `username: ${item.username || "(kosong)"}\n` +
        `email: ${item.email || "(kosong)"}\n` +
        `token: <code>${item.token || "(kosong)"}</code>\n\n` +
        "Kirim data baru dengan format:\n" +
        "<code>email;token;[username optional]</code>",
      { parse_mode: "HTML" }
    );
  }

  // ===== EDIT TOKEN INPUT BARU =====
  if (mode === "editing_token_input") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const idx = getState(userId).editIndex;
    if (idx == null || idx >= TOKENS.length) {
      setState(userId, { mode: "tokens_menu" });
      return ctx.replyWithHTML("Index token tidak ditemukan.");
    }

    const parts = text.split(";").map((s) => s.trim());
    if (parts.length < 2) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>email;token;[username]</code>",
        { parse_mode: "HTML" }
      );
    }

    const email = parts[0];
    const token = parts[1];
    const username = parts[2] || "";

    if (!isValidEmail(email)) {
      return ctx.replyWithHTML(
        "❌ Email tidak valid.\nGunakan format: <code>nama@domain.com</code>",
        { parse_mode: "HTML" }
      );
    }
    if (!isValidToken(token)) {
      return ctx.replyWithHTML(
        "❌ Token tidak valid.\nMinimal 5 karakter dan tidak boleh spasi.",
        { parse_mode: "HTML" }
      );
    }

    TOKENS[idx] = { email, token, username };
    setState(userId, { mode: "tokens_menu" });

    const msg = "✅ Token berhasil di-update.\n\n" + buildListTokenText();
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== HAPUS TOKEN =====
  if (mode === "deleting_token_select") {
    if (!isAdmin(userId)) return ctx.replyWithHTML(adminErrorMessage(userId));

    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML" }
      );
    }
    if (num < 1 || num > TOKENS.length) {
      return ctx.replyWithHTML("Nomor di luar range.");
    }

    const deleted = TOKENS.splice(num - 1, 1)[0];
    setState(userId, { mode: "tokens_menu" });

    const msg =
      "✅ Token berikut telah dihapus:\n" +
      `email: ${deleted.email}\n` +
      `token: <code>${deleted.token}</code>\n\n` +
      buildListTokenText();
    return ctx.replyWithHTML(msg, tokensMenuKeyboard());
  }

  // ===== MENU DAFTAR BOT (CRUD – sementara placeholder logika) =====
  if (mode === "bots_menu") {
    if (text === "➕ Tambah") {
      // nanti bisa dikembangin (tambah kategori / tambah bot)
      return ctx.replyWithHTML(
        "Fitur tambah di Daftar Bot belum diimplementasi penuh.\n" +
          "Sekarang baru tampilan kategori & list per kategori.",
        botsMenuKeyboard()
      );
    }

    if (text === "🗑 Hapus") {
      return ctx.replyWithHTML(
        "Fitur hapus di Daftar Bot belum diimplementasi penuh.\n" +
          "Bisa kamu tambahkan sendiri di index.js (mode 'bots_menu').",
        botsMenuKeyboard()
      );
    }

    if (text === "✏️ Edit") {
      return ctx.replyWithHTML(
        "Fitur edit di Daftar Bot belum diimplementasi penuh.\n" +
          "Nanti bisa diatur untuk rename kategori / edit bot per kategori.",
        botsMenuKeyboard()
      );
    }

    if (text === "⬅️ Kembali") {
      clearState(userId);
      return ctx.replyWithHTML(
        "Kembali ke menu utama.",
        mainMenuKeyboard()
      );
    }
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
