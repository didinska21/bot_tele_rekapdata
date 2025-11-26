// data.js
// sementara masih in-memory
let TOKENS = [
  { username: "", email: "user1@example.com", token: "123456:ABCDEF" },
  { username: "@budi", email: "budi@example.com", token: "987654:ZYXWVU" },
];

// BOTS masih simple dulu, kalau mau bisa dikembangkan pakai pola yang sama
let BOTS = {
  pin: [
    { lokasi_vps: "SG-1", username: "", token: "111111:PINPIN" },
    { lokasi_vps: "ID-2", username: "@botpinid", token: "222222:PINPIN" },
  ],
};

module.exports = {
  TOKENS,
  BOTS,
};
