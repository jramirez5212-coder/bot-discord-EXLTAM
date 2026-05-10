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
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const GUILD_ID = '1469434046638461231';
const EMBED_COLOR = 0x00ff3c;

if (!TOKEN) throw new Error('Falta TOKEN en Railway');
if (!CLIENT_ID) throw new Error('Falta CLIENT_ID en Railway');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const config = {
  guildName: 'EXLATAM / #300K?',

  trackedRoleIds: ['1469433888949665976'],

  activityChannelId: '1502906373846077582',
  inactivityLogsId: '1502906524001898537',
  inactiveDays: 7,

  bannerWelcomeChannelId: '1469434029475496209',
  transcriptChannelId: '1469434006331330561',

  logoUrl: 'https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png?ex=6a00e170&is=69ff8ff0&hm=50f5e8ba4101bb15b3d05c648a5ad13ef57f8408b2cfad94431a2effe219bab6&',
  bannerUrl: 'https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png?ex=6a00ff8a&is=69ffae0a&hm=f54d7a23160bfc30fdd22e438104f200f5e8cc1970985179fba540aae6af1904&'
};

const ticketTypes = {
  postulaciones: {
    name: 'postulaciones',
    label: 'Postulaciones',
    emoji: '🌀',
    categoryId: '1469433993911865556',
    roleId: '1469433858352222379',
    title: '🌀 Postulaciones',
    description:
      '<:emoji_16:1486354271351078923>  *Si estás interesado en postular __rellena la siguiente información:__*\n' +
      '~ Nombre:\n' +
      '~ Edad (**minimo 15**):\n' +
      '~ 5 Clips o 1HG:\n' +
      '~ Foto de las horas de FiveM:\n' +
      '~ Foto KD (**minimo 1.8**):\n' +
      '~ Link Steam Público:\n' +
      '~ Tiempo Disponible?:'
  },

  reportes: {
    name: 'reportes',
    label: 'Reportes',
    emoji: '⛔️',
    categoryId: '1469433997191811308',
    roleId: '1469433860293918921',
    title: '⛔️ Reportes',
    description:
      '⚠️ **Cuéntanos en qué te podemos ayudar.**\n\n' +
      '~ Usuario reportado:\n' +
      '~ Motivo del reporte:\n' +
      '~ Pruebas / clips:\n' +
      '~ Explicación completa de lo sucedido:'
  },

  compras: {
    name: 'compras',
    label: 'Compras',
    emoji: '<:emoji_24:1486354461558308944>',
    categoryId: '1469433995371483320',
    roleId: '1481851324395163759',
    title: '<:emoji_24:1486354461558308944> Compras',
    description:
      '⚠️ **Mientras tanto dinos qué te gustaría comprar de la tienda:**\n\n' +
      '~ Producto:\n' +
      '~ Cantidad:\n' +
      '~ Método de pago:\n' +
      '~ ¿Está en stock?:\n\n' +
      '>> Llena esta información para atenderte de manera más rápida.'
  },

  partner: {
    name: 'partner',
    label: 'Partners',
    emoji: '🤝',
    categoryId: '1469433998722732279',
    roleId: '1469433860293918921',
    title: '🤝 Partners',
    description:
      '⚠️ **Solicitud de partner**\n\n' +
      '~ Nombre del servidor / comunidad:\n' +
      '~ Link del servidor:\n' +
      '~ Cantidad de miembros:\n' +
      '~ ¿Qué tipo de alianza quieres hacer?:\n' +
      '~ ¿Qué puedes ofrecer como partner?:'
  }
};

const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const ACTIVITY_MSG = path.join(__dirname, 'activity_message.json');
const CLAIMS_FILE = path.join(__dirname, 'claims.json');

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

function sanitizeChannelName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function isTracked(member) {
  return config.trackedRoleIds.some(id => member.roles.cache.has(id));
}

function recordVoiceActivity(userId) {
  const data = readJson(ACTIVITY_FILE, {});

  if (!data[userId]) {
    data[userId] = {
      entries: 0,
      lastSeen: null,
      warned: false
    };
  }

  data[userId].entries += 1;
  data[userId].lastSeen = Date.now();
  data[userId].warned = false;

  writeJson(ACTIVITY_FILE, data);
}

