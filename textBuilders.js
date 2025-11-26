// textBuilders.js
const {
  TOKENS,
  BOTS,
  getCategoryNames,
  getTokensByGroup,
} = require("./data");

// list token per grup (irwan / din)
const buildListTokenTextByGroup = (group) => {
  const list = getTokensByGroup(group);
  if (!list.length) {
    return `🔐 <b>List Token (${group})</b>\n\nBelum ada data token untuk grup ini.`;
  }
  const lines = [`🔐 <b>List Token (${group})</b>\n`];
  list.forEach(({ token }, i) => {
    const username = token.username || "(kosong)";
    const email = token.email || "(kosong)";
    const t = token.token || "(kosong)";
    lines.push(
      `${i + 1}.\n` +
        `username: ${username}\n` +
        `email: ${email}\n` +
        `token: <code>${t}</code>\n`
    );
  });
  return lines.join("\n");
};

// daftar kategori bot
const buildDaftarBotText = () => {
  const names = getCategoryNames();
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

// list item dalam kategori bot
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
  buildListTokenTextByGroup,
  buildDaftarBotText,
  buildBotCategoryText,
};
