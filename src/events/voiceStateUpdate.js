const { loadData, saveData, loadDataRush, saveDataRush, getUser, cleanOldDays, todayKey } = require('../utils/dataManager');
const { ACTIVITY_ROLE_ID, RUSH_ACTIVITY_ROLE_ID, MAX_SESSION_MS, AFK_CHANNEL_ID } = require('../config');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const TIEMPO_ENSORDECIDO_MS = 5 * 60 * 1000;
const TIEMPO_SILENCIADO_MS  = 8 * 60 * 1000;
const antiFarmeoTimers = new Map();
const CANAL_LOGS_VOZ_ID = "1516294458591674530";

// Usuarios exentos del anti-farmeo
const afkExemptos     = new Set();
const afkExemptosMute = new Set();
const afkExemptoDeaf  = new Set();

// Sesiones activas en memoria
const activeSessions = new Map(); // userId -> { startMs, isRush }
const pendingUpdates = new Map();

// Detecta si el miembro es ROLAS, RUSH o ninguno
function detectarSistema(member) {
  if (member.roles.cache.has(ACTIVITY_ROLE_ID))      return "ROLAS";
  if (member.roles.cache.has(RUSH_ACTIVITY_ROLE_ID)) return "RUSH";
  return null;
}

// Carga y guarda el archivo correcto según el sistema
function cargarDatos(isRush) { return isRush ? loadDataRush() : loadData(); }
function guardarDatos(data, isRush) { isRush ? saveDataRush(data) : saveData(data); }

// Al arrancar: recuperar sesiones activas
async function recoverSessions(client) {
  try {
    // 1. Recuperar sesiones del JSON (para continuar contando horas)
    for (const [isRush, label] of [[false,"ROLAS"],[true,"RUSH"]]) {
      const data = cargarDatos(isRush);
      for (const userId in data) {
        const ud = data[userId];
        if (ud.sessionStart) {
          activeSessions.set(userId, { startMs: ud.sessionStart, isRush });
          console.log(`[VOZ-${label}] ↩ Sesión recuperada: ${userId} desde ${new Date(ud.sessionStart).toLocaleTimeString()}`);
        }
      }
    }

    // 2. Escanear quién está en voz AHORA y agregar al activeSessions
    const { ACTIVITY_ROLE_ID, RUSH_ACTIVITY_ROLE_ID, AFK_CHANNEL_ID, VOICE_CHANNELS_ALLOWED } = require('../config');
    await client.guilds.fetch();
    for (const [, guild] of client.guilds.cache) {
      await guild.members.fetch().catch(() => {});
      for (const [, member] of guild.members.cache) {
        if (!member.voice.channelId) continue;
        if (member.voice.channelId === AFK_CHANNEL_ID) continue;
        if (!VOICE_CHANNELS_ALLOWED.includes(member.voice.channelId)) continue;
        if (member.user.bot) continue;
        if (activeSessions.has(member.id)) continue; // ya tiene sesión

        const esRolas = member.roles.cache.has(ACTIVITY_ROLE_ID);
        const esRush  = member.roles.cache.has(RUSH_ACTIVITY_ROLE_ID);
        if (!esRolas && !esRush) continue;

        const isRush = !esRolas && esRush;
        activeSessions.set(member.id, { startMs: Date.now(), isRush });
        console.log(`[VOZ-${isRush?"RUSH":"ROLAS"}] ▶ Sesión iniciada al arrancar: ${member.user.tag}`);
      }
    }
  } catch(e) { console.error("[VOZ] Error recuperando sesiones:", e.message); }
}

module.exports = {
  activeSessions,
  recoverSessions,
  handleAntiFarmeoButton,
  afkExemptos,
  afkExemptosMute,
  afkExemptoDeaf,

  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const sistema = detectarSistema(member);
    if (!sistema) return;

    const isRush  = sistema === "RUSH";
    const userId  = member.id;
    const entró   = !oldState.channelId && newState.channelId;
    const salió   = oldState.channelId  && !newState.channelId;
    const cambióCh = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    const nuevoCanalEsAFK = newState.channelId === AFK_CHANNEL_ID;
    const viejoCanalEsAFK = oldState.channelId === AFK_CHANNEL_ID;

    // ── ENTRÓ A VOZ ──────────────────────────────────────────
    if ((entró && !nuevoCanalEsAFK) || (cambióCh && viejoCanalEsAFK && !nuevoCanalEsAFK)) {
      const ahora = Date.now();
      activeSessions.set(userId, { startMs: ahora, isRush });

      // RUSH no guarda horas, solo ROLAS
      if (!isRush) {
        const data     = cargarDatos(false);
        const userData = getUser(data, userId);
        userData.sessionStart = ahora;
        guardarDatos(data, false);
      }

      console.log(`[VOZ-${sistema}] ▶ ${member.user.tag} entró a #${newState.channel?.name}`);
    }

    // ── SALIÓ DE VOZ ─────────────────────────────────────────
    if ((salió && !viejoCanalEsAFK) || (cambióCh && !viejoCanalEsAFK && nuevoCanalEsAFK)) {
      const sesion = activeSessions.get(userId);
      if (sesion) {
        const sesIsRush = sesion.isRush;

        // Solo guardar horas para ROLAS
        if (!sesIsRush) {
          const duration = Date.now() - sesion.startMs;
          if (duration > 0 && duration < MAX_SESSION_MS) {
            const data     = cargarDatos(false);
            const userData = getUser(data, userId);
            const hoy      = todayKey();

            userData.totalMs  += duration;
            userData.weekMs   += duration;
            userData.lastSeen  = Date.now();

            if (!userData.days[hoy]) userData.days[hoy] = { totalMs: 0 };
            userData.days[hoy].totalMs += duration;

            const ayer    = new Date();
            ayer.setDate(ayer.getDate() - 1);
            const ayerKey = ayer.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
            if (userData.ultimoDiaContinuo === ayerKey || userData.ultimoDiaContinuo === hoy) {
              if (userData.ultimoDiaContinuo !== hoy) {
                userData.diasSeguidos      = (userData.diasSeguidos || 0) + 1;
                userData.ultimoDiaContinuo = hoy;
              }
            } else {
              userData.diasSeguidos      = 1;
              userData.ultimoDiaContinuo = hoy;
            }

            delete userData.sessionStart;
            cleanOldDays(userData);
            guardarDatos(data, false);
            console.log(`[VOZ-ROLAS] ✓ ${member.user.tag} +${Math.floor(duration/60000)}m guardado`);
          } else {
            const data = cargarDatos(false);
            const userData = getUser(data, userId);
            delete userData.sessionStart;
            guardarDatos(data, false);
          }
        } else {
          // RUSH — solo eliminar sesión sin guardar horas
          console.log(`[VOZ-RUSH] ↩ ${member.user.tag} salió de voz`);
        }

        activeSessions.delete(userId);
      }

      clearTimeout(pendingUpdates.get(userId));
      pendingUpdates.set(userId, setTimeout(() => {
        client.emit("updateActividadEmbed");
        pendingUpdates.delete(userId);
      }, 5000));

      clearTimeout(antiFarmeoTimers.get(userId));
      antiFarmeoTimers.delete(userId);
    }

    // Anti-farmeo desactivado
  },
};

async function handleAntiFarmeoButton(interaction) {
  // Anti-farmeo desactivado — función vacía para compatibilidad
  return;
}
