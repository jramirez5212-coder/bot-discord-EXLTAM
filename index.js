const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = '1469434046638461231';

if (!TOKEN) throw new Error('Falta TOKEN en Railway');
if (!CLIENT_ID) throw new Error('Falta CLIENT_ID en Railway');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const config = {
  guildName: 'LineaRojaRp V.2',

  trackedRoleIds: ['1469433888949665976'],
  activityChannelId: '1502906373846077582',
  inactivityLogsId: '1502906524001898537',
  inactiveDays: 7,

  welcomeChannelId: '1469434029475496209',

  // CAMBIA ESTE ID por el canal donde quieres mandar el panel de tickets
  ticketPanelChannelId: '1469434006331330561',

  transcriptChannelId: '1469434006331330561',

  categories: {
    soporte: 'CATEGORY_ID_SOPORTE',
    reportes: 'CATEGORY_ID_REPORTES',
    donaciones: 'CATEGORY_ID_DONACIONES',
    apelar: 'CATEGORY_ID_APELAR',
    staff: 'CATEGORY_ID_STAFF',
    bugs: 'CATEGORY_ID_BUGS',
    recompensa: 'CATEGORY_ID_RECOMPENSA'
  },

  staffRoles: {
    soporte: 'STAFF_ROLE_SOPORTE',
    reportes: 'STAFF_ROLE_REPORTES',
    donaciones: 'STAFF_ROLE_DONACIONES',
    apelar: 'STAFF_ROLE_APELAR',
    staff: 'STAFF_ROLE_STAFF',
    bugs: 'STAFF_ROLE_BUGS',
    recompensa: 'STAFF_ROLE_RECOMPENSA'
  },

  logoUrl: 'https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png',
  bannerUrl: 'https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png'
};

const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const ACTIVITY_MSG = path.join(__dirname, 'activity_message.json');

function ensureFile(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function readJson(file, fallback) {
  ensureFile(file, fallback);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isTracked(member) {
  return config.trackedRoleIds.some(id => member.roles.cache.has(id));
}

function recordVoiceActivity(userId) {
  const data = readJson(ACTIVITY_FILE, {});

  if (!data[userId]) {
    data[userId] = {
      sessions: 0,
      lastSeen: null,
      warned: false
    };
  }

  data[userId].sessions += 1;
  data[userId].lastSeen = Date.now();
  data[userId].warned = false;

  writeJson(ACTIVITY_FILE, data);
}

function getSortedActivity() {
  const data = readJson(ACTIVITY_FILE, {});

  return Object.entries(data)
    .map(([userId, d]) => ({ userId, ...d }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

function daysSince(timestamp) {
  if (!timestamp) return Infinity;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function formatDate(timestamp) {
  if (!timestamp) return 'Nunca';
  return new Date(timestamp).toLocaleString('es-CO', { hour12: true });
}

function buildActivityEmbed() {
  const list = getSortedActivity();

  const lines = list.map((entry, i) => {
    const dias = daysSince(entry.lastSeen);
    const estado = dias >= config.inactiveDays ? '🔴' : dias >= 3 ? '🟡' : '🟢';

    return `${estado} **${i + 1}.** <@${entry.userId}> — ${entry.sessions} sesión(es) — última: ${formatDate(entry.lastSeen)}`;
  });

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('📊 Actividad de Miembros — Voz')
    .setDescription(lines.length ? lines.join('\n') : 'Sin registros de actividad aún.')
    .setThumbnail(config.logoUrl)
    .setFooter({
      text: `${config.guildName} • 🟢 Activo  🟡 +3 días  🔴 Inactivo (+7 días)`
    })
    .setTimestamp();
}

async function updateActivityEmbed() {
  const channel = await client.channels.fetch(config.activityChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const db = readJson(ACTIVITY_MSG, {});
  const embed = buildActivityEmbed();

  if (db.messageId) {
    const old = await channel.messages.fetch(db.messageId).catch(() => null);

    if (old) {
      await old.edit({ embeds: [embed] });
      return;
    }
  }

  const msg = await channel.send({ embeds: [embed] });
  writeJson(ACTIVITY_MSG, { messageId: msg.id });
}

async function checkInactivity() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const logsChannel = await guild.channels.fetch(config.inactivityLogsId).catch(() => null);
  const data = readJson(ACTIVITY_FILE, {});
  let changed = false;

  for (const [userId, entry] of Object.entries(data)) {
    if (entry.warned) continue;
    if (daysSince(entry.lastSeen) < config.inactiveDays) continue;

    data[userId].warned = true;
    changed = true;

    const member = await guild.members.fetch(userId).catch(() => null);
    const dias = daysSince(entry.lastSeen);

    if (member) {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('⚠️ Advertencia de Inactividad')
            .setDescription(
              `Hola **${member.user.username}**,\n\n` +
              `Llevas **${dias} días** sin conectarte a voz en **${config.guildName}**.\n\n` +
              `Por favor conectate pronto para no perder tu lugar.`
            )
            .setThumbnail(config.logoUrl)
            .setTimestamp()
        ]
      }).catch(() => null);
    }

    if (logsChannel?.isTextBased()) {
      await logsChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🔴 Miembro Inactivo')
            .setDescription(`<@${userId}> lleva **${dias} días** sin conectarse a voz.`)
            .setThumbnail(config.logoUrl)
            .setTimestamp()
        ]
      }).catch(() => null);
    }
  }

  if (changed) writeJson(ACTIVITY_FILE, data);
}

