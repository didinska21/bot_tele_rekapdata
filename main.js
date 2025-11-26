require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

// ===== LOAD ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN belum di-set di .env");
}

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

// ===== DATA SEMENTARA (in-memory) =====
// Nanti kalau mau bisa kamu ganti ke DB / file / Google Sheets
let TOKENS = [
  { username: "", email: "user1@example.com", token: "123456:ABCDEF" },
  { username: "@budi", email: "budi@example.com", token: "987654:ZYXWVU" },
];

let BOTS = {
  pin: [
    { lokasi_vps: "SG-1", username: "", token: "111111:PINPIN" },
    { lokasi_vps: "ID-2", username: "@botpinid", token: "222222:PINPIN" },
  ],
  haven: [],
  june: [],
};

// ===== STATE PER USER =====
const userStates = new Map(); // key: userId, value: { mode, editIndex, botCategory, tempToken }

// helper get/set state
const getState = (userId) => userStates.get(userId) || {};
const setState = (userId, newState) =>
  userStates.set(userId, { ...getState(userId), ...newState });
const clearState = (userId) => userStates.delete(userId);

// ===== VALIDASI & PARSER =====
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

// YAML-ish parser untuk data massal token
// Format block:
// email: user@example.com
// token: 123456:AAA
// username: @user
// --- (pemisah block)
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
    } else {
      if (trimmed !== "") current.push(trimmed);
    }
  }
  if (current.length > 0) {
    blocks.push(current);
  }

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
      errors.push(`Baris blok #${blockNum}: email tidak valid.`);
      return;
    }
    if (!obj.token || !isValidToken(obj.token)) {
      errors.push(`Baris blok #${blockNum}: token tidak valid.`);
      return;
    }
    // username boleh kosong

    items.push(obj);
  });

  return { items, errors };
};

// ===== KEYBOARD / BUTTONS =====
const mainMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("List Token", "menu:list_token")],
    [Markup.button.callback("Daftar Bot", "menu:daftar_bot")],
  ]);

const listTokenKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback("Tambah", "token:add_menu"),
      Markup.button.callback("Edit", "token:edit"),
    ],
    [
      Markup.button.callback("Hapus", "token:delete"),
      Markup.button.callback("Kembali", "menu:main"),
    ],
  ]);

const tokenAddMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("Tambah Data Satuan", "token:add_single")],
    [Markup.button.callback("Tambah Data Massal", "token:add_bulk")],
    [Markup.button.callback("Kembali", "token:add_back")],
  ]);

const daftarBotKeyboard = () => {
  const rows = [];

  Object.keys(BOTS).forEach((name) => {
    rows.push([Markup.button.callback(name, `botcat:open:${name}`)]);
  });

  rows.push([
    Markup.button.callback("Tambah", "botcat:add"),
    Markup.button.callback("Edit", "botcat:edit"),
  ]);

  rows.push([
    Markup.button.callback("Hapus", "botcat:delete"),
    Markup.button.callback("Kembali", "menu:main"),
  ]);

  return Markup.inlineKeyboard(rows);
};

const listBotCategoryKeyboard = (category) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback("Tambah", `botitem:${category}:add`),
      Markup.button.callback("Edit", `botitem:${category}:edit`),
    ],
    [
      Markup.button.callback("Hapus", `botitem:${category}:delete`),
      Markup.button.callback("Kembali", "menu:daftar_bot"),
    ],
  ]);

// ===== TEXT BUILDERS =====
const buildListTokenText = () => {
  if (!TOKENS.length) {
    return "🔐 <b>List Token</b>\n\nBelum ada data token.";
  }
  const lines = ["🔐 <b>List Token</b>\n"];
  TOKENS.forEach((item, i) => {
    const username = item.username || "(kosong)";
    const email = item.email || "(kosong)";
    const token = item.token || "(kosong)";
    lines.push(
      `${i + 1}. \n` +
        `username: ${username}\n` +
        `email: ${email}\n` +
        `token: <code>${token}</code>\n`
    );
  });
  return lines.join("\n");
};

