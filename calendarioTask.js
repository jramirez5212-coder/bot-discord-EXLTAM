const { EmbedBuilder }                              = require("discord.js");
const { loadData, getUser, todayKey,
        horaMinutoColombia, loadTops, saveTops,
        saveData }                                  = require("../utils/dataManager");
const { msToHours }                                 = require("../utils/format");
const { CANAL_ACTIVIDAD_ID, CANAL_TOP_ID,
        CANAL_LOGS_ID, ACTIVITY_ROLE_ID,
        TOP_ROLE_ID, STAFF_ROLE_ID,
        TOP_SIZE, GUILD_ID, LOGO_URL }              = require("../config");

let embedActividadId = null;
let embedTopId       = null;
let lastTopWeek      = null;
let guildCache       = null;

let _activeSessions = null;
function getActiveSessions() {
  if (!_activeSessions)
    _activeSessions = require("../events/voiceStateUpdate").activeSessions;
  return _activeSessions;
}

async function getGuild(client) {
  if (!guildCache) {
    guildCache = await client.guilds.fetch(GUILD_ID);
    try {
      await guildCache.members.fetch();
    } catch(e) {
      // Rate limited — esperar 30 segundos y reintentar una vez
      console.log("[ACTIVIDAD] Rate limit en members.fetch, reintentando en 30s...");
      await new Promise(r => setTimeout(r, 30000));
      try { await guildCache.members.fetch(); } catch {}
    }
  }
  return guildCache;
}

// Exportar para que actividadRushTask pueda reusar el mismo caché
function setGuildCache(g) { guildCache = g; }
function getGuildCache()  { return guildCache; }

function startActividadTask(client) {
  client.on("updateActividadEmbed", () => updateActividadEmbed(client));
  client.on("voiceStateUpdate", () => {
    updateActividadEmbed(client).catch(() => {});
  });
  setInterval(() => updateActividadEmbed(client), 30 * 1000);
  setInterval(async () => {
    try { if (guildCache) await guildCache.members.fetch(); } catch {}
  }, 10 * 60 * 1000);
  setTimeout(() => updateActividadEmbed(client), 35000);
}

// ── Embed actividad diaria ────────────────────────────────────────
async function updateActividadEmbed(client) {
  try {
    const guild = await getGuild(client);
    const canal = await client.channels.fetch(CANAL_ACTIVIDAD_ID).catch(() => null);
    if (!canal) return;

    const data           = loadData();
    const hoy            = todayKey();
    const activeSessions = getActiveSessions();
    const ahora          = Date.now();

    // Usar ACTIVITY_ROLE_ID — el rol que cuenta horas
    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const enVoz  = [];
    const fuera  = [];

    for (const [id, member] of miembros) {
      const sesion = activeSessions.get(id);
      const sesionTs = sesion && !sesion.isRush ? sesion.startMs : null;
      if (sesionTs) {
        enVoz.push({ member, num: 0 });
      } else {
        fuera.push({ member, num: 0 });
      }
    }

    // Numerar
    const listaVoz   = enVoz.length  ? enVoz.map((e, i)  => `${i+1}. ${e.member} 🟢`).join("\n") : "_Nadie en canal de voz_";
    const listaFuera = fuera.length  ? fuera.map((e, i) => `${enVoz.length+i+1}. ${e.member}`).join("\n")  : "_Todos están en voz_";

    const embed = new EmbedBuilder()
      .setTitle("📋 Plantilla ROLAS — Presencia")
      .setColor(0xFF69B4)
      .setThumbnail(LOGO_URL)
      .addFields(
        { name: `🟢 EN CANAL DE VOZ (${enVoz.length})`,  value: listaVoz.slice(0,1000),   inline: false },
        { name: `🔴 FUERA (${fuera.length})`,            value: listaFuera.slice(0,1000), inline: false },
      )
      .setFooter({ text: `Colombia (UTC-5) • actualizado a las ${horaMinutoColombia()}` })
      .setTimestamp();

    if (embedActividadId) {
      try {
        const msg = await canal.messages.fetch(embedActividadId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch { embedActividadId = null; }
    }
    const msg = await canal.send({ embeds: [embed] });
    embedActividadId = msg.id;

  } catch (err) {
    console.error("[ACTIVIDAD] Error:", err.message);
  }
}

module.exports = { startActividadTask, updateActividadEmbed, getGuildCache, setGuildCache };