function getSortedActivity() {
  const data = readJson(ACTIVITY_FILE, {});

  return Object.entries(data)
    .map(([userId, d]) => ({ userId, ...d }))
    .sort((a, b) => (b.entries || 0) - (a.entries || 0));
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

    return `${estado} **${i + 1}.** <@${entry.userId}> — **${entry.entries}** entrada(s) a voz/radio — última: ${formatDate(entry.lastSeen)}`;
  });

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('📊 Actividad de Miembros — Voz / Radio')
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
    const oldMsg = await channel.messages.fetch(db.messageId).catch(() => null);
    if (oldMsg) {
      await oldMsg.edit({ embeds: [embed] });
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
            .setColor(EMBED_COLOR)
            .setTitle('⚠️ Advertencia de Inactividad')
            .setDescription(
              `Hola **${member.user.username}**,\n\n` +
              `Llevas **${dias} días** sin entrar a voz/radio en **${config.guildName}**.\n\n` +
              `Por favor conéctate pronto para mantener tu actividad.`
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
            .setColor(EMBED_COLOR)
            .setTitle('🔴 Miembro Inactivo')
            .setDescription(`<@${userId}> lleva **${dias} días** sin entrar a voz/radio.`)
            .setThumbnail(config.logoUrl)
            .setTimestamp()
        ]
      }).catch(() => null);
    }
  }

  if (changed) writeJson(ACTIVITY_FILE, data);
}

function incrementClaim(user) {
  const claims = readJson(CLAIMS_FILE, {});

  if (!claims[user.id]) {
    claims[user.id] = {
      tag: user.tag,
      count: 0
    };
  }

  claims[user.id].tag = user.tag;
  claims[user.id].count += 1;

  writeJson(CLAIMS_FILE, claims);
  return claims[user.id].count;
}

function buildTicketButtons({ claimed = false } = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Cerrar')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('ticket_transcript')
      .setLabel('Transcript')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(claimed ? 'Ticket asumido' : 'Asumir ticket')
      .setStyle(ButtonStyle.Success)
      .setDisabled(claimed),

    new ButtonBuilder()
      .setCustomId('ticket_rename')
      .setLabel('Renombrar canal')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n` +
      `*si quieres postular acá lo puedes hacer:* 🎫`
    )
    .setThumbnail(config.logoUrl)
    .setImage(config.bannerUrl)
    .setFooter({ text: 'TICKETS' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_postulaciones')
      .setLabel('Postulaciones')
      .setEmoji('🌀')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('open_reportes')
      .setLabel('Reportes')
      .setEmoji('⛔')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('open_compras')
      .setLabel('Compras')
      .setEmoji('🛍️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('open_partner')
      .setLabel('Partners')
      .setEmoji('🤝')
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function buildTicketEmbed(user, data) {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setAuthor({
      name: config.guildName,
      iconURL: config.logoUrl
    })
    .setTitle(data.title)
    .setDescription(
      [
        data.description,
        '',
        '**Usuario:**',
        `<@${user.id}>`,
        '',
        '**Staff encargado:**',
        `<@&${data.roleId}>`,
        '',
        '**Estado:**',
        '`Abierto`',
        '',
        '**Staff que asumió:**',
        '`Nadie ha asumido el ticket`'
      ].join('\n')
    )
    .setThumbnail(config.logoUrl)
    .setFooter({ text: `${config.guildName} • Sistema de Tickets` })
    .setTimestamp();
}

function getTicketInfoFromChannel(channel) {
  if (!channel?.topic) return null;

  const ownerId = channel.topic.match(/ticketOwner:(\d+)/)?.[1];
  const type = channel.topic.match(/ticketType:([a-zA-Z0-9_-]+)/)?.[1];
  const data = type ? ticketTypes[type] : null;

  if (!ownerId || !type || !data) return null;

  return { ownerId, type, data };
}

function canManageTicket(interaction) {
  const info = getTicketInfoFromChannel(interaction.channel);
  if (!info) return false;

  const member = interaction.member;
  if (!member?.roles?.cache) return false;

  return (
    member.roles.cache.has(info.data.roleId) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

function noPermission() {
  return {
    content: 'No tienes permisos para manejar este ticket.',
    ephemeral: true
  };
}

async function createTicket(interaction, type) {
  const data = ticketTypes[type];

  if (!data) {
    return interaction.reply({
      content: 'Ese tipo de ticket no existe.',
      ephemeral: true
    });
  }

  const guild = interaction.guild;
  const user = interaction.user;

  const existing = guild.channels.cache.find(
    ch =>
      ch.topic &&
      ch.topic.includes(`ticketOwner:${user.id}`) &&
      ch.topic.includes(`ticketType:${type}`)
  );

  if (existing) {
    return interaction.reply({
      content: `Ya tienes un ticket de este tipo abierto en ${existing}.`,
      ephemeral: true
    });
  }

  const username = sanitizeChannelName(user.username).slice(0, 12);

  const channel = await guild.channels.create({
    name: `${data.name}-${username}`,
    type: ChannelType.GuildText,
    parent: data.categoryId,
    topic: `ticketOwner:${user.id} | ticketType:${type}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ]
      },
      {
        id: data.roleId,
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

  await channel.send({
    content: `<@${user.id}> Has abierto un ticket de (${data.emoji} **${data.label}**). Espera que un <@&${data.roleId}> te atienda.`,
    embeds: [buildTicketEmbed(user, data)],
    components: [buildTicketButtons({ claimed: false })]
  });

  return interaction.reply({
    content: `✅ Tu ticket fue creado con éxito en el canal ${channel}`,
    ephemeral: true
  });
}