const buildDaftarBotText = () => {
  const names = Object.keys(BOTS);
  if (!names.length) {
    return "🤖 <b>Daftar Bot</b>\n\nBelum ada kategori bot.";
  }
  const lines = ["🤖 <b>Daftar Bot</b>\n"];
  names.forEach((name, i) => {
    lines.push(`${i + 1}. ${name}`);
  });
  lines.push("\nKlik nama di tombol bawah untuk membuka kategori.");
  return lines.join("\n");
};

const buildListBotCategoryText = (category) => {
  const data = BOTS[category] || [];
  if (!data.length) {
    return `🤖 <b>List Bot ${category}</b>\n\nBelum ada data bot.`;
  }
  const lines = [`🤖 <b>List Bot ${category}</b>\n`];
  data.forEach((item, i) => {
    const lokasi = item.lokasi_vps || "(kosong)";
    const username = item.username || "(kosong)";
    const token = item.token || "(kosong)";
    lines.push(
      `${i + 1}. \n` +
        `lokasi vps: ${lokasi}\n` +
        `username: ${username}\n` +
        `token: <code>${token}</code>\n`
    );
  });
  return lines.join("\n");
};

// ===== START BOT =====
const bot = new Telegraf(BOT_TOKEN);

// /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  clearState(userId);

  await ctx.replyWithHTML(
    "🧩 <b>Menu Utama</b>\nSilakan pilih menu:",
    mainMenuKeyboard()
  );

  // bantu info user id untuk set admin di .env
  await ctx.replyWithHTML(
    `user_id kamu: <code>${userId}</code>\n` +
      "(tambahkan ke ADMIN_IDS di .env jika mau jadi admin)"
  );
});

