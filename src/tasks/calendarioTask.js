const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { CANAL_CMD_ANUNCIOS, CANAL_CMD_TORNEO, ACTIVITY_ROLE_ID } = require("../config");

const ROL_MEGA_1 = "1516258964709445642";
const ROL_MEGA_2 = "1516258963459539074";

// ROLAS — menciona solo el rol de actividad ROLAS
const ROL_MENTION = `<@&${ACTIVITY_ROLE_ID}>`;


// ── CALENDARIO ────────────────────────────────────────────────────────────────
// tipo: torneo | tormenta | battle | drop | mega_torneo | mega_battle
const EVENTOS = [
  { hora: "15:00", nombre: "Torneo 1v1",                     tipo: "torneo",      puntos: "x1 pts", rank: "F1", jugadores: 100 },
  { hora: "15:30", nombre: "Torneo Bandas 2v2",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 2  },
  { hora: "16:00", nombre: "Torneo Bandas 2v2",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 2  },
  { hora: "16:30", nombre: "Torneo Bandas 2v2",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 2  },
  { hora: "17:30", nombre: "Torneo Bandas 3v3",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 3  },
  { hora: "18:30", nombre: "Torneo 1v1",                     tipo: "torneo",      puntos: "x1 pts", rank: "F1", jugadores: 100 },
  { hora: "19:00", nombre: "Tanda de Tormentas (8 tormentas)",tipo: "tormenta",    puntos: null,     rank: "F7", jugadores: null },
  { hora: "20:00", nombre: "Torneo Bandas 4v4",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 4  },
  { hora: "20:40", nombre: "x1 Battle Royale",                tipo: "battle",      puntos: null,     rank: "F7", jugadores: null },
  { hora: "21:00", nombre: "MEGA TORNEO 5v5-10v10 (Sorteo)",  tipo: "mega_torneo", puntos: "x3 pts", rank: "F4", jugadores: null },
  { hora: "22:00", nombre: "MEGA BATTLE ROYALE",              tipo: "mega_battle", puntos: null,     rank: "F7", jugadores: null },
  { hora: "22:30", nombre: "DROP DEL DÍA",                    tipo: "drop",        puntos: "x1 pts", rank: "F9", jugadores: null },
  { hora: "23:00", nombre: "Torneo Bandas 5v5",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 5  },
  { hora: "23:30", nombre: "Torneo Bandas 4v4",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 4  },
  { hora: "00:45", nombre: "Torneo Bandas 4v4",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 4  },
  { hora: "01:30", nombre: "Torneo 1v1",                     tipo: "torneo",      puntos: "x1 pts", rank: "F1", jugadores: 100 },
  { hora: "02:00", nombre: "Torneo Bandas 3v3",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 3  },
  { hora: "02:45", nombre: "Torneo Bandas 3v3",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 3  },
  { hora: "03:30", nombre: "Torneo Bandas 2v2",               tipo: "torneo",      puntos: "x1 pts", rank: "F4", jugadores: 2  },
];

const EMOJIS = {
  torneo:      "🏆",
  tormenta:    "🌪️",
  battle:      "💥",
  drop:        "🎁",
  mega_torneo: "🔥",
  mega_battle: "⚔️",
};

// Inscripciones activas: eventoKey -> { inscritos: Set<userId> }
const inscripcionesActivas = new Map();

function horaAMinutos(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }
function ahoraEnSegs() {
  const c = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  return (c.getHours() * 60 + c.getMinutes()) * 60 + c.getSeconds();
}
function eventosSiguientes(n = 3) {
  const ahora = ahoraEnSegs() / 60;
  const ord = [...EVENTOS].sort((a, b) => horaAMinutos(a.hora) - horaAMinutos(b.hora));
  return [...ord.filter(e => horaAMinutos(e.hora) > ahora), ...ord.filter(e => horaAMinutos(e.hora) <= ahora)].slice(0, n);
}

// ── TORNEOS AUTOMÁTICOS: solo anuncio, sin sorteo ────────────────────────────
async function lanzarTorneoNormal(evento, client) {
  const canal = await client.channels.fetch(CANAL_CMD_TORNEO).catch(() => null);
  if (!canal) return;

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle(`🏆 ${evento.nombre}`)
    .setDescription(
      `${ROL_MENTION}\n\n` +
      `🗺️ **El spawn ya está en barrio — ¡métanse!**\n\n` +
      `📌 **Rank:** ${evento.rank}\n` +
      `${evento.puntos ? `🏅 **Puntos:** ${evento.puntos}\n` : ""}` +
      `🎮 Entren al canal de voz y al servidor ahora.`
    )
    .setTimestamp();

  await canal.send({ content: `${ROL_MENTION}`, embeds: [embed] });
}