async function sendTicketPanel() {
  const channel = await client.channels.fetch(config.ticketPanelChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🎫 Sistema de Tickets')
    .setDescription(
      '**Selecciona una opción para abrir un ticket.**\n\n' +
      '📌 Soporte\n' +
      '🚨 Reportes\n' +
      '💸 Donaciones\n' +
      '⛔ Apelar ban\n' +
      '🛡️ Staff\n' +
      '🐞 Bugs\n' +
      '🎁 Recompensa'
    )
    .setThumbnail(config.logoUrl)
    .setImage(config.bannerUrl)
    .setFooter({ text: config.guildName })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_soporte').setLabel('Soporte').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_reportes').setLabel('Reportes').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_donaciones').setLabel('Donaciones').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_apelar').setLabel('Apelar').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_staff').setLabel('Staff').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_bugs').setLabel('Bugs').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_recompensa').setLabel('Recompensa').setStyle(ButtonStyle.Success)
  );

  await channel.send({
    embeds: [embed],
    components: [row1, row2]
  });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const member = interaction.member;

  const categoryId = config.categories[type];
  const staffRoleId = config.staffRoles[type];

  const channelName = `ticket-${type}-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const existing = guild.channels.cache.find(ch => ch.name === channelName);
  if (existing) {
    return interaction.reply({
      content: `Ya tienes un ticket abierto: ${existing}`,
      ephemeral: true
    });
  }

  const permissionOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (staffRoleId && !staffRoleId.includes('STAFF_ROLE')) {
    permissionOverwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    });
  }

  const channelData = {
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites
  };

  if (categoryId && !categoryId.includes('CATEGORY_ID')) {
    channelData.parent = categoryId;
  }

  const ticketChannel = await guild.channels.create(channelData);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`🎫 Ticket de ${type}`)
    .setDescription(
      `Hola ${member}, gracias por abrir un ticket.\n\n` +
      `Un miembro del staff te atenderá pronto.\n\n` +
      `**Categoría:** ${type}`
    )
    .setThumbnail(config.logoUrl)
    .setFooter({ text: config.guildName })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Cerrar ticket')
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${member} ${staffRoleId && !staffRoleId.includes('STAFF_ROLE') ? `<@&${staffRoleId}>` : ''}`,
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: `Ticket creado: ${ticketChannel}`,
    ephemeral: true
  });
}

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  await updateActivityEmbed();
  await checkInactivity();

  setInterval(updateActivityEmbed, 5 * 60 * 1000);
  setInterval(checkInactivity, 60 * 60 * 1000);
});

client.on('guildMemberAdd', async member => {
  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`👋 Bienvenido a ${config.guildName}`)
    .setDescription(
      `Bienvenido ${member}.\n\n` +
      `Esperamos que disfrutes tu estadía en el servidor. Lee las reglas y pásala bien.`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage(config.bannerUrl)
    .setFooter({ text: `Ahora somos ${member.guild.memberCount} miembros` })
    .setTimestamp();

  await channel.send({
    content: `${member}`,
    embeds: [embed]
  });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  if (!isTracked(member)) return;

  const before = oldState.channelId;
  const after = newState.channelId;

  if (!before && after) {
    recordVoiceActivity(member.id);
    await updateActivityEmbed();
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('ticket_')) {
    const type = interaction.customId.replace('ticket_', '');
    await createTicket(interaction, type);
  }

  if (interaction.customId === 'close_ticket') {
    await interaction.reply({
      content: 'Cerrando ticket en 5 segundos...',
      ephemeral: true
    });

    setTimeout(() => {
      interaction.channel.delete().catch(() => null);
    }, 5000);
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!paneltickets') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('No tienes permisos para usar este comando.');
    }

    await sendTicketPanel();
    await message.reply('✅ Panel de tickets enviado.');
  }
});

client.login(TOKEN);