// ===== CALLBACK QUERY HANDLER =====
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.update.callback_query.data;
  await ctx.answerCbQuery().catch(() => {});

  // MENU UTAMA
  if (data === "menu:main") {
    clearState(userId);
    return ctx
      .editMessageText("🧩 <b>Menu Utama</b>\nSilakan pilih menu:", {
        parse_mode: "HTML",
        ...mainMenuKeyboard(),
      })
      .catch(() => {});
  }

  // ===== LIST TOKEN =====
  if (data === "menu:list_token") {
    clearState(userId);
    const text = buildListTokenText();
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...listTokenKeyboard(),
      })
      .catch(() => {});
  }

  // Submenu tambah token: satuan / massal
  if (data === "token:add_menu") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh tambah token.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    clearState(userId);
    setState(userId, { mode: "token_add_menu" });
    return ctx
      .editMessageText(
        "➕ <b>Tambah Token</b>\n\n" +
          "Pilih cara tambah data:",
        { parse_mode: "HTML", ...tokenAddMenuKeyboard() }
      )
      .catch(() => {});
  }

  if (data === "token:add_back") {
    clearState(userId);
    const text = buildListTokenText();
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...listTokenKeyboard(),
      })
      .catch(() => {});
  }

  if (data === "token:add_single") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh tambah token.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    // Mulai wizard: tanya email
    clearState(userId);
    setState(userId, { mode: "adding_token_single_email", tempToken: {} });
    return ctx
      .editMessageText(
        "📧 <b>Tambah Data Satuan</b>\n\n" +
          "Silakan kirim email:\n" +
          "Contoh: <code>user@example.com</code>",
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  }

  if (data === "token:add_bulk") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh tambah token.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    clearState(userId);
    setState(userId, { mode: "adding_token_bulk" });
    return ctx
      .editMessageText(
        "📥 <b>Tambah Data Massal (YAML-ish)</b>\n\n" +
          "Kirim data dengan format per-blok, dipisah dengan <code>---</code>:\n\n" +
          "Contoh:\n" +
          "email: user1@example.com\n" +
          "token: 123456:AAA\n" +
          "username: @user1\n" +
          "---\n" +
          "email: user2@example.com\n" +
          "token: 999999:BBB\n" +
          "username:\n" +
          "---\n" +
          "email: user3@example.com\n" +
          "token: 555555:CCC\n\n" +
          "username boleh dikosongkan.",
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  }

  if (data === "token:edit") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh edit token.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    setState(userId, { mode: "editing_token_select" });
    const text =
      buildListTokenText() +
      "\n\n✏️ Kirim nomor token yang mau di-edit.\n" +
      "Contoh: <code>2</code>";
    return ctx
      .editMessageText(text, { parse_mode: "HTML" })
      .catch(() => {});
  }

  if (data === "token:delete") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh hapus token.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    setState(userId, { mode: "deleting_token_select" });
    const text =
      buildListTokenText() +
      "\n\n🗑 Kirim nomor token yang mau dihapus.\n" +
      "Contoh: <code>1</code>";
    return ctx
      .editMessageText(text, { parse_mode: "HTML" })
      .catch(() => {});
  }

  // ===== DAFTAR BOT (KATEGORI) =====
  if (data === "menu:daftar_bot") {
    clearState(userId);
    const text = buildDaftarBotText();
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...daftarBotKeyboard(),
      })
      .catch(() => {});
  }

  if (data.startsWith("botcat:open:")) {
    const category = data.split(":")[2];
    setState(userId, { botCategory: category });
    const text = buildListBotCategoryText(category);
    return ctx
      .editMessageText(text, {
        parse_mode: "HTML",
        ...listBotCategoryKeyboard(category),
      })
      .catch(() => {});
  }

  if (data === "botcat:add") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh tambah kategori bot.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    setState(userId, { mode: "adding_bot_category" });
    return ctx
      .editMessageText(
        "➕ <b>Tambah Kategori Bot</b>\n\n" +
          "Kirim nama kategori, contoh: <code>pin</code>",
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  }

  if (data === "botcat:edit") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh edit kategori bot.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    setState(userId, { mode: "editing_bot_category_select" });
    const text =
      buildDaftarBotText() +
      "\n\n✏️ Kirim format: <code>nomor;nama_baru</code>\n" +
      "Contoh: <code>1;pin-baru</code>";
    return ctx
      .editMessageText(text, { parse_mode: "HTML" })
      .catch(() => {});
  }

  if (data === "botcat:delete") {
    if (!isAdmin(userId)) {
      return ctx
        .editMessageText("❌ Hanya admin yang boleh hapus kategori bot.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    }
    setState(userId, { mode: "deleting_bot_category_select" });
    const text =
      buildDaftarBotText() +
      "\n\n🗑 Kirim nomor kategori yang mau dihapus.\n" +
      "Contoh: <code>2</code>";
    return ctx
      .editMessageText(text, { parse_mode: "HTML" })
      .catch(() => {});
  }

  // ===== DALAM KATEGORI (ITEM BOT) =====
  if (data.startsWith("botitem:")) {
    // contoh: botitem:pin:add
    const [, category, action] = data.split(":");
    if (action === "add") {
      if (!isAdmin(userId)) {
        return ctx
          .editMessageText("❌ Hanya admin yang boleh tambah bot.", {
            parse_mode: "HTML",
          })
          .catch(() => {});
      }
      setState(userId, { mode: "adding_bot_item", botCategory: category });
      return ctx
        .editMessageText(
          `➕ <b>Tambah Bot ${category}</b>\n\n` +
            "Kirim data dengan format:\n" +
            "<code>lokasi_vps;token;[username optional]</code>\n\n" +
            "Contoh:\n" +
            "<code>SG-1;123456:ABCDEF;@botpin</code>",
          { parse_mode: "HTML" }
        )
        .catch(() => {});
    } else if (action === "edit") {
      if (!isAdmin(userId)) {
        return ctx
          .editMessageText("❌ Hanya admin yang boleh edit bot.", {
            parse_mode: "HTML",
          })
          .catch(() => {});
      }
      setState(userId, { mode: "editing_bot_item_input", botCategory: category });
      const text =
        buildListBotCategoryText(category) +
        "\n\n✏️ Kirim format:\n" +
        "<code>nomor;lokasi_vps;token;[username optional]</code>\n" +
        "Contoh:\n" +
        "<code>1;SG-2;999999:NEWTOKEN;@usernamebaru</code>";
      return ctx
        .editMessageText(text, { parse_mode: "HTML" })
        .catch(() => {});
    } else if (action === "delete") {
      if (!isAdmin(userId)) {
        return ctx
          .editMessageText("❌ Hanya admin yang boleh hapus bot.", {
            parse_mode: "HTML",
          })
          .catch(() => {});
      }
      setState(userId, {
        mode: "deleting_bot_item_select",
        botCategory: category,
      });
      const text =
        buildListBotCategoryText(category) +
        "\n\n🗑 Kirim nomor bot yang mau dihapus.\n" +
        "Contoh: <code>1</code>";
      return ctx
        .editMessageText(text, { parse_mode: "HTML" })
        .catch(() => {});
    }
  }
});