async function fetchAllMessages(channel) {
  const all = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (!messages.size) break;

    all.push(...messages.values());
    lastId = messages.last().id;

    if (messages.size < 100) break;
  }

  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function formatTranscriptMessage(msg) {
  const date = new Date(msg.createdTimestamp).toLocaleString('es-CO', { hour12: true });
  const content = msg.content?.trim() || '[sin texto]';
  return `[${date}] ${msg.author.tag}: ${content}`;
}

async function sendTranscript(channel, closerUser) {
  const messages = await fetchAllMessages(channel);
  const transcriptText = messages.map(formatTranscriptMessage).join('\n');
  const transcriptName = `transcript-${channel.name}.txt`;
  const buffer = Buffer.from(transcriptText || 'Sin mensajes', 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: transcriptName });

  const info = getTicketInfoFromChannel(channel);
  const opener = info?.ownerId ? await client.users.fetch(info.ownerId).catch(() => null) : null;

  const transcriptChannel = await client.channels.fetch(config.transcriptChannelId).catch(() => null);

  if (transcriptChannel?.isTextBased()) {
    await transcriptChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle('📄 Transcript de Ticket')
          .addFields(
            { name: 'Canal', value: channel.name, inline: true },
            { name: 'Usuario', value: opener ? `<@${opener.id}>` : 'No encontrado', inline: true },
            { name: 'Cerrado por', value: `<@${closerUser.id}>`, inline: true },
            { name: 'Hora', value: new Date().toLocaleString('es-CO', { hour12: true }), inline: false }
          )
          .setThumbnail(config.logoUrl)
      ],
      files: [attachment]
    });
  }

  if (opener) {
    const dmAttachment = new AttachmentBuilder(buffer, { name: transcriptName });

    await opener.send({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle('📄 Tu ticket fue cerrado')
          .setDescription(`Aquí tienes el transcript de **${channel.name}**.`)
          .setThumbnail(config.logoUrl)
      ],
      files: [dmAttachment]
    }).catch(() => null);
  }
}

