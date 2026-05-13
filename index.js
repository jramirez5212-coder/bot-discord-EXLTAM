require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const fs = require('fs');

const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error('Falta TOKEN en el archivo .env');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

const COLOR = 0x00ff3c;

const config = {
  guildId:   '1455775938200473606',
  guildName: 'EXLATAM / #300K?',

  staffBandasRoleId: '1479568728340431100',

  postulacionesPanelChannelId: '1503502893616070729',
  postulacionesChannelId:      '1503480237307203665',
  categoriaAprobadosId:        '1503482480169189607',
  categoriaRechazadosId:       '1503482612721782894',

  // Canal donde el bot notifica TODO lo que hace
  botLogsChannelId: '1484299743440928768',

  vozPermitida: [
    '1469434005228355738',
    '1484442211452977155',
    '1495580121468375221',
    '1495897246498291953',
    '1495897305272946899'
  ],

  logoUrl:   'https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png',
  bannerUrl: 'https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png'
};

// Comandos manuales — solo staff/admin
const COMANDOS = ['!panel'];

const questions = [
  'Nombre:',
  'Residencia/País?:',
  'Edad (**mínimo 15**):',
  '5 Clips o 1HG:',
  'Foto de las horas de FiveM:',
  'Foto KD (**mínimo 1.8**):',
  'Link Steam Público:',
  'Tiempo Disponible?:'
];

const appFile      = './applications.json';



/* ═══════════════════════════════════════════════════
   BOT LOGS
   Notifica en el canal 1484299743440928768 todo
   lo que hace el bot, con origen auto o manual.
═══════════════════════════════════════════════════ */

async function botLog(emoji, titulo, detalle = '', origen = 'auto', ejecutadoPor = null) {
  try {
    const channel = await client.channels.fetch(config.botLogsChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const origenTexto = origen === 'manual'
      ? `🖐️ Manual${ejecutadoPor ? ` — ${ejecutadoPor}` : ''}`
      : '🤖 Automático';

    const embed = new EmbedBuilder()
      .setColor(origen === 'manual' ? 0xf0a500 : COLOR)
      .setAuthor({ name: 'EXLATAM Bot — Log', iconURL: config.logoUrl })
      .setTitle(`${emoji} ${titulo}`)
      .addFields(
        { name: 'Origen', value: origenTexto,   inline: true },
        { name: 'Hora',   value: colombiaTime(), inline: true },
        { name: 'Fecha',  value: colombiaDate(), inline: true }
      )
      .setFooter({ text: config.guildName, iconURL: config.logoUrl })
      .setTimestamp();

    if (detalle) embed.setDescription(detalle);

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.log('⚠️ botLog error:', e.message);
  }
}

/* ═══════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════ */

async function syncMessages(channel, embeds, metaKey) {
  const meta   = loadMeta();
  const oldIds = meta[metaKey] || [];

  for (const id of oldIds) {
    const old = await channel.messages.fetch(id).catch(() => null);
    if (old) await old.delete().catch(() => null);
  }

  const newIds = [];
  for (const embed of embeds) {
    const msg = await channel.send({ embeds: [embed] });
    newIds.push(msg.id);
  }

  meta[metaKey] = newIds;
  saveMeta(meta);
}

function isStaffMember(member) {
  return (
    member?.roles?.cache?.has(config.staffBandasRoleId) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

/* ═══════════════════════════════════════════════════
   POSTULACIONES
═══════════════════════════════════════════════════ */

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: 'EXLATAM Postulaciones', iconURL: config.logoUrl })
    .setTitle('📝 Sistema de Postulaciones')
    .setDescription(
      '**Bienvenido al sistema oficial de postulaciones de EXLATAM.**\n\n' +
      'Presiona el botón de abajo para iniciar. El bot te hará las preguntas una por una por DM.\n\n' +
      'Cuando termines, tu postulación llegará al equipo de staff para aprobarla o rechazarla.'
    )
    .setThumbnail(config.logoUrl)
    .setImage(config.bannerUrl)
    .setFooter({ text: 'EXLATAM • Sistema de Postulaciones', iconURL: config.logoUrl });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_postulacion')
      .setLabel('Iniciar postulación')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

async function sendAutoPostulacionesPanel(origen = 'auto', ejecutadoPor = null) {
  const channel = await client.channels.fetch(config.postulacionesPanelChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const meta  = loadMeta();
  let  accion = 'creado';

  if (meta.postulacionesPanelMessageId) {
    const oldMsg = await channel.messages.fetch(meta.postulacionesPanelMessageId).catch(() => null);
    if (oldMsg) {
      await oldMsg.edit(buildPanel());
      accion = 'actualizado';
    } else {
      const msg = await channel.send(buildPanel());
      meta.postulacionesPanelMessageId = msg.id;
      saveMeta(meta);
    }
  } else {
    const msg = await channel.send(buildPanel());
    meta.postulacionesPanelMessageId = msg.id;
    saveMeta(meta);
  }

  await botLog('📝', `Panel de postulaciones ${accion}`, `Canal: <#${config.postulacionesPanelChannelId}>`, origen, ejecutadoPor);
}

function questionEmbed(index) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: 'EXLATAM Postulaciones', iconURL: config.logoUrl })
    .setTitle('📝 | Postulación')
    .setDescription(
      `**${index + 1}/${questions.length}. ${questions[index]}**\n\n` +
      'Responde enviando un mensaje. Puedes enviar texto, links o imágenes.'
    )
    .setFooter({ text: config.guildName, iconURL: config.logoUrl });
}