// ── MEGAs: solo notificación con mención especial ─────────────────────────────
async function lanzarMega(evento, client) {
  const canal = await client.channels.fetch(CANAL_CMD_TORNEO).catch(() => null);
  if (!canal) return;

  const emoji = EMOJIS[evento.tipo];
  const esMegaTorneo = evento.tipo === "mega_torneo";
  const embed = new EmbedBuilder()
    .setColor(0xff6b00)
    .setTitle(`${emoji} ${evento.nombre}`)
    .setDescription(
      `<@&${ROL_MEGA_1}> <@&${ROL_MEGA_2}> — ¡¡HAY **${evento.nombre.toUpperCase()}**!!\n\n` +
      `📌 **Rank:** ${evento.rank}\n` +
      `${evento.puntos ? `🏅 **Puntos:** ${evento.puntos}\n` : ""}` +
      (esMegaTorneo
        ? `\n📋 **Reglas:**\n` +
          `• Se juega en equipos, ustedes eligen la plantilla\n` +
          `• Solo participan quienes tengan los rangos requeridos (${evento.rank})\n` +
          `• Los rangos deben respetarse\n` +
          `• La formación del equipo la deciden los propios jugadores\n\n`
        : "\n") +
      `🎮 **Por favor entren al canal de voz para jugar.**`
    )
    .setTimestamp();

  await canal.send({ content: undefined, embeds: [embed] });
}

// ── TANDA DE TORMENTAS ────────────────────────────────────────────────────────
async function lanzarTormenta(client) {
  const canal = await client.channels.fetch(CANAL_CMD_ANUNCIOS).catch(() => null);
  if (!canal) return;
  // Dispara el sistema de tandas como si alguien hubiera escrito !tandastormentas
  const { handleTandas } = require("../commands/tandas");
  // Creamos un mensaje fake para disparar el handler
  const fakeMsg = {
    author:  { bot: false, id: client.user.id },
    content: "!tandastormentas",
    channel: canal,
    member:  { roles: { cache: { has: () => true } } },
    guild:   canal.guild,
    reply:   async () => {},
    delete:  async () => {},
  };
  await handleTandas(fakeMsg);
}

