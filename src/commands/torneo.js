const {
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { loadData, saveData, getUser } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, LOGO_URL }  = require("../config");

const ROL_TORNEO_ID  = "1504721382368481331";
const cooldowns      = new Map();
const COOLDOWN_MS    = 60 * 1000;
const torneosActivos = new Map();

// ── !torneo ──────────────────────────────────────────────────────
async function handleTorneo(message) {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== "!torneo") return;

  if (!message.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return message.reply("❌ No tienes permiso para usar este comando.");

  const key    = `torneo:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    const segs = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
    const aviso = await message.reply(`⏳ Espera **${segs} segundos**.`);
    setTimeout(() => { try { aviso.delete(); } catch {} }, 5000);
    try { await message.delete(); } catch {}
    return;
  }
  cooldowns.set(key, Date.now());

  // Borrar el comando
  try { await message.delete(); } catch {}

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle("🏆 Crear Torneo")
    .setDescription("Presiona el botón para configurar el torneo.")
    .setThumbnail(LOGO_URL)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_torneo:${message.author.id}`)
      .setLabel("Crear torneo")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🏆")
  );

  const msg = await message.channel.send({ embeds: [embed], components: [row] });

  // Borrar el mensaje con botón después de 2 min si no se usa
  setTimeout(async () => {
    try { await msg.delete(); } catch {}
  }, 2 * 60 * 1000);
}