async function askQuestion(userId) {
  const apps = loadApps();
  const app  = apps[userId];
  if (!app) return;
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;
  await user.send({ embeds: [questionEmbed(app.current)] });
}

function buildApplicationEmbed(user, app) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: 'Nueva postulación recibida', iconURL: config.logoUrl })
    .setTitle('📝 Postulación EXLATAM')
    .setDescription(questions.map((q, i) => `**${q}**\n${app.answers[i] || 'Sin respuesta'}`).join('\n\n'))
    .addFields(
      { name: 'Usuario', value: `<@${user.id}>`, inline: true },
      { name: 'ID',      value: user.id,          inline: true },
      { name: 'Estado',  value: '`Pendiente`',     inline: true }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: config.guildName, iconURL: config.logoUrl })
    .setTimestamp();
}

function decisionButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`aprobar_${userId}`).setLabel('Aprobar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rechazar_${userId}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
  );
}

function resultTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cerrar_resultado_ticket').setLabel('Cerrar ticket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('renombrar_resultado_ticket').setLabel('Renombrar ticket').setStyle(ButtonStyle.Primary)
  );
}

function renameModal() {
  const modal = new ModalBuilder().setCustomId('modal_rename_resultado').setTitle('Renombrar ticket');
  const input = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('Nuevo nombre del canal')
    .setPlaceholder('Ejemplo: aprobado-juan')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function canStaff(interaction) {
  return (
    interaction.member?.roles?.cache?.has(config.staffBandasRoleId) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function getTicketUserId(channel) {
  return channel.topic?.match(/postulacionUser:(\d+)/)?.[1] || null;
}

async function sendApplicationToStaff(userId) {
  const apps = loadApps();
  const app  = apps[userId];
  if (!app) return;

  const user    = await client.users.fetch(userId).catch(() => null);
  const channel = await client.channels.fetch(config.postulacionesChannelId).catch(() => null);
  if (!user || !channel?.isTextBased()) return;

  try {
    const msg = await channel.send({
      content:    `<@&${config.staffBandasRoleId}> Nueva postulación de <@${userId}>`,
      embeds:     [buildApplicationEmbed(user, app)],
      components: [decisionButtons(userId)]
    });
    app.staffMessageId = msg.id;
    app.status         = 'pendiente';
    apps[userId]       = app;
    saveApps(apps);
    await botLog('📨', 'Postulación enviada al staff', `Usuario: <@${userId}>`, 'auto');
  } catch (e) {
    console.log('❌ Error enviando postulación:', e.message);
  }
}

async function createResultTicket(userId, status, staffUser) {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const user  = await client.users.fetch(userId).catch(() => null);
    if (!user) return null;

    const approved   = status === 'aprobada';
    const categoryId = approved ? config.categoriaAprobadosId : config.categoriaRechazadosId;

    const channel = await guild.channels.create({
      name:   `${approved ? 'aprobado' : 'rechazado'}-${cleanName(user.username)}`,
      type:   ChannelType.GuildText,
      parent: categoryId,
      topic:  `postulacionUser:${userId} | status:${status} | staff:${staffUser.id} | createdAt:${Date.now()}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        { id: config.staffBandasRoleId, allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(approved ? COLOR : 0xff3c3c)
      .setAuthor({ name: 'EXLATAM Postulaciones', iconURL: config.logoUrl })
      .setTitle(approved ? '✅ Postulación Aprobada' : '❌ Postulación Rechazada')
      .setDescription(
        approved
          ? `Tu postulación fue **aprobada** por ${staffUser}.\n\nAhora pasas a la **segunda etapa del proceso**, la cual se realizará por **llamada**.\n\nCuando el staff te notifique, deberás entrar a la **sala de espera** para continuar con la entrevista.`
          : `Tu postulación fue **rechazada** por ${staffUser}.\n\nPuedes usar este ticket para preguntar el motivo o apelar la decisión de forma respetuosa.`
      )
      .setThumbnail(config.logoUrl)
      .setFooter({ text: config.guildName, iconURL: config.logoUrl })
      .setTimestamp();

    await channel.send({ content: `<@${userId}> <@&${config.staffBandasRoleId}>`, embeds: [embed], components: [resultTicketButtons()] });

    await botLog(
      approved ? '✅' : '❌',
      `Ticket ${approved ? 'aprobado' : 'rechazado'} creado`,
      `Usuario: <@${userId}> | Staff: ${staffUser} | Canal: ${channel}`,
      'auto'
    );

    return channel;
  } catch (e) {
    console.log('❌ ERROR CREANDO TICKET:', e.message);
    return null;
  }
}

async function sendRejectAppealDM(user, staffUser) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`apelar_rechazo_${user.id}`).setLabel('Apelar rechazo').setStyle(ButtonStyle.Primary)
  );
  await user.send({
    content:
      `❌ Su :pencil:｜Postulación fue rechazada por ${staffUser}.\n\n` +
      `Si consideras que hubo un error en la revisión o quieres explicar mejor tu caso, puedes apelar el rechazo presionando el botón de abajo.`,
    components: [row]
  }).catch(() => null);
}

async function startFeedback(userId, status, staffId) {
  const apps = loadApps();
  apps[userId] = apps[userId] || {};
  apps[userId].feedback = { active: true, step: 0, status, staffId, answers: [] };
  saveApps(apps);
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;
  await user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: 'EXLATAM Postulaciones', iconURL: config.logoUrl })
        .setTitle('⭐ Califica la atención')
        .setDescription('El ticket fue cerrado.\n\nDel **1 al 5**, ¿cómo calificas la atención recibida?')
        .setFooter({ text: config.guildName, iconURL: config.logoUrl })
    ]
  }).catch(() => null);
}

async function sendFeedbackToStaff(userId) {
  const apps = loadApps();
  const app  = apps[userId];
  if (!app?.feedback) return;

  const channel = await client.channels.fetch(config.postulacionesChannelId).catch(() => null);
  const user    = await client.users.fetch(userId).catch(() => null);
  if (!channel?.isTextBased() || !user) return;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: 'Feedback de postulación', iconURL: config.logoUrl })
        .setTitle('⭐ Calificación recibida')
        .addFields(
          { name: 'Usuario',                value: `<@${userId}>`,                       inline: true  },
          { name: 'Estado',                 value: app.feedback.status || 'No definido', inline: true  },
          { name: 'Staff',                  value: `<@${app.feedback.staffId}>`,          inline: true  },
          { name: 'Calificación',           value: app.feedback.answers[0] || 'Sin calificación', inline: false },
          { name: 'Sugerencia / Comentario',value: app.feedback.answers[1] || 'Sin comentario',  inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
    ]
  });

  await botLog('⭐', 'Feedback recibido', `<@${userId}> — Calificación: ${app.feedback.answers[0] || '?'}`, 'auto');

  delete app.feedback;
  apps[userId] = app;
  saveApps(apps);
}



═══════════════════════════════════════════════════ */

client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  if (!member.roles.cache.has(config.rolActividadId)) return;

  const before     = oldState.channelId;
  const after      = newState.channelId;
  const wasTracked = before && config.vozPermitida.includes(before);
  const isTracked  = after  && config.vozPermitida.includes(after);

  const data = loadActivity();
  if (!data[member.id]) {
    data[member.id] = { totalMs: 0, weekMs: 0, lastSeen: null, joinedAt: null, warningCount: 0, lastWarningAt: null, days: {} };
  }

  const info  = data[member.id];
  const today = colombiaDate();
  if (!info.days[today]) info.days[today] = { totalMs: 0, sessions: [] };

  if (!wasTracked && isTracked) {
    info.joinedAt   = Date.now();
    info.currentDay = today;
    info.currentIn  = colombiaTime();
    await botLog('🎙️', 'Entró a voz', `${member} entró a las ${info.currentIn}`, 'auto');
  }

  if (wasTracked && !isTracked && info.joinedAt) {
    const now      = Date.now();
    const duration = now - info.joinedAt;
    const day      = info.currentDay || today;

    if (!info.days[day]) info.days[day] = { totalMs: 0, sessions: [] };

    info.totalMs  = (info.totalMs || 0) + duration;
    info.weekMs   = (info.weekMs  || 0) + duration;
    info.lastSeen = now;
    info.warningCount = 0;

    info.days[day].totalMs = (info.days[day].totalMs || 0) + duration;
    info.days[day].sessions.push({ in: info.currentIn || 'No registrado', out: colombiaTime(), duration });

    await botLog('🔇', 'Salió de voz', `${member} — sesión: **${formatDuration(duration)}** | total hoy: ${formatDuration(info.days[day].totalMs)}`, 'auto');

    info.joinedAt   = null;
    info.currentDay = null;
    info.currentIn  = null;
  }

  data[member.id] = info;
  saveActivity(data);

  setTimeout(() => {
    updateTopSemanal(false, 'auto').catch(() => null);
    updateActividadDiariaEmbed('auto').catch(() => null);
  }, 3000);
});


/* ═══════════════════════════════════════════════════
   MENSAJES — comandos manuales + DM postulaciones
═══════════════════════════════════════════════════ */

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ── Comandos manuales (servidor, solo staff) ───────────────────────────────
  if (message.guild && COMANDOS.includes(message.content.trim().toLowerCase())) {
    if (!isStaffMember(message.member)) {
      return message.reply('❌ No tienes permisos para usar este comando.').catch(() => null);
    }

    const cmd     = message.content.trim().toLowerCase();
    const mencion = `<@${message.author.id}>`;
    const reply   = await message.reply('⏳ Ejecutando...').catch(() => null);

    try {
      if      (cmd === '!panel')     await sendAutoPostulacionesPanel('manual', mencion);

      await reply?.edit('✅ Listo.').catch(() => null);
    } catch (e) {
      console.log(`⚠️ Error en ${cmd}:`, e.message);
      await reply?.edit(`❌ Error: ${e.message}`).catch(() => null);
    }
    return;
  }

  // ── DMs — flujo de postulaciones ──────────────────────────────────────────
  if (message.guild) return;

  const userId = message.author.id;
  const apps   = loadApps();
  const app    = apps[userId];
  if (!app) return;

  if (app.feedback?.active) {
    app.feedback.answers.push(answerFromMessage(message));

    if (app.feedback.step === 0) {
      app.feedback.step = 1;
      apps[userId] = app;
      saveApps(apps);
      return message.author.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle('📝 Sugerencia')
            .setDescription('Ahora escribe una sugerencia o comentario sobre la atención recibida.')
            .setFooter({ text: config.guildName, iconURL: config.logoUrl })
        ]
      }).catch(() => null);
    }

    await message.author.send('✅ Gracias por tu calificación.').catch(() => null);
    apps[userId] = app;
    saveApps(apps);
    await sendFeedbackToStaff(userId);
    return;
  }

  if (app.status !== 'respondiendo') return;

  app.answers.push(answerFromMessage(message));
  app.current += 1;

  if (app.current >= questions.length) {
    app.status = 'enviada';
    apps[userId] = app;
    saveApps(apps);

    await message.author.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setAuthor({ name: 'EXLATAM Postulaciones', iconURL: config.logoUrl })
          .setTitle('✅ Postulación enviada')
          .setDescription('Tu postulación fue enviada correctamente. Espera respuesta del staff.')
          .setFooter({ text: config.guildName, iconURL: config.logoUrl })
      ]
    }).catch(() => null);

    await sendApplicationToStaff(userId);
    return;
  }

  apps[userId] = app;
  saveApps(apps);
  await askQuestion(userId);
});

/* ═══════════════════════════════════════════════════
   INTERACTIONS
═══════════════════════════════════════════════════ */

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_rename_resultado') {
        if (!canStaff(interaction)) return interaction.reply({ content: 'Solo el staff puede renombrar este ticket.', ephemeral: true });
        const newName = cleanName(interaction.fields.getTextInputValue('new_name'));
        if (!newName) return interaction.reply({ content: 'Nombre inválido.', ephemeral: true });
        await interaction.channel.setName(newName);
        await botLog('✏️', 'Ticket renombrado', `**${newName}** por <@${interaction.user.id}>`, 'manual', `<@${interaction.user.id}>`);
        return interaction.reply({ content: `✅ Canal renombrado a **${newName}**.`, ephemeral: true });
      }
      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'start_postulacion') {
      await interaction.deferReply({ ephemeral: true });
      const apps = loadApps();
      apps[interaction.user.id] = { status: 'respondiendo', current: 0, answers: [], createdAt: Date.now() };
      saveApps(apps);
      try {
        await askQuestion(interaction.user.id);
        await botLog('📝', 'Postulación iniciada', `<@${interaction.user.id}> inició una postulación`, 'auto');
        return interaction.editReply({ content: '📩 Te envié las preguntas por mensaje privado. Revisa tus DMs.' });
      } catch {
        delete apps[interaction.user.id];
        saveApps(apps);
        return interaction.editReply({ content: 'No pude enviarte DM. Activa los mensajes privados del servidor e intenta otra vez.' });
      }
    }

    if (interaction.customId.startsWith('apelar_rechazo_')) {
      const userId = interaction.customId.replace('apelar_rechazo_', '');
      if (interaction.user.id !== userId) return interaction.reply({ content: 'Este botón no es para ti.', ephemeral: true });
      const apps      = loadApps();
      const staffId   = apps[userId]?.lastRejectStaffId || client.user.id;
      const staffUser = await client.users.fetch(staffId).catch(() => client.user);
      const ticket    = await createResultTicket(userId, 'rechazada', staffUser);
      await botLog('🔄', 'Apelación creada', `<@${userId}> apeló su rechazo`, 'auto');
      return interaction.reply({ content: `✅ Se creó tu ticket de apelación: ${ticket}`, ephemeral: true });
    }

    if (interaction.customId === 'cerrar_resultado_ticket') {
      if (!canStaff(interaction)) return interaction.reply({ content: 'Solo el staff puede cerrar este ticket.', ephemeral: true });
      const userId = getTicketUserId(interaction.channel);
      await interaction.reply({ content: 'Cerrando ticket y pidiendo calificación...', ephemeral: true });
      if (userId) {
        const status = interaction.channel.topic?.match(/status:([a-zA-Z]+)/)?.[1] || 'cerrada';
        await startFeedback(userId, status, interaction.user.id);
      }
      await botLog('🔒', 'Ticket cerrado', `${interaction.channel.name} | Staff: <@${interaction.user.id}>`, 'manual', `<@${interaction.user.id}>`);
      setTimeout(() => interaction.channel.delete().catch(() => null), 3000);
      return;
    }

    if (interaction.customId === 'renombrar_resultado_ticket') {
      if (!canStaff(interaction)) return interaction.reply({ content: 'Solo el staff puede renombrar este ticket.', ephemeral: true });
      return interaction.showModal(renameModal());
    }

    if (interaction.customId.startsWith('aprobar_') || interaction.customId.startsWith('rechazar_')) {
      if (!canStaff(interaction)) return interaction.reply({ content: 'No tienes permisos para revisar postulaciones.', ephemeral: true });

      const approved = interaction.customId.startsWith('aprobar_');
      const userId   = interaction.customId.split('_')[1];
      const user     = await client.users.fetch(userId).catch(() => null);
      if (!user) return interaction.reply({ content: 'No encontré al usuario.', ephemeral: true });

      if (approved) {
        await user.send({
          content:
            `✅ Su :pencil:｜Postulación fue aprobada por ${interaction.user}.\n\n` +
            `Se creó un ticket para continuar con el proceso. La segunda etapa será por llamada.`
        }).catch(() => null);
        const ticket = await createResultTicket(userId, 'aprobada', interaction.user);
        await interaction.message.edit({ components: [] }).catch(() => null);
        return interaction.reply({ content: `✅ Postulación aprobada. Ticket: ${ticket}`, ephemeral: true });
      }

      await sendRejectAppealDM(user, interaction.user);
      const apps = loadApps();
      apps[userId] = apps[userId] || {};
      apps[userId].lastRejectStaffId = interaction.user.id;
      apps[userId].status     = 'rechazada';
      apps[userId].reviewedAt = Date.now();
      saveApps(apps);
      await interaction.message.edit({ components: [] }).catch(() => null);
      return interaction.reply({ content: '❌ Postulación rechazada. DM con botón de apelación enviado.', ephemeral: true });
    }

  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Ocurrió un error.', ephemeral: true }).catch(() => null);
    }
  }
});

/* ═══════════════════════════════════════════════════
   READY
═══════════════════════════════════════════════════ */

client.once('clientReady', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  await botLog(
    '🟢',
    'Bot iniciado',
    `Conectado como **${client.user.tag}**
Sistema de postulaciones cargado correctamente`,
    'auto'
  );

  await sendAutoPostulacionesPanel('auto').catch(e =>
    console.log('⚠️ panel:', e.message)
  );

  setInterval(() =>
    sendAutoPostulacionesPanel('auto').catch(e =>
      console.log('⚠️ panel:', e.message)
    ),
    10 * 60 * 1000
  );
});

client.on('error', error => console.log('⚠️ Error del cliente:', error.message));
process.on('unhandledRejection', error => console.log('⚠️ Promesa rechazada:', error?.message || error));

client.login(TOKEN);
