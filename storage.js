// storage.js
const fs = require("fs");
const path = require("path");
const { log } = require("./config");

const DATA_DIR = path.join(__dirname, "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log("Membuat folder data/", DATA_DIR);
  }
}

function loadJson(filename, defaultValue) {
  try {
    ensureDataDir();
    const fullPath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      log("File tidak ditemukan, pakai default:", filename);
      return defaultValue;
    }
    const raw = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    log("Gagal load JSON", filename, err.message);
    return defaultValue;
  }
}

function saveJson(filename, data) {
  try {
    ensureDataDir();
    const fullPath = path.join(DATA_DIR, filename);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
    log("Simpan JSON:", filename);
  } catch (err) {
    log("Gagal simpan JSON", filename, err.message);
  }
}

module.exports = {
  loadJson,
  saveJson,
};
