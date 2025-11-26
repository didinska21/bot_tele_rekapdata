// textBuilders.js
const { TOKENS, BOTS } = require("./data");

// list token
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
      `${i + 1}.\n` +
        `username: ${username}\n` +
        `email: ${email}\n` +
        `token: <code>${token}</code>\n`
    );
  });
  return lines.join("\n");
};

// daftar kategori + summary
const buildDaftarBotText = () => {
  const names = Object.keys(BOTS);
  if (!names.length) {
    return "🤖 <b>Daftar Bot</b>\n\nBelum ada kategori bot.";
  }
  const lines = ["🤖 <b>Daftar Bot</b>\n"];
  names.forEach((name, i) => {
    lines.push(`${i + 1}. ${name}`);
  });
  lines.push("\nKlik salah satu tombol kategori di bawah.");
  return lines.join("\n");
};

// list bot dalam satu kategori
const buildBotCategoryText = (category) => {
  const items = BOTS[category] || [];
  if (!items.length) {
    return `🤖 <b>${category}</b>\n\nBelum ada data bot pada kategori ini.`;
  }
  const lines = [`🤖 <b>${category}</b>\n`];
  items.forEach((b, i) => {
    lines.push(
      `${i + 1}.\n` +
        `lokasi vps: ${b.lokasi_vps || "(kosong)"}\n` +
        `username: ${b.username || "(kosong)"}\n` +
        `token: <code>${b.token}</code>\n`
    );
  });
  return lines.join("\n");
};

module.exports = {
  buildListTokenText,
  buildDaftarBotText,
  buildBotCategoryText,
};
