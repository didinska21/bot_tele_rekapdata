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

// simple daftar bot (bisa dikembangin)
const buildDaftarBotText = () => {
  const names = Object.keys(BOTS);
  if (!names.length) {
    return "🤖 <b>Daftar Bot</b>\n\nBelum ada data bot.";
  }
  const lines = ["🤖 <b>Daftar Bot</b>\n"];
  names.forEach((name, i) => {
    lines.push(`${i + 1}. ${name}`);
    BOTS[name].forEach((b, j) => {
      lines.push(
        `   - ${j + 1}. lokasi: ${b.lokasi_vps}, username: ${
          b.username || "(kosong)"
        }, token: <code>${b.token}</code>`
      );
    });
  });
  return lines.join("\n");
};

module.exports = {
  buildListTokenText,
  buildDaftarBotText,
};