// ===== TEXT HANDLER (LOGIKA MODE) =====
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = getState(userId);
  const mode = state.mode;
  const text = ctx.message.text.trim();

  // ===== TAMBAH TOKEN SATUAN: STEP-BY-STEP =====
  if (mode === "adding_token_single_email") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh tambah token.");
    }

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
      "🔑 Silakan kirim token:\n" +
        "Contoh: <code>123456:ABCDEF</code>",
      { parse_mode: "HTML" }
    );
  }

  if (mode === "adding_token_single_token") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh tambah token.");
    }

    if (!isValidToken(text)) {
      return ctx.replyWithHTML(
        "❌ Format token tidak valid.\n" +
          "Token minimal 5 karakter dan tidak boleh ada spasi.\n" +
          "Coba kirim ulang token yang benar.",
        { parse_mode: "HTML" }
      );
    }

    const temp = state.tempToken || {};
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
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh tambah token.");
    }

    const temp = state.tempToken || {};
    let username = "";

    if (text.toLowerCase() === "skip") {
      username = "";
    } else {
      username = text.trim();
      if (!username) {
        return ctx.replyWithHTML(
          "❌ Username tidak valid.\n" +
            "Kirim username atau ketik <code>skip</code> jika tidak ingin mengisi.",
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

    clearState(userId);

    return ctx.replyWithHTML(
      "✨ Data baru berhasil ditambahkan:\n\n" +
        `email: ${temp.email}\n` +
        `token: <code>${temp.token}</code>\n` +
        `username: ${temp.username || "(kosong)"}\n\n` +
        buildListTokenText(),
      listTokenKeyboard()
    );
  }

  // ===== TAMBAH TOKEN MASSAL (YAML-ish) =====
  if (mode === "adding_token_bulk") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh tambah token.");
    }

    const { items, errors } = parseYamlishTokens(text);

    if (errors.length > 0) {
      return ctx.replyWithHTML(
        "❌ Terjadi kesalahan pada data massal:\n\n" +
          errors.map((e) => `- ${e}`).join("\n") +
          "\n\nPerbaiki dan kirim ulang seluruh data.",
        { parse_mode: "HTML" }
      );
    }

    if (!items.length) {
      return ctx.replyWithHTML(
        "Tidak ada blok data yang terbaca.\n" +
          "Pastikan format sudah benar dan ada pemisah <code>---</code> bila perlu.",
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

    clearState(userId);

    return ctx.replyWithHTML(
      `✅ Berhasil menambahkan ${items.length} data token.\n\n` +
        buildListTokenText(),
      listTokenKeyboard()
    );
  }

  // ===== EDIT TOKEN (PILIH NOMOR) =====
  if (mode === "editing_token_select") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh edit token.");
    }
    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML" }
      );
    }
    if (num < 1 || num > TOKENS.length) {
      return ctx.replyWithHTML("Nomor di luar range.", { parse_mode: "HTML" });
    }
    const index = num - 1;
    const item = TOKENS[index];
    setState(userId, { mode: "editing_token_input", editIndex: index });

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

  // ===== EDIT TOKEN (INPUT DATA BARU) =====
  if (mode === "editing_token_input") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh edit token.");
    }
    const index = state.editIndex;
    if (index == null || index >= TOKENS.length) {
      clearState(userId);
      return ctx.replyWithHTML("Index token tidak ditemukan.", {
        parse_mode: "HTML",
      });
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

    TOKENS[index] = { username, email, token };
    clearState(userId);

    return ctx.replyWithHTML(
      "✅ Token berhasil di-update.\n\n" + buildListTokenText(),
      listTokenKeyboard()
    );
  }

  // ===== HAPUS TOKEN =====
  if (mode === "deleting_token_select") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh hapus token.");
    }
    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML(
        "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
        { parse_mode: "HTML" }
      );
    }
    if (num < 1 || num > TOKENS.length) {
      return ctx.replyWithHTML("Nomor di luar range.", { parse_mode: "HTML" });
    }
    const deleted = TOKENS.splice(num - 1, 1)[0];
    clearState(userId);

    return ctx.replyWithHTML(
      "✅ Token berikut telah dihapus:\n" +
        `email: ${deleted.email}\n` +
        `token: <code>${deleted.token}</code>\n\n` +
        buildListTokenText(),
      listTokenKeyboard()
    );
  }

  // ===== TAMBAH KATEGORI BOT =====
  if (mode === "adding_bot_category") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML(
        "❌ Hanya admin yang boleh tambah kategori bot.",
        { parse_mode: "HTML" }
      );
    }
    const name = text;
    if (!name) {
      return ctx.replyWithHTML("Nama kategori tidak boleh kosong.", {
        parse_mode: "HTML",
      });
    }
    if (BOTS[name]) {
      return ctx.replyWithHTML("Nama kategori sudah ada.", {
        parse_mode: "HTML",
      });
    }
    BOTS[name] = [];
    clearState(userId);

    return ctx.replyWithHTML(
      "✅ Kategori bot baru ditambahkan.\n\n" + buildDaftarBotText(),
      daftarBotKeyboard()
    );
  }

  // ===== EDIT KATEGORI BOT (nomor;nama_baru) =====
  if (mode === "editing_bot_category_select") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML(
        "❌ Hanya admin yang boleh edit kategori bot.",
        { parse_mode: "HTML" }
      );
    }
    const parts = text.split(";").map((s) => s.trim());
    if (parts.length !== 2) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>nomor;nama_baru</code>",
        { parse_mode: "HTML" }
      );
    }
    const num = Number(parts[0]);
    const newName = parts[1];
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", { parse_mode: "HTML" });
    }
    if (!newName) {
      return ctx.replyWithHTML("Nama baru tidak boleh kosong.", {
        parse_mode: "HTML",
      });
    }

    const names = Object.keys(BOTS);
    if (num < 1 || num > names.length) {
      return ctx.replyWithHTML("Nomor di luar range.", { parse_mode: "HTML" });
    }
    const oldName = names[num - 1];

    if (BOTS[newName] && newName !== oldName) {
      return ctx.replyWithHTML("Nama kategori baru sudah dipakai.", {
        parse_mode: "HTML",
      });
    }

    BOTS[newName] = BOTS[oldName];
    if (newName !== oldName) delete BOTS[oldName];

    clearState(userId);
    return ctx.replyWithHTML(
      `✅ Kategori '${oldName}' di-rename jadi '${newName}'.\n\n` +
        buildDaftarBotText(),
      daftarBotKeyboard()
    );
  }

  // ===== HAPUS KATEGORI BOT =====
  if (mode === "deleting_bot_category_select") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML(
        "❌ Hanya admin yang boleh hapus kategori bot.",
        { parse_mode: "HTML" }
      );
    }
    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", { parse_mode: "HTML" });
    }

    const names = Object.keys(BOTS);
    if (num < 1 || num > names.length) {
      return ctx.replyWithHTML("Nomor di luar range.", { parse_mode: "HTML" });
    }
    const name = names[num - 1];
    const deleted = BOTS[name];
    delete BOTS[name];

    clearState(userId);
    return ctx.replyWithHTML(
      `✅ Kategori '${name}' telah dihapus.\n` +
        `Jumlah bot di dalam kategori tadi: ${deleted.length}\n\n` +
        buildDaftarBotText(),
      daftarBotKeyboard()
    );
  }

  // ===== TAMBAH ITEM BOT =====
  if (mode === "adding_bot_item") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh tambah bot.", {
        parse_mode: "HTML",
      });
    }
    const category = state.botCategory;
    if (!category || !BOTS[category]) {
      clearState(userId);
      return ctx.replyWithHTML("Kategori bot tidak ditemukan.", {
        parse_mode: "HTML",
      });
    }
    const parts = text.split(";").map((s) => s.trim());
    if (parts.length < 2) {
      return ctx.replyWithHTML(
        "Format salah.\nGunakan: <code>lokasi_vps;token;[username]</code>",
        { parse_mode: "HTML" }
      );
    }
    const lokasi_vps = parts[0];
    const token = parts[1];
    const username = parts[2] || "";

    if (!isValidToken(token)) {
      return ctx.replyWithHTML(
        "❌ Token tidak valid.\nMinimal 5 karakter dan tidak boleh spasi.",
        { parse_mode: "HTML" }
      );
    }

    BOTS[category].push({ lokasi_vps, username, token });
    clearState(userId);

    return ctx.replyWithHTML(
      `✅ Bot baru di kategori ${category} ditambahkan.\n\n` +
        buildListBotCategoryText(category),
      listBotCategoryKeyboard(category)
    );
  }

  // ===== EDIT ITEM BOT (nomor;lokasi_vps;token;[username]) =====
  if (mode === "editing_bot_item_input") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh edit bot.", {
        parse_mode: "HTML",
      });
    }
    const category = state.botCategory;
    if (!category || !BOTS[category]) {
      clearState(userId);
      return ctx.replyWithHTML("Kategori bot tidak ditemukan.", {
        parse_mode: "HTML",
      });
    }
    const parts = text.split(";").map((s) => s.trim());
    if (parts.length < 3) {
      return ctx.replyWithHTML(
        "Format salah.\n" +
          "Gunakan: <code>nomor;lokasi_vps;token;[username]</code>",
        { parse_mode: "HTML" }
      );
    }
    const num = Number(parts[0]);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", { parse_mode: "HTML" });
    }
    const dataList = BOTS[category];
    if (num < 1 || num > dataList.length) {
      return ctx.replyWithHTML("Nomor di luar range.", { parse_mode: "HTML" });
    }
    const lokasi_vps = parts[1];
    const token = parts[2];
    const username = parts[3] || "";

    if (!isValidToken(token)) {
      return ctx.replyWithHTML(
        "❌ Token tidak valid.\nMinimal 5 karakter dan tidak boleh spasi.",
        { parse_mode: "HTML" }
      );
    }

    dataList[num - 1] = { lokasi_vps, username, token };
    clearState(userId);

    return ctx.replyWithHTML(
      "✅ Data bot berhasil di-update.\n\n" +
        buildListBotCategoryText(category),
      listBotCategoryKeyboard(category)
    );
  }

  // ===== HAPUS ITEM BOT =====
  if (mode === "deleting_bot_item_select") {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML("❌ Hanya admin yang boleh hapus bot.", {
        parse_mode: "HTML",
      });
    }
    const category = state.botCategory;
    if (!category || !BOTS[category]) {
      clearState(userId);
      return ctx.replyWithHTML("Kategori bot tidak ditemukan.", {
        parse_mode: "HTML",
      });
    }
    const num = Number(text);
    if (!Number.isInteger(num)) {
      return ctx.replyWithHTML("Nomor tidak valid.", { parse_mode: "HTML" });
    }
    const dataList = BOTS[category];
    if (num < 1 || num > dataList.length) {
      return ctx.replyWithHTML("Nomor di luar range.", { parse_mode: "HTML" });
    }
    const deleted = dataList.splice(num - 1, 1)[0];
    clearState(userId);

    return ctx.replyWithHTML(
      "✅ Bot berikut telah dihapus:\n" +
        `lokasi vps: ${deleted.lokasi_vps}\n` +
        `username: ${deleted.username || "(kosong)"}\n` +
        `token: <code>${deleted.token}</code>\n\n` +
        buildListBotCategoryText(category),
      listBotCategoryKeyboard(category)
    );
  }

  // ===== DEFAULT (TIDAK SEDANG DALAM MODE) =====
  return ctx.replyWithHTML("Kalau mau mulai, pakai /start dulu ya 😉");
});

// RUN
bot.launch().then(() => {
  console.log("Bot jalan...");
});

// Graceful stop (kalau dipakai di server)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
