const {
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { loadData, saveData, getUser } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, LOGO_URL, CANAL_CMD_TORNEO, GUILD_ID } = require("../config");

const ROL_TORNEO_ID  = "1504721382368481331";
const COOLDOWN_MS    = 60 * 1000;
const ESPERA_MS      = 15 * 1000; // 15 segundos por nivel
const cooldowns      = new Map();
const torneosActivos = new Map();

const NIVELES = [
  { id: "1469433867659116738", nombre: "Level 4", turno: 0 },
  { id: "1469433870142279926", nombre: "Level 3", turno: 1 },
  { id: "1469433882532380754", nombre: "Level 2", turno: 2 },
  { id: "1469433884109443196", nombre: "Level 1", turno: 3 },
];

function getNivelMember(member) {
  for (const nivel of NIVELES) {
    if (member.roles.cache.has(nivel.id)) return nivel;
  }
  return null;
}

function getTurnoActual(torneo) {
  const elapsed = Date.now() - torneo.startTime;
  return Math.min(Math.floor(elapsed / ESPERA_MS), NIVELES.length - 1);
}

function buildEmbed(torneo, cerrado = false) {
  const inscritos    = torneo.jugadores.map(id => `<@${id}>`).join("\n") || "*Nadie aún*";
  const turnoActual  = getTurnoActual(torneo);
  const msRestantes  = ESPERA_MS - ((Date.now() - torneo.startTime) % ESPERA_MS);
  const segs         = Math.ceil(msRestantes / 1000);

  let turnosText = "";
  NIVELES.forEach((n, i) => {
    if (i < turnoActual)        turnosText += `✅ ~~${n.nombre}~~\n`;
    else if (i === turnoActual) turnosText += `⏳ **${n.nombre}** — ${segs}s restantes\n`;
    else                        turnosText += `🔒 ${n.nombre}\n`;
  });

  return new EmbedBuilder()
    .setTitle(`🏆 Torneo: ${torneo.nombre}`)
    .setColor(cerrado ? 0xe74c3c : 0x39FF14)
    .setThumbnail(LOGO_URL)
    .setDescription(
      cerrado
        ? `🔴 **¡Cupo lleno!**\n**Cupo:** ${torneo.jugadores.length} / ${torneo.cupo}`
        : `**¡Se abre el torneo!** Presiona el botón para inscribirte.\n**Cupo:** ${torneo.jugadores.length} / ${torneo.cupo}`
    )
    .addFields(
      { name: "🎮 Nombre",      value: torneo.nombre,                               inline: true },
      { name: "👥 Cupo",        value: `${torneo.jugadores.length}/${torneo.cupo}`, inline: true },
      { name: "👤 Organizador", value: `<@${torneo.organizador}>`,                 inline: true },
      { name: "🏅 Turnos",      value: turnosText,                                  inline: false },
      { name: "✅ Inscritos",   value: inscritos,                                   inline: false },
    )
    .setTimestamp()
    .setFooter({ text: "Mayor nivel = más prioridad de entrada" });
}

// Guardar rol torneo en JSON para recuperar tras reinicio
function guardarRolTorneo(userId, expira) {
  const data = loadData();
  const ud   = getUser(data, userId);
  ud.torneoRolExpira = expira;
  saveData(data);
}

function limpiarRolTorneo(userId) {
  const data = loadData();
  if (data[userId]) {
    delete data[userId].torneoRolExpira;
    saveData(data);
  }
}

// Recuperar roles de torneo pendientes al arrancar el bot
async function recoverTorneoRoles(client) {
  try {
    const data  = loadData();
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    const ahora = Date.now();

    for (const userId in data) {
      const ud = data[userId];
      if (!ud.torneoRolExpira) continue;

      if (ud.torneoRolExpira <= ahora) {
        // Ya expiró — quitar rol ahora
        try {
          const member = guild.members.cache.get(userId);
          if (member) await member.roles.remove(ROL_TORNEO_ID);
        } catch {}
        delete ud.torneoRolExpira;
      } else {
        // Aún no expira — programar timeout
        const msRestante = ud.torneoRolExpira - ahora;
        setTimeout(async () => {
          try {
            const member = guild.members.cache.get(userId);
            if (member) await member.roles.remove(ROL_TORNEO_ID);
          } catch {}
          limpiarRolTorneo(userId);
        }, msRestante);
        console.log(`[TORNEO] Rol recuperado para ${userId}, expira en ${Math.ceil(msRestante/60000)}min`);
      }
    }
    saveData(data);
  } catch(e) { console.error("[TORNEO] Error recuperando roles:", e.message); }
}

