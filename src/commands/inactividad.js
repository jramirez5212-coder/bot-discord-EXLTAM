const {
  EmbedBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { ACTIVITY_ROLE_ID, CANAL_INACTIVIDAD_ID, CANAL_CMD_INACTIVO,
        BANNER_INACTIVIDAD, ROL_INACTIVO_ID,
        GUILD_ID }             = require("../config");

const excusasActivas = new Map();
const cooldowns      = new Map();
const COOLDOWN_MS    = 60 * 1000;
const btnMessages    = new Map();

async function handleInactividad(message) {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== "!inactivo") return;

  if (!message.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return message.reply("❌ No tienes permiso para usar este comando.");

  if (message.channel.id !== CANAL_CMD_INACTIVO) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_INACTIVO}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const key    = `inactivo:${message.author.id}`;
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
    .setColor(0x39ff3c).setTitle("📋 Justificación de Inactividad")
    .setDescription("Presiona el botón para llenar el formulario de inactividad.")
    .setImage(BANNER_INACTIVIDAD).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_inactivo:${message.author.id}`)
      .setLabel("Llenar formulario")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📋")
  );

  const msg = await message.channel.send({ embeds: [embed], components: [row] });
  btnMessages.set(message.author.id, msg);
  setTimeout(async () => { try { await msg.delete(); } catch {} btnMessages.delete(message.author.id); }, 2 * 60 * 1000);
}

async function handleInactividadButton(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("btn_inactivo:")) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId("modal_inactividad")
    .setTitle("📋 Justificación de Inactividad");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("razon").setLabel("¿Cuál es tu razón de inactividad?")
        .setStyle(TextInputStyle.Paragraph).setPlaceholder("Ej: Viaje, trabajo, salud...").setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("desde").setLabel("¿Desde qué fecha? (YYYY-MM-DD)")
        .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 2026-05-15").setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("hasta").setLabel("¿Hasta qué fecha? (YYYY-MM-DD)")
        .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 2026-05-20").setRequired(true)
    )
  );
  await interaction.showModal(modal);
}

async function handleInactividadModal(interaction, client) {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== "modal_inactividad") return;

  const razon = interaction.fields.getTextInputValue("razon");
  const desde = interaction.fields.getTextInputValue("desde").trim();
  const hasta = interaction.fields.getTextInputValue("hasta").trim();

  // ── Validar formato de fechas YYYY-MM-DD ─────────────────────────────────
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!regexFecha.test(desde) || !regexFecha.test(hasta)) {
    return interaction.reply({
      content: `❌ **Formato de fecha incorrecto.**\n\nDebes usar el formato \`YYYY-MM-DD\`.\n✅ Correcto: \`2026-06-20\`\n❌ Incorrecto: \`20-06-2026\`, \`20/06/26\`, \`junio 20\`\n\nVuelve a usar \`!inactivo\` con las fechas correctas.`,
      ephemeral: true
    });
  }

  const desdeDate = new Date(desde + "T00:00:00-05:00");
  const hastaDate = new Date(hasta + "T00:00:00-05:00");
  const hoyDate   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  hoyDate.setHours(0,0,0,0);

  // Verificar que las fechas son válidas
  if (isNaN(desdeDate.getTime()) || isNaN(hastaDate.getTime())) {
    return interaction.reply({
      content: `❌ **Fechas inválidas.** Asegúrate de poner fechas reales en formato \`YYYY-MM-DD\`.`,
      ephemeral: true
    });
  }

  // Verificar que la fecha hasta no sea anterior a hoy
  if (hastaDate < hoyDate) {
    return interaction.reply({
      content: `❌ **La fecha de regreso ya pasó.** Pusiste \`${hasta}\` como fecha de regreso pero ya es pasado.\n\nSi ya regresaste, no necesitas registrar inactividad.`,
      ephemeral: true
    });
  }

  // Verificar que hasta sea después de desde
  if (hastaDate < desdeDate) {
    return interaction.reply({
      content: `❌ **La fecha de regreso (\`${hasta}\`) es anterior a la fecha de inicio (\`${desde}\`).** Verifica las fechas.`,
      ephemeral: true
    });
  }

  excusasActivas.set(interaction.user.id, { hasta, razon, desde });

  // Borrar mensaje con botón
  const btnMsg = btnMessages.get(interaction.user.id);
  if (btnMsg) { try { await btnMsg.delete(); } catch {} btnMessages.delete(interaction.user.id); }

  // Quitar rol de actividad y dar rol de inactivo
  let msHasta = 0;
  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    await member.roles.remove(ACTIVITY_ROLE_ID).catch(() => {});
    await member.roles.add(ROL_INACTIVO_ID).catch(() => {});

    msHasta = hastaDate.getTime() - Date.now();
    if (msHasta > 0) {
      setTimeout(async () => {
        try {
          const guildFresh  = await client.guilds.fetch(GUILD_ID);
          const memberFresh = await guildFresh.members.fetch(interaction.user.id);
          await memberFresh.roles.add(ACTIVITY_ROLE_ID).catch(() => {});
          await memberFresh.roles.remove(ROL_INACTIVO_ID).catch(() => {});
          excusasActivas.delete(interaction.user.id);
          console.log(`[INACTIVIDAD] Roles restaurados automáticamente: ${interaction.user.tag}`);
        } catch(e) { console.error("[INACTIVIDAD] Error restaurando roles:", e.message); }
      }, msHasta);
    }
  } catch(e) { console.error("[INACTIVIDAD] Error manejando roles:", e.message); }

  // Embed en canal de inactividad CON botón de regreso
  try {
    const canal = await client.channels.fetch(CANAL_CMD_INACTIVO);
    if (canal) {
      const embed = new EmbedBuilder()
        .setColor(0x39ff3c).setTitle("📋 Justificación de Inactividad")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setImage(BANNER_INACTIVIDAD)
        .addFields(
          { name: "👤 Miembro", value: `${interaction.user}`, inline: true },
          { name: "📅 Desde",   value: `\`${desde}\``,         inline: true },
          { name: "📅 Hasta",   value: `\`${hasta}\``,         inline: true },
          { name: "📝 Razón",   value: razon,                  inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `ID: ${interaction.user.id}` });

      const rowRegreso = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inactivo_regrese:${interaction.user.id}`)
          .setLabel("✅ Ya volví")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🏠")
      );

      await canal.send({ embeds: [embed], components: [rowRegreso] });
    }
  } catch(e) { console.error("[INACTIVIDAD] Error:", e.message); }

  await interaction.reply({
    content: `✅ Inactividad registrada del **${desde}** al **${hasta}**.\nSe te quitó el rol de actividad. Cuando regreses, presiona el botón **"✅ Ya volví"** en el canal para recuperar tu rol. Si no lo presionas, el sistema lo restaura automáticamente el **${hasta}**. 🙏`,
    ephemeral: true
  });
}

// Botón "Ya volví" — el usuario recupera su rol manualmente
async function handleRegresesButton(interaction, client) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("inactivo_regrese:")) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón es solo para quien registró la inactividad.", ephemeral: true });

  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    await member.roles.add(ACTIVITY_ROLE_ID).catch(() => {});
    await member.roles.remove(ROL_INACTIVO_ID).catch(() => {});
    excusasActivas.delete(interaction.user.id);

    // Deshabilitar el botón
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inactivo_regrese:${ownerId}`)
          .setLabel("✅ Regresó")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      );
      await interaction.update({ components: [disabledRow] });
    } catch {}

    await interaction.followUp({
      content: `🏠 **¡Bienvenido de vuelta ${interaction.user}!** Se te restauró el rol de actividad. ¡A jugar! 🎮`,
      ephemeral: false
    });
    console.log(`[INACTIVIDAD] Regreso manual: ${interaction.user.tag}`);
  } catch(e) {
    console.error("[INACTIVIDAD] Error en regreso:", e.message);
    if (!interaction.replied) await interaction.reply({ content: "❌ Error al restaurar tu rol, avisa al staff.", ephemeral: true }).catch(() => {});
  }
}

function isExcused(userId) {
  const excusa = excusasActivas.get(userId);
  if (!excusa) return false;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  if (hoy <= excusa.hasta) return true;
  excusasActivas.delete(userId);
  return false;
}

module.exports = { handleInactividad, handleInactividadButton, handleInactividadModal, handleRegresesButton, isExcused };
