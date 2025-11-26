// data.js
const { loadJson, saveJson } = require("./storage");

// TOKENS: array of { email, token, username, group }
let TOKENS = loadJson("tokens.json", []);

// BOTS: { [category]: [ { lokasi_vps, username, token } ] }
let BOTS = loadJson("bots.json", {
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

// ===== TOKEN HELPERS =====
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

// token by group ("irwan" / "din" dll)
function getTokensByGroup(groupName) {
  const list = [];
  TOKENS.forEach((t, i) => {
    const g = t.group || "irwan"; // default ke irwan kalau belum ada group
    if (g === groupName) {
      list.push({ index: i, token: t });
    }
  });
  return list;
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
  return false;
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
  // tokens
  addToken,
  updateToken,
  deleteToken,
  getTokensByGroup,
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