async function updateClaimEmbed(message, claimer) {
  const oldEmbed = message.embeds[0];
  if (!oldEmbed) return false;

  const desc = oldEmbed.description || '';

  if (!desc.includes('`Nadie ha asumido el ticket`')) return false;

  const updatedDesc = desc.replace(
    '**Staff que asumió:**\n`Nadie ha asumido el ticket`',
    `**Staff que asumió:**\n\`${claimer.tag} ha asumido el ticket\``
  );

  const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(updatedDesc);

  await message.edit({
    embeds: [newEmbed],
    components: [buildTicketButtons({ claimed: true })]
  });

  return true;
}

function buildRenameModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_rename_ticket')
    .setTitle('Renombrar ticket');

  const input = new TextInputBuilder()
    .setCustomId('new_channel_name')
    .setLabel('Nuevo nombre del canal')
    .setPlaceholder('Ejemplo: compra-juan')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return modal;
}

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  ensureFile(ACTIVITY_FILE, {});
  ensureFile(ACTIVITY_MSG, {});
  ensureFile(CLAIMS_FILE, {});

  await updateActivityEmbed();
  await checkInactivity();

  setInterval(updateActivityEmbed, 5 * 60 * 1000);
  setInterval(checkInactivity, 60 * 60 * 1000);
});

client.on('guildMemberAdd', async member => {
  const channel = await member.guild.channels.fetch(config.bannerWelcomeChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n` +
      `*si quieres postular acá lo puedes hacer:* <#1469434046638461231>`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage(config.bannerUrl)
    .setFooter({ text: 'TICKETS' });

  await channel.send({
    content: `${member} **Bienvenido a** __${config.guildName}__ 🚙`,
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
  try {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('open_')) {
        const type = interaction.customId.replace('open_', '');
        return createTicket(interaction, type);
      }

      if (
        interaction.customId === 'ticket_close' ||
        interaction.customId === 'ticket_transcript' ||
        interaction.customId === 'ticket_claim' ||
        interaction.customId === 'ticket_rename'
      ) {
        if (!canManageTicket(interaction)) {
          return interaction.reply(noPermission());
        }
      }

      if (interaction.customId === 'ticket_claim') {
        const updated = await updateClaimEmbed(interaction.message, interaction.user);

        if (!updated) {
          return interaction.reply({
            content: 'Este ticket ya fue asumido.',
            ephemeral: true
          });
        }

        const total = incrementClaim(interaction.user);

        return interaction.reply({
          content: `✅ Has asumido el ticket correctamente. Ahora llevas **${total}** tickets asumidos.`,
          ephemeral: true
        });
      }

      if (interaction.customId === 'ticket_rename') {
        return interaction.showModal(buildRenameModal());
      }

      if (interaction.customId === 'ticket_transcript') {
        await interaction.reply({
          content: 'Generando transcript...',
          ephemeral: true
        });

        await sendTranscript(interaction.channel, interaction.user);

        return interaction.followUp({
          content: '✅ Transcript enviado.',
          ephemeral: true
        });
      }

      if (interaction.customId === 'ticket_close') {
        await interaction.reply({
          content: 'Cerrando ticket y enviando transcript...',
          ephemeral: true
        });

        await sendTranscript(interaction.channel, interaction.user);

        setTimeout(() => {
          interaction.channel.delete().catch(() => null);
        }, 3000);

        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_rename_ticket') {
        if (!canManageTicket(interaction)) {
          return interaction.reply(noPermission());
        }

        const raw = interaction.fields.getTextInputValue('new_channel_name');
        const newName = sanitizeChannelName(raw);

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
    }
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

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!paneltickets') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('No tienes permisos para usar este comando.');
    }

    await message.channel.send(buildTicketPanel());
    return message.reply('✅ Panel de tickets enviado.');
  }

  if (message.content === '!ranking') {
    await updateActivityEmbed();
    return message.reply('✅ Ranking de actividad actualizado.');
  }

  if (message.content === '!resetactividad') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('No tienes permisos para usar este comando.');
    }

    writeJson(ACTIVITY_FILE, {});
    writeJson(ACTIVITY_MSG, {});
    await updateActivityEmbed();

    return message.reply('✅ Actividad reiniciada correctamente.');
  }
});

client.login(TOKEN);
