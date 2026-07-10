const fs   = require("fs");
const path = require("path");

const FILE_ROLAS = path.join(__dirname, "../../data/numeros_rolas.json");
const FILE_RUSH  = path.join(__dirname, "../../data/numeros_rush.json");

function load(file) {
  if (!fs.existsSync(file)) { fs.writeFileSync(file, "{}"); return {}; }
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Obtiene o asigna el número fijo de un miembro
function getNumero(userId, file) {
  const data = load(file);
  if (data[userId]) return data[userId];
  // Asignar siguiente número disponible
  const nums  = Object.values(data).map(Number);
  const next  = nums.length ? Math.max(...nums) + 1 : 1;
  data[userId] = next;
  save(file, data);
  return next;
}

function getNumeroRolas(userId) { return getNumero(userId, FILE_ROLAS); }
function getNumeroRush(userId)  { return getNumero(userId, FILE_RUSH); }

// Inicializa números para todos los miembros con el rol (por join date)
function inicializarNumeros(miembros, file) {
  const data = load(file);
  // Ordenar por joinedTimestamp (orden de llegada)
  const ordenados = [...miembros.values()]
    .filter(m => !m.user.bot)
    .sort((a, b) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0));
  
  let changed = false;
  ordenados.forEach((member, idx) => {
    if (!data[member.id]) {
      data[member.id] = idx + 1;
      changed = true;
    }
  });
  
  if (changed) save(file, data);
  return data;
}

module.exports = { getNumeroRolas, getNumeroRush, inicializarNumeros, FILE_ROLAS, FILE_RUSH };
