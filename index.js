const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');

const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error('Falta TOKEN en Railway');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

const EMBED_COLOR = 0x00ff3c;
const COLOR = EMBED_COLOR;

const config = {
  guildName: 'EXLATAM / #300K?',
  guildId: '1469434046638461231',

  welcomeChannelId: '1469434029475496209',

  staffBandasRoleId: '1479568728340431100',

  postulacionesPanelChannelId: '1503502893616070729',
  postulacionesChannelId: '1503480237307203665',
  categoriaAprobadosId: '1503482480169189607',
  categoriaRechazadosId: '1503482612721782894',

  botLogsChannelId: '1484299743440928768',

  logoUrl:
    'https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png?ex=6a00e170&is=69ff8ff0&hm=50f5e8ba4101bb15b3d05c648a5ad13ef57f8408b2cfad94431a2effe219bab6&',

  bannerUrl:
    'https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png?ex=6a00ff8a&is=69ffae0a&hm=f54d7a23160bfc30fdd22e438104f200f5e8cc1970985179fba540aae6af1904&'
};

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

const ticketTypes = {
  reportes: {
    label: 'Reportes',
    emoji: '⛔',
    categoryId: '1469433997191811308',
    roleId: '1469433860293918921',
    description:
      '⚠️ **Cuéntanos en qué te podemos ayudar.**\n\n' +
      '~ Usuario reportado:\n' +
      '~ Motivo del reporte:\n' +
      '~ Pruebas / clips:\n' +
      '~ Explicación completa de lo sucedido:'
  },

  compras: {
    label: 'Compras',
    emoji: '<:emoji_24:1486354461558308944>',
    categoryId: '1469433995371483320',
    roleId: '1481851324395163759',
    description:
      '⚠️ **Mientras tanto dinos qué te gustaría comprar de la tienda:**\n\n' +
      '~ Producto:\n' +
      '~ Cantidad:\n' +
      '~ Método de pago:\n' +
      '~ ¿Está en stock?:'
  },

  partners: {
    label: 'Partners',
    emoji: '🤝',
    categoryId: '1469433998722732279',
    roleId: '1469433860293918921',
    description:
      '⚠️ **Solicitud de partner**\n\n' +
      '~ Nombre del servidor:\n' +
      '~ Invitación:\n' +
      '~ Miembros:\n' +
      '~ ¿Qué tipo de alianza quieres hacer?:\n' +
      '~ ¿Qué puedes ofrecer como partner?:'
  }
};

const appFile = './applications.json';
const metaFile = './rolas_meta.json';

for (const file of [appFile, metaFile]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}));
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadApps() {
  return loadJson(appFile);
}

function saveApps(data) {
  saveJson(appFile, data);
}

function loadMeta() {
  return loadJson(metaFile);
}

function saveMeta(data) {
  saveJson(metaFile, data);
}

function colombiaDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function colombiaTime() {
  return new Date().toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function todayFooter(memberCount) {
  const now = new Date();
  const time = now.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `Ahora somos ${memberCount} miembros • hoy a las ${time}`;
}

function cleanName(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 35);
}

function cleanChannelName(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function answerFromMessage(message) {
  const text = message.content?.trim() || '';
  const files = message.attachments.map(a => a.url);
  return [text, ...files].filter(Boolean).join('\n') || 'Sin respuesta';
}

function isStaffMember(member) {
  return (
    member?.roles?.cache?.has(config.staffBandasRoleId) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

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
        { name: 'Origen', value: origenTexto, inline: true },
        { name: 'Hora', value: colombiaTime(), inline: true },
        { name: 'Fecha', value: colombiaDate(), inline: true }
      )
      .setFooter({ text: config.guildName, iconURL: config.logoUrl })
      .setTimestamp();

    if (detalle) embed.setDescription(detalle);

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.log('⚠️ botLog error:', error.message);
  }
}

function getTicketTypeFromChannel(channel) {
  if (!channel?.topic) return null;

  const match = channel.topic.match(/ticketType:([a-zA-Z0-9_-]+)/);
  if (!match) return null;

  return match[1];
}

function canManageThisTicket(interaction) {
  if (!interaction.member) return false;

  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const type = getTicketTypeFromChannel(interaction.channel);
  if (!type) return false;

  const ticket = ticketTypes[type];
  if (!ticket) return false;

  return interaction.member.roles.cache.has(ticket.roleId);
}

function buildRenameTicketModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_rename_ticket')
    .setTitle('Renombrar ticket');

  const input = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('Nuevo nombre del canal')
    .setPlaceholder('Ejemplo: reporte-juan')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return modal;
}

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

  const meta = loadMeta();
  let accion = 'creado';

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
  const app = apps[userId];
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
      { name: 'ID', value: user.id, inline: true },
      { name: 'Estado', value: '`Pendiente`', inline: true }
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

function renameResultModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_rename_resultado')
    .setTitle('Renombrar ticket');

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
  const app = apps[userId];
  if (!app) return;

  const user = await client.users.fetch(userId).catch(() => null);
  const channel = await client.channels.fetch(config.postulacionesChannelId).catch(() => null);
  if (!user || !channel?.isTextBased()) return;

  try {
    const msg = await channel.send({
      content: `<@&${config.staffBandasRoleId}> Nueva postulación de <@${userId}>`,
      embeds: [buildApplicationEmbed(user, app)],
      components: [decisionButtons(userId)]
    });

    app.staffMessageId = msg.id;
    app.status = 'pendiente';
    apps[userId] = app;
    saveApps(apps);

    await botLog('📨', 'Postulación enviada al staff', `Usuario: <@${userId}>`, 'auto');
  } catch (error) {
    console.log('❌ Error enviando postulación:', error.message);
  }
}