async function handleTorneo(message) {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== "!torneo") return;

  if (!message.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return message.reply("❌ No tienes permiso para usar este comando.");

  if (message.channel.id !== CANAL_CMD_TORNEO) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_TORNEO}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const key    = `torneo:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    const segs  = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
    const aviso = await message.reply(`⏳ Espera **${segs} segundos**.`);
    setTimeout(() => { try { aviso.delete(); } catch {} }, 5000);
    try { await message.delete(); } catch {}
    return;
  }
  cooldowns.set(key, Date.now());
  try { await message.delete(); } catch {}

  const embed = new EmbedBuilder()
    .setColor(0x39FF14).setTitle("🏆 Crear Torneo")
    .setDescription("Presiona el botón para configurar el torneo.")
    .setThumbnail(LOGO_URL).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_torneo:${message.author.id}`)
      .setLabel("Crear torneo").setStyle(ButtonStyle.Primary).setEmoji("🏆")
  );

  const msg = await message.channel.send({ embeds: [embed], components: [row] });
  setTimeout(async () => { try { await msg.delete(); } catch {} }, 2 * 60 * 1000);
}

async function handleTorneoInteraction(interaction, client) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  // Botón abrir modal
  if (interaction.isButton() && interaction.customId.startsWith("btn_torneo:")) {
    const ownerId = interaction.customId.split(":")[1];
    if (interaction.user.id !== ownerId)
      return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

    const modal = new ModalBuilder().setCustomId("modal_torneo").setTitle("🏆 Crear Torneo");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("nombre").setLabel("Nombre del torneo")
          .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 5v5").setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("cupo").setLabel("¿Cuántos jugadores?")
          .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 10").setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId === "modal_torneo") {
    const nombre = interaction.fields.getTextInputValue("nombre");
    const cupo   = parseInt(interaction.fields.getTextInputValue("cupo"));
    if (isNaN(cupo) || cupo < 2 || cupo > 50)
      return interaction.reply({ content: "❌ El cupo debe ser entre 2 y 50.", ephemeral: true });

    try { await interaction.message?.delete(); } catch {}

    const torneo = {
      cupo, nombre,
      jugadores:   [],
      channelId:   interaction.channelId,
      organizador: interaction.user.id,
      startTime:   Date.now(),
    };

    await interaction.reply({
      content: `<@&${ACTIVITY_ROLE_ID}> 🏆 **¡Nuevo torneo: ${nombre}!**`,
      embeds:  [buildEmbed(torneo)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("unirse_torneo")
          .setLabel(`Unirse (0/${cupo})`).setStyle(ButtonStyle.Success).setEmoji("🎮")
      )]
    });

    const msg = await interaction.fetchReply();
    torneo.messageId = msg.id;
    torneosActivos.set(msg.id, torneo);

    // Actualizar embed cada 15 segundos para mostrar tiempo restante
    const intervalo = setInterval(async () => {
      const t = torneosActivos.get(msg.id);
      if (!t) { clearInterval(intervalo); return; }
      try {
        const canal = await client.channels.fetch(t.channelId);
        const m     = await canal.messages.fetch(msg.id);
        const row   = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("unirse_torneo")
            .setLabel(`Unirse (${t.jugadores.length}/${t.cupo})`)
            .setStyle(ButtonStyle.Success).setEmoji("🎮")
        );
        await m.edit({ embeds: [buildEmbed(t)], components: [row] });
      } catch { clearInterval(intervalo); }
    }, 15 * 1000);

    // Cerrar inscripciones después de 4 minutos si no se llena
    setTimeout(async () => {
      const t = torneosActivos.get(msg.id);
      if (!t) return;
      clearInterval(intervalo);
      try {
        const canal = await client.channels.fetch(t.channelId);
        const m     = await canal.messages.fetch(msg.id);
        await m.edit({
          embeds: [buildEmbed(t, true).setTitle(`🏆 Torneo: ${t.nombre} — Inscripciones cerradas`)
            .setColor(0x95a5a6)
            .setDescription(`⏱️ **Inscripciones cerradas.**\n\nParticipantes finales: **${t.jugadores.length}**`)],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("unirse_torneo")
              .setLabel("Inscripciones cerradas").setStyle(ButtonStyle.Secondary)
              .setEmoji("🔒").setDisabled(true)
          )]
        });
        await canal.send({ embeds: [new EmbedBuilder()
          .setTitle(`🏆 Torneo ${t.nombre} — Lista final`)
          .setColor(0xf1c40f).setThumbnail(LOGO_URL)
          .setDescription(`Participantes (${t.jugadores.length}):\n${t.jugadores.map(id=>`<@${id}>`).join("\n")||"*Nadie se inscribió*"}`)
          .setTimestamp()] });
      } catch {}
      torneosActivos.delete(msg.id);
    }, 4 * 60 * 1000);

    return;
  }

  // Botón unirse
  if (interaction.isButton() && interaction.customId === "unirse_torneo") {
    const torneo = torneosActivos.get(interaction.message.id);
    if (!torneo) return interaction.reply({ content: "❌ Las inscripciones ya cerraron.", ephemeral: true });
    if (torneo.jugadores.includes(interaction.user.id))
      return interaction.reply({ content: "⚠️ Ya estás inscrito.", ephemeral: true });

    // Verificar nivel del usuario
    const nivelMember  = getNivelMember(interaction.member);
    const turnoActual  = getTurnoActual(torneo);
    const nivelActual  = NIVELES[turnoActual];

    if (!nivelMember) {
      return interaction.reply({
        content: `❌ No tienes ningún level asignado. Habla con el staff para obtener tu level.`,
        ephemeral: true
      });
    }

    // Verificar si es su turno
    if (nivelMember.turno > turnoActual) {
      const msHastasuTurno = (nivelMember.turno - turnoActual) * ESPERA_MS -
        ((Date.now() - torneo.startTime) % ESPERA_MS);
      const segsRestantes = Math.ceil(msHastasuTurno / 1000);
      return interaction.reply({
        content: `⏳ Aún no es tu turno. Eres **${nivelMember.nombre}**, tu turno abre en **${segsRestantes}s**.\n\n💪 *¡Sé más activo para subir de rango y tener más prioridad!*`,
        ephemeral: true
      });
    }

    torneo.jugadores.push(interaction.user.id);

    // Dar rol de torneo y guardar en JSON para recuperar tras reinicio
    const expira = Date.now() + 10 * 60 * 1000;
    try { await interaction.member.roles.add(ROL_TORNEO_ID); } catch {}
    guardarRolTorneo(interaction.user.id, expira);

    // Programar quitar rol en 10 minutos
    setTimeout(async () => {
      try {
        const guild  = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(interaction.user.id);
        await member.roles.remove(ROL_TORNEO_ID);
      } catch {}
      limpiarRolTorneo(interaction.user.id);
    }, 10 * 60 * 1000);

    const lleno   = torneo.jugadores.length >= torneo.cupo;
    const inscritos = torneo.jugadores.map(id => `<@${id}>`).join("\n");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("unirse_torneo")
        .setLabel(`Unirse (${torneo.jugadores.length}/${torneo.cupo})`)
        .setStyle(lleno ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji("🎮").setDisabled(lleno)
    );

    await interaction.update({ embeds: [buildEmbed(torneo, lleno)], components: [row] });

    if (lleno) {
      // Contar torneo jugado
      const data = loadData();
      for (const uid of torneo.jugadores) {
        const ud = getUser(data, uid);
        ud.torneosJugados = (ud.torneosJugados || 0) + 1;
      }
      saveData(data);

      try {
        const canal = await client.channels.fetch(torneo.channelId);
        await canal.send({
          content: `<@&${ACTIVITY_ROLE_ID}>`,
          embeds: [new EmbedBuilder()
            .setTitle(`🏆 ¡Torneo ${torneo.nombre} — Cupo Lleno!`)
            .setColor(0xf1c40f).setThumbnail(LOGO_URL)
            .setDescription(`El torneo ya tiene sus **${torneo.cupo} jugadores**. ¡Que empiece! 🎮`)
            .addFields({ name: "👥 Participantes", value: inscritos })
            .setTimestamp()]
        });
      } catch {}

      torneosActivos.delete(interaction.message.id);
    }
  }
}

module.exports = { handleTorneo, handleTorneoInteraction, recoverTorneoRoles };