// ── Interacciones ────────────────────────────────────────────────
async function handleTorneoInteraction(interaction, client) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  // Botón abrir modal
  if (interaction.isButton() && interaction.customId.startsWith("btn_torneo:")) {
    const ownerId = interaction.customId.split(":")[1];
    if (interaction.user.id !== ownerId)
      return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId("modal_torneo")
      .setTitle("🏆 Crear Torneo");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("nombre")
          .setLabel("Nombre del torneo")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Ej: Torneo de Drift")
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("cupo")
          .setLabel("¿Cuántos jugadores? (ej: 2, 3, 4, 6...)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Ej: 4")
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  // Modal torneo submit → borrar mensaje con botón y crear embed torneo
  if (interaction.isModalSubmit() && interaction.customId === "modal_torneo") {
    const nombre  = interaction.fields.getTextInputValue("nombre");
    const cupoStr = interaction.fields.getTextInputValue("cupo");
    const cupo    = parseInt(cupoStr);

    if (isNaN(cupo) || cupo < 2 || cupo > 50)
      return interaction.reply({ content: "❌ El cupo debe ser un número entre 2 y 50.", ephemeral: true });

    // Borrar el mensaje con el botón "Crear torneo"
    try { await interaction.message?.delete(); } catch {}

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Torneo: ${nombre}`)
      .setColor(0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(
        `<@&${ACTIVITY_ROLE_ID}> **¡Se abre el torneo!**\n\n` +
        `Presiona el botón para inscribirte.\n` +
        `**Cupo:** 0 / ${cupo}`
      )
      .addFields(
        { name: "🎮 Nombre",      value: nombre,                inline: true },
        { name: "👥 Cupo total",  value: `${cupo} jugadores`,  inline: true },
        { name: "👤 Organizador", value: `${interaction.user}`, inline: true },
        { name: "✅ Inscritos",   value: "*Nadie aún*",         inline: false },
      )
      .setTimestamp()
      .setFooter({ text: "Presiona el botón para unirte" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("unirse_torneo")
        .setLabel(`Unirse (0/${cupo})`)
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎮")
    );

    await interaction.reply({ content: `<@&${ACTIVITY_ROLE_ID}>`, embeds: [embed], components: [row] });

    const msg = await interaction.fetchReply();
    torneosActivos.set(msg.id, {
      cupo, nombre,
      jugadores:   [],
      channelId:   interaction.channelId,
      organizador: interaction.user.id,
    });
    return;
  }

  // Botón unirse al torneo
  if (interaction.isButton() && interaction.customId === "unirse_torneo") {
    const torneo = torneosActivos.get(interaction.message.id);
    if (!torneo)
      return interaction.reply({ content: "❌ Este torneo ya no está activo.", ephemeral: true });

    if (torneo.jugadores.includes(interaction.user.id))
      return interaction.reply({ content: "⚠️ Ya estás inscrito.", ephemeral: true });

    torneo.jugadores.push(interaction.user.id);

    // Dar rol de torneo al jugador
    try {
      await interaction.member.roles.add(ROL_TORNEO_ID);
    } catch {}

    const inscritos = torneo.jugadores.map(id => `<@${id}>`).join("\n");
    const lleno     = torneo.jugadores.length >= torneo.cupo;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Torneo: ${torneo.nombre}`)
      .setColor(lleno ? 0xe74c3c : 0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(
        lleno
          ? `🔴 **¡Cupo lleno!**\n**Cupo:** ${torneo.jugadores.length} / ${torneo.cupo}`
          : `<@&${ACTIVITY_ROLE_ID}> **¡Se abre el torneo!**\nPresiona el botón para inscribirte.\n**Cupo:** ${torneo.jugadores.length} / ${torneo.cupo}`
      )
      .addFields(
        { name: "🎮 Nombre",      value: torneo.nombre,                               inline: true },
        { name: "👥 Cupo",        value: `${torneo.jugadores.length}/${torneo.cupo}`, inline: true },
        { name: "👤 Organizador", value: `<@${torneo.organizador}>`,                 inline: true },
        { name: "✅ Inscritos",   value: inscritos,                                   inline: false },
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("unirse_torneo")
        .setLabel(`Unirse (${torneo.jugadores.length}/${torneo.cupo})`)
        .setStyle(lleno ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji("🎮")
        .setDisabled(lleno)
    );

    await interaction.update({ embeds: [embed], components: [row] });

    if (lleno) {
      // Contar torneo jugado
      const data = loadData();
      for (const userId of torneo.jugadores) {
        const ud = getUser(data, userId);
        ud.torneosJugados = (ud.torneosJugados || 0) + 1;
      }
      saveData(data);

      // Embed cupo lleno
      try {
        const canal = await client.channels.fetch(torneo.channelId);
        const embedFinal = new EmbedBuilder()
          .setTitle(`🏆 ¡Torneo ${torneo.nombre} — Cupo Lleno!`)
          .setColor(0xf1c40f)
          .setThumbnail(LOGO_URL)
          .setDescription(`El torneo **${torneo.nombre}** ya tiene sus **${torneo.cupo} jugadores**.\n\n¡Que empiece! 🎮`)
          .addFields({ name: "👥 Participantes", value: inscritos })
          .setTimestamp();
        await canal.send({ embeds: [embedFinal] });
      } catch {}

      // Después de 10 minutos: quitar roles y enviar embed final
      setTimeout(async () => {
        torneosActivos.delete(interaction.message.id);

        // Quitar rol de torneo a todos los jugadores
        try {
          const guild = await client.guilds.fetch(interaction.guildId);
          for (const userId of torneo.jugadores) {
            try {
              const member = await guild.members.fetch(userId);
              await member.roles.remove(ROL_TORNEO_ID);
            } catch {}
          }
        } catch {}

        // Embed de fin de torneo
        try {
          const canal = await client.channels.fetch(torneo.channelId);
          const embedEnd = new EmbedBuilder()
            .setTitle(`⏱️ Torneo ${torneo.nombre} — Finalizado`)
            .setColor(0x95a5a6)
            .setThumbnail(LOGO_URL)
            .setDescription(`El torneo ha terminado. ¡Gracias a todos! 🎮\n\nSe removió el rol de torneo a los participantes.`)
            .addFields({ name: "👥 Participantes", value: inscritos })
            .setTimestamp();
          await canal.send({ embeds: [embedEnd] });
        } catch {}

      }, 10 * 60 * 1000);
    }
  }
}

module.exports = { handleTorneo, handleTorneoInteraction };
