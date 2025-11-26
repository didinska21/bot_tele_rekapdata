// data.js
const { loadJson, saveJson } = require("./storage");

// in-memory + file JSON
let TOKENS = loadJson("tokens.json", []); // array of {email, token, username}
let BOTS = loadJson("bots.json", {
  // contoh default, boleh kamu kosongkan {}
  pin: [],
  haven: [],
  kitsu: [],
});

function saveTokens() {
  saveJson("tokens.json", TOKENS);
}

function saveBots() {
  saveJson("bots.json", BOTS);
}

// ===== TOKEN CRUD =====
function addToken(obj) {
  TOKENS.push(obj);
  saveTokens();
}

function updateToken(index, obj) {
  TOKENS[index] = obj;
  saveTokens();
}

function deleteToken(index) {
  TOKENS.splice(index, 1);
  saveTokens();
}

// ===== BOT CATEGORY & ITEM CRUD =====
function getCategoryNames() {
  return Object.keys(BOTS);
}

function getCategoryNameByIndex(index) {
  const names = getCategoryNames();
  return names[index] || null;
}

function addCategory(name) {
  if (!BOTS[name]) {
    BOTS[name] = [];
    saveBots();
    return true;
  }
  return false; // sudah ada
}

function renameCategory(oldName, newName) {
  if (!BOTS[oldName]) return false;
  if (BOTS[newName] && newName !== oldName) return false;
  BOTS[newName] = BOTS[oldName];
  if (newName !== oldName) delete BOTS[oldName];
  saveBots();
  return true;
}

function deleteCategory(name) {
  if (!BOTS[name]) return false;
  delete BOTS[name];
  saveBots();
  return true;
}

// item dalam kategori
function addBotItem(category, item) {
  if (!BOTS[category]) BOTS[category] = [];
  BOTS[category].push(item);
  saveBots();
}

function updateBotItem(category, index, item) {
  if (!BOTS[category]) return false;
  if (index < 0 || index >= BOTS[category].length) return false;
  BOTS[category][index] = item;
  saveBots();
  return true;
}

function deleteBotItem(category, index) {
  if (!BOTS[category]) return false;
  if (index < 0 || index >= BOTS[category].length) return false;
  BOTS[category].splice(index, 1);
  saveBots();
  return true;
}

module.exports = {
  TOKENS,
  BOTS,
  // token ops
  addToken,
  updateToken,
  deleteToken,
  // bots
  getCategoryNames,
  getCategoryNameByIndex,
  addCategory,
  renameCategory,
  deleteCategory,
  addBotItem,
  updateBotItem,
  deleteBotItem,
};