async function createResultTicket(userId, status, staffUser) {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return null;

    const approved = status === 'aprobada';
    const categoryId = approved ? config.categoriaAprobadosId : config.categoriaRechazadosId;

    const channel = await guild.channels.create({
      name: `${approved ? 'aprobado' : 'rechazado'}-${cleanName(user.username)}`,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: `postulacionUser:${userId} | status:${status} | staff:${staffUser.id} | createdAt:${Date.now()}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: config.staffBandasRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.AttachFiles,
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

    await channel.send({
      content: `<@${userId}> <@&${config.staffBandasRoleId}>`,
      embeds: [embed],
      components: [resultTicketButtons()]
    });

    await botLog(
      approved ? '✅' : '❌',
      `Ticket ${approved ? 'aprobado' : 'rechazado'} creado`,
      `Usuario: <@${userId}> | Staff: ${staffUser} | Canal: ${channel}`,
      'auto'
    );

    return channel;
  } catch (error) {
    console.log('❌ ERROR CREANDO TICKET:', error.message);
    return null;
  }
}

async function sendRejectAppealDM(user, staffUser) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`apelar_rechazo_${user.id}`)
      .setLabel('Apelar rechazo')
      .setStyle(ButtonStyle.Primary)
  );

  await user.send({
    content:
      `❌ Su :pencil:｜Postulación fue rechazada por ${staffUser}.\n\n` +
      'Si consideras que hubo un error en la revisión o quieres explicar mejor tu caso, puedes apelar el rechazo presionando el botón de abajo.',
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
  const app = apps[userId];
  if (!app?.feedback) return;

  const channel = await client.channels.fetch(config.postulacionesChannelId).catch(() => null);
  const user = await client.users.fetch(userId).catch(() => null);
  if (!channel?.isTextBased() || !user) return;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: 'Feedback de postulación', iconURL: config.logoUrl })
        .setTitle('⭐ Calificación recibida')
        .addFields(
          { name: 'Usuario', value: `<@${userId}>`, inline: true },
          { name: 'Estado', value: app.feedback.status || 'No definido', inline: true },
          { name: 'Staff', value: `<@${app.feedback.staffId}>`, inline: true },
          { name: 'Calificación', value: app.feedback.answers[0] || 'Sin calificación', inline: false },
          { name: 'Sugerencia / Comentario', value: app.feedback.answers[1] || 'Sin comentario', inline: false }
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

client.once('clientReady', async () => {
  console.log('✅ BOT NUEVO EXLATAM V2');
  console.log(`✅ Conectado como ${client.user.tag}`);

  await botLog(
    '🟢',
    'Bot iniciado',
    `Conectado como **${client.user.tag}**\nPostulaciones y tickets cargados correctamente`,
    'auto'
  );

  await sendAutoPostulacionesPanel('auto').catch(error =>
    console.log('⚠️ panel postulaciones:', error.message)
  );

  setInterval(() => {
    sendAutoPostulacionesPanel('auto').catch(error =>
      console.log('⚠️ panel postulaciones:', error.message)
    );
  }, 10 * 60 * 1000);
});

client.on('guildMemberAdd', async member => {
  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n` +
      `*si quieres postular acá lo puedes hacer:* <#${config.postulacionesPanelChannelId}>`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage(config.bannerUrl)
    .setFooter({
      text: todayFooter(member.guild.memberCount)
    });

  await channel.send({
    content: `${member} **Bienvenido a** __${config.guildName}__ 🚙`,
    embeds: [embed]
  });
});

function ticketPanel() {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('<:emoji_16:1486354271351078923> SISTEMA TICKETS EXLATAM')
    .setDescription(
      '<:emoji_13:1485010590358568970>  *Si deseas abrir algun ticket lo puedes hacer presionando los botones de abajo:*\n\n' +
      '```INFORMACION IMPORTANTE```\n' +
      '<:emoji_6:1485010432514326558> __Postulaciones:__ Usa el panel de postulaciones para iniciar por DM.\n' +
      '<:emoji_6:1485010432514326558> __Reportes:__ Reportar alguna inconformidad.\n' +
      '<:emoji_6:1485010432514326558> __Compras:__ Compras en nuestra tienda.\n' +
      '<:emoji_6:1485010432514326558> __Partners:__ Alianzas entre discord (PUBLICIDAD).\n\n' +
      '👇 **SELECCIONA EL TICKET QUE NECESITAS** 👇'
    )
    .setThumbnail(config.logoUrl)
    .setImage(config.bannerUrl)
    .setFooter({
      text: 'TICKETS'
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_reportes')
      .setLabel('Reportes')
      .setEmoji('⛔')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('ticket_compras')
      .setLabel('Compras')
      .setEmoji('🛍️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('ticket_partners')
      .setLabel('Partners')
      .setEmoji('🤝')
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.guild && message.content.trim().toLowerCase() === '!panel') {
    if (!isStaffMember(message.member)) {
      return message.reply('❌ No tienes permisos para usar este comando.').catch(() => null);
    }

    await sendAutoPostulacionesPanel('manual', `<@${message.author.id}>`);
    return message.reply('✅ Panel de postulaciones enviado/actualizado.').catch(() => null);
  }

  if (message.guild && message.content === '!paneltickets') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('No tienes permisos.');
    }

    await message.channel.send(ticketPanel());
    return message.reply('✅ Panel enviado.');
  }

  if (message.guild) return;

  const userId = message.author.id;
  const apps = loadApps();
  const app = apps[userId];
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

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_rename_ticket') {
        if (!canManageThisTicket(interaction)) {
          return interaction.reply({
            content: 'No tienes permisos para renombrar este ticket.',
            ephemeral: true
          });
        }

        const rawName = interaction.fields.getTextInputValue('new_name');
        const newName = cleanChannelName(rawName);

        if (!newName) {
          return interaction.reply({
            content: 'Nombre inválido.',
            ephemeral: true
          });
        }

        await interaction.channel.setName(newName);

        return interaction.reply({
          content: `✅ Canal renombrado a **${newName}**.`,
          ephemeral: true
        });
      }

      if (interaction.customId === 'modal_rename_resultado') {
        if (!canStaff(interaction)) {
          return interaction.reply({
            content: 'Solo el staff puede renombrar este ticket.',
            ephemeral: true
          });
        }

        const newName = cleanName(interaction.fields.getTextInputValue('new_name'));
        if (!newName) {
          return interaction.reply({
            content: 'Nombre inválido.',
            ephemeral: true
          });
        }

        await interaction.channel.setName(newName);
        await botLog('✏️', 'Ticket renombrado', `**${newName}** por <@${interaction.user.id}>`, 'manual', `<@${interaction.user.id}>`);

        return interaction.reply({
          content: `✅ Canal renombrado a **${newName}**.`,
          ephemeral: true
        });
      }

      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'start_postulacion') {
      await interaction.deferReply({ ephemeral: true });

      const apps = loadApps();
      apps[interaction.user.id] = {
        status: 'respondiendo',
        current: 0,
        answers: [],
        createdAt: Date.now()
      };
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
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'Este botón no es para ti.', ephemeral: true });
      }

      const apps = loadApps();
      const staffId = apps[userId]?.lastRejectStaffId || client.user.id;
      const staffUser = await client.users.fetch(staffId).catch(() => client.user);
      const ticket = await createResultTicket(userId, 'rechazada', staffUser);

      await botLog('🔄', 'Apelación creada', `<@${userId}> apeló su rechazo`, 'auto');
      return interaction.reply({ content: `✅ Se creó tu ticket de apelación: ${ticket}`, ephemeral: true });
    }

    if (interaction.customId === 'cerrar_resultado_ticket') {
      if (!canStaff(interaction)) {
        return interaction.reply({ content: 'Solo el staff puede cerrar este ticket.', ephemeral: true });
      }

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
      if (!canStaff(interaction)) {
        return interaction.reply({ content: 'Solo el staff puede renombrar este ticket.', ephemeral: true });
      }

      return interaction.showModal(renameResultModal());
    }

    if (interaction.customId.startsWith('aprobar_') || interaction.customId.startsWith('rechazar_')) {
      if (!canStaff(interaction)) {
        return interaction.reply({ content: 'No tienes permisos para revisar postulaciones.', ephemeral: true });
      }

      const approved = interaction.customId.startsWith('aprobar_');
      const userId = interaction.customId.split('_')[1];
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) {
        return interaction.reply({ content: 'No encontré al usuario.', ephemeral: true });
      }

      if (approved) {
        await user.send({
          content:
            `✅ Su :pencil:｜Postulación fue aprobada por ${interaction.user}.\n\n` +
            'Se creó un ticket para continuar con el proceso. La segunda etapa será por llamada.'
        }).catch(() => null);

        const ticket = await createResultTicket(userId, 'aprobada', interaction.user);
        await interaction.message.edit({ components: [] }).catch(() => null);

        return interaction.reply({ content: `✅ Postulación aprobada. Ticket: ${ticket}`, ephemeral: true });
      }

      await sendRejectAppealDM(user, interaction.user);

      const apps = loadApps();
      apps[userId] = apps[userId] || {};
      apps[userId].lastRejectStaffId = interaction.user.id;
      apps[userId].status = 'rechazada';
      apps[userId].reviewedAt = Date.now();
      saveApps(apps);

      await interaction.message.edit({ components: [] }).catch(() => null);

      return interaction.reply({ content: '❌ Postulación rechazada. DM con botón de apelación enviado.', ephemeral: true });
    }

    if (interaction.customId === 'cerrar_ticket') {
      if (!canManageThisTicket(interaction)) {
        return interaction.reply({
          content: 'Solo el staff encargado de este ticket puede cerrarlo.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: 'Cerrando ticket...',
        ephemeral: true
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => null);
      }, 3000);

      return;
    }

    if (interaction.customId === 'renombrar_ticket') {
      if (!canManageThisTicket(interaction)) {
        return interaction.reply({
          content: 'Solo el staff encargado de este ticket puede renombrarlo.',
          ephemeral: true
        });
      }

      return interaction.showModal(buildRenameTicketModal());
    }

    if (!interaction.customId.startsWith('ticket_')) return;

    const type = interaction.customId.replace('ticket_', '');
    const ticket = ticketTypes[type];

    if (!ticket) return;

    const existing = interaction.guild.channels.cache.find(
      channel =>
        channel.topic &&
        channel.topic.includes(`ticketOwner:${interaction.user.id}`) &&
        channel.topic.includes(`ticketType:${type}`)
    );

    if (existing) {
      return interaction.reply({
        content: `Ya tienes un ticket abierto: ${existing}`,
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `${type}-${cleanChannelName(interaction.user.username)}`,
      type: ChannelType.GuildText,
      parent: ticket.categoryId,
      topic: `ticketOwner:${interaction.user.id} | ticketType:${type}`,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: ticket.roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`${ticket.emoji} ${ticket.label}`)
      .setDescription(ticket.description)
      .setThumbnail(config.logoUrl)
      .setFooter({
        text: config.guildName
      });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('cerrar_ticket')
        .setLabel('Cerrar')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('renombrar_ticket')
        .setLabel('Renombrar')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: `<@${interaction.user.id}> Has abierto un ticket de (${ticket.emoji} **${ticket.label}**). Espera que un <@&${ticket.roleId}> te atienda.`,
      embeds: [embed],
      components: [buttons]
    });

    await interaction.reply({
      content: `✅ Ticket creado en ${channel}`,
      ephemeral: true
    });
  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Ocurrió un error ejecutando esta acción.',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

client.on('error', error => console.log('⚠️ Error del cliente:', error.message));
process.on('unhandledRejection', error => console.log('⚠️ Promesa rechazada:', error?.message || error));

client.login(TOKEN);