// ── NOTIFICACIONES PREVIAS ────────────────────────────────────────────────────
async function notificarPrevio(evento, tipo, client) {
  const esTorneo  = ["torneo"].includes(evento.tipo);
  const canalId   = esTorneo ? CANAL_CMD_TORNEO : CANAL_CMD_ANUNCIOS;
  const canal     = await client.channels.fetch(canalId).catch(() => null);
  if (!canal) return;

  const emoji      = EMOJIS[evento.tipo] || "🎮";
  const minutos    = tipo === "10min" ? 10 : 3;
  const color      = tipo === "10min" ? 0xf39c12 : 0xe74c3c;
  const siguientes = tipo === "3min" ? eventosSiguientes(3) : null;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} ${evento.nombre}`)
    .setDescription(
      `⏰ En **${minutos} minutos** comienza:\n\n` +
      `${emoji} **${evento.nombre}**${evento.puntos ? ` → ${evento.puntos}` : ""} → Rank **${evento.rank}**\n\n` +
      `¡${tipo === "3min" ? "Entren ya al canal de voz!" : "Prepárense!"}`
    )
    .setTimestamp();

  if (siguientes?.length) {
    embed.addFields({
      name: "📅 Próximos eventos",
      value: siguientes.map(e => `${EMOJIS[e.tipo] || "🎮"} **${e.hora}** — ${e.nombre}${e.puntos ? ` → ${e.puntos}` : ""}`).join("\n")
    });
  }

  await canal.send({ content: undefined, embeds: [embed] });
}

// ── BOTONES DE INSCRIPCIÓN ────────────────────────────────────────────────────
async function handleInscripcionButton(interaction) {
  if (!interaction.isButton()) return;
  const isInscribir = interaction.customId.startsWith("inscribir_torneo:");
  const isSalir     = interaction.customId.startsWith("salir_torneo:");
  if (!isInscribir && !isSalir) return;

  // Verificar que el usuario tiene rol ROLAS
  const { ACTIVITY_ROLE_ID } = require("../config");
  if (!interaction.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return interaction.reply({ content: "❌ Este torneo es solo para **ROLAS**. No tienes el rol de actividad ROLAS.", ephemeral: true });

  const key  = interaction.customId.split(":").slice(1).join(":");
  const data = inscripcionesActivas.get(key);

  if (!data) return interaction.reply({ content: "❌ Las inscripciones para este torneo ya cerraron.", ephemeral: true });

  if (isInscribir) {
    if (data.inscritos.has(interaction.user.id))
      return interaction.reply({ content: "⚠️ Ya estás inscrito en este torneo.", ephemeral: true });
    if (data.maxJugadores && data.inscritos.size >= data.maxJugadores)
      return interaction.reply({ content: "❌ El torneo ya está lleno.", ephemeral: true });
    data.inscritos.add(interaction.user.id);
    return interaction.reply({ content: `✅ Te inscribiste en el torneo ROLAS. ¡Prepárate! (${data.inscritos.size}/${data.maxJugadores ?? "∞"})`, ephemeral: true });
  }

  if (!data.inscritos.has(interaction.user.id))
    return interaction.reply({ content: "⚠️ No estás inscrito en este torneo.", ephemeral: true });
  data.inscritos.delete(interaction.user.id);
  return interaction.reply({ content: `✅ Saliste de la inscripción. (${data.inscritos.size}/${data.maxJugadores ?? "∞"})`, ephemeral: true });
}

// ── MOTOR PRINCIPAL ───────────────────────────────────────────────────────────
let timers = [];

function startCalendarioTask(client) {
  timers.forEach(t => clearTimeout(t));
  timers = [];

  const ahora = ahoraEnSegs();

  EVENTOS.forEach(evento => {
    const eventoSegs = horaAMinutos(evento.hora) * 60;

    const notifs = [
      { offset: -10 * 60, cb: () => notificarPrevio(evento, "10min", client) },
      { offset: -3  * 60, cb: () => notificarPrevio(evento, "3min",  client) },
      { offset: 0, cb: async () => {
        if (evento.tipo === "torneo")                              await lanzarTorneoNormal(evento, client);
        else if (evento.tipo === "mega_torneo" || evento.tipo === "mega_battle") await lanzarMega(evento, client);
        else if (evento.tipo === "tormenta")                       await lanzarTormenta(client);
        else if (evento.tipo === "battle") {
          const canal = await client.channels.fetch(CANAL_CMD_ANUNCIOS).catch(() => null);
          if (canal) {
            await canal.send({ content: `!battle` });
            await canal.send({
              content: undefined,
              embeds: [new EmbedBuilder()
                .setColor(0xff6b00)
                .setTitle("💥 x1 Battle Royale")
                .setDescription(`¡**BATTLE ROYALE** comenzando ahora! → Rank **${evento.rank}**\n\n🎮 ¡Entren al canal de voz!`)
                .setTimestamp()]
            });
          }
        } else if (evento.tipo === "drop") {
          const canal = await client.channels.fetch(CANAL_CMD_ANUNCIOS).catch(() => null);
          if (canal) {
            await canal.send({ content: `!drop` });
            await canal.send({
              content: undefined,
              embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("🎁 DROP DEL DÍA")
                .setDescription(`¡**DROP DEL DÍA** disponible ahora! → Rank **${evento.rank}**\n\n🎮 ¡Entren al canal de voz!`)
                .setTimestamp()]
            });
          }
        }
      }},
    ];

    notifs.forEach(({ offset, cb }) => {
      let diff = (eventoSegs + offset) - ahora;
      if (diff < 0) diff += 24 * 60 * 60;
      const t = setTimeout(async () => { try { await cb(); } catch(e) { console.error("[CALENDARIO]", e.message); } }, diff * 1000);
      timers.push(t);
    });
  });

  // Re-programar al día siguiente
  const t24 = setTimeout(() => startCalendarioTask(client), 24 * 60 * 60 * 1000);
  timers.push(t24);

  console.log(`[CALENDARIO] ${EVENTOS.length * 3} notificaciones programadas.`);
}

module.exports = { startCalendarioTask, handleInscripcionButton, EVENTOS };
