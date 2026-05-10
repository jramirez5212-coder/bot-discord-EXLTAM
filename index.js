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

if (!TOKEN) {
  throw new Error('Falta TOKEN en Railway');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const EMBED_COLOR = 0x00ff3c;

const config = {
  guildName: 'EXLATAM / #300K?',

  welcomeChannelId: '1469434029475496209',

  transcriptChannelId: '1469434006331330561',

  activityChannelId: '1502906373846077582',

  inactivityLogsId: '1502906524001898537',

  trackedRoleId: '1469433888949665976',

  inactiveDays: 7,

  logoUrl:
    'https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png?ex=6a00e170&is=69ff8ff0&hm=50f5e8ba4101bb15b3d05c648a5ad13ef57f8408b2cfad94431a2effe219bab6&',

  bannerUrl:
    'https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png?ex=6a00ff8a&is=69ffae0a&hm=f54d7a23160bfc30fdd22e438104f200f5e8cc1970985179fba540aae6af1904&'
};

const ticketTypes = {
  postulaciones: {
    label: 'Postulaciones',
    emoji: '🌀',
    categoryId: '1469433993911865556',
    roleId: '1469433858352222379',
    description:
      '<:emoji_16:1486354271351078923>  *Si estás interesado en postular __rellena la siguiente información:__*\n\n' +
      '~ Nombre:\n' +
      '~ Edad (**minimo 15**):\n' +
      '~ 5 Clips o 1HG:\n' +
      '~ Foto de las horas de FiveM:\n' +
      '~ Foto KD (**minimo 1.8**):\n' +
      '~ Link Steam Público:\n' +
      '~ Tiempo Disponible?:'
  },

  reportes: {
    label: 'Reportes',
    emoji: '⛔',
    categoryId: '1469433997191811308',
    roleId: '1469433860293918921',
    description:
      '⚠️ **Cuéntanos en qué te podemos ayudar.**\n\n' +
      '~ Usuario reportado:\n' +
      '~ Motivo:\n' +
      '~ Pruebas:\n' +
      '~ Explicación completa:'
  },

  compras: {
    label: 'Compras',
    emoji: '🛍️',
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
      '~ Qué ofrecen:'
  }
};

const activityFile = './activity.json';

if (!fs.existsSync(activityFile)) {
  fs.writeFileSync(activityFile, JSON.stringify({}));
}

function loadActivity() {
  return JSON.parse(fs.readFileSync(activityFile));
}

function saveActivity(data) {
  fs.writeFileSync(activityFile, JSON.stringify(data, null, 2));
}

function formatTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);

  const hours = Math.floor(totalMinutes / 60);

  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

async function updateActivityEmbed() {
  const channel = await client.channels.fetch(config.activityChannelId).catch(() => null);

  if (!channel) return;

  const data = loadActivity();

  const sorted = Object.entries(data).sort(
    (a, b) => (b[1].time || 0) - (a[1].time || 0)
  );

  const description =
    sorted
      .map((x, i) => {
        const userId = x[0];
        const info = x[1];

        const online = info.joinedAt ? '🟢 conectado' : '⚫ desconectado';

        return `**${i + 1}.** <@${userId}> • ${formatTime(
          info.time || 0
        )} • ${online}`;
      })
      .join('\n') || 'Sin actividad';

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('📊 Actividad de Miembros — Voz')
    .setDescription(description)
    .setThumbnail(config.logoUrl)
    .setFooter({
      text: `${config.guildName}`
    });

  const messages = await channel.messages.fetch({ limit: 10 });

  const existing = messages.find(m => m.author.id === client.user.id);

  if (existing) {
    await existing.edit({
      embeds: [embed]
    });
  } else {
    await channel.send({
      embeds: [embed]
    });
  }
}

client.once('clientReady', async () => {
  console.log('✅ BOT NUEVO EXLATAM V2');
  console.log(`✅ Conectado como ${client.user.tag}`);

  updateActivityEmbed();

  setInterval(updateActivityEmbed, 30000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member || oldState.member;

  if (!member) return;

  if (!member.roles.cache.has(config.trackedRoleId)) return;

  const data = loadActivity();

  if (!data[member.id]) {
    data[member.id] = {
      time: 0,
      joinedAt: null
    };
  }

  if (!oldState.channelId && newState.channelId) {
    data[member.id].joinedAt = Date.now();
  }

  if (oldState.channelId && !newState.channelId) {
    if (data[member.id].joinedAt) {
      data[member.id].time += Date.now() - data[member.id].joinedAt;
      data[member.id].joinedAt = null;
    }
  }

  saveActivity(data);

  updateActivityEmbed();
});

client.on('guildMemberAdd', async member => {
  const channel = await member.guild.channels
    .fetch(config.welcomeChannelId)
    .catch(() => null);

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n` +
        `*si quieres postular acá lo puedes hacer:* <#1469434046638461231>`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage(config.bannerUrl)
    .setFooter({
      text: 'TICKETS'
    });

  await channel.send({
    content: `${member} **Bienvenido a** __${config.guildName}__ 🚙`,
    embeds: [embed]
  });
});

function ticketPanel() {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n` +
        `*si quieres postular acá lo puedes hacer:* <#1469434046638461231>`
    )
    .setThumbnail(config.logoUrl)
    .setImage(config.bannerUrl)
    .setFooter({
      text: 'TICKETS'
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_postulaciones')
      .setLabel('Postulaciones')
      .setEmoji('🌀')
      .setStyle(ButtonStyle.Success),

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

  if (message.content === '!paneltickets') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return;
    }

    await message.channel.send(ticketPanel());

    await message.reply('✅ Panel enviado');
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith('ticket_')) return;

  const type = interaction.customId.replace('ticket_', '');

  const ticket = ticketTypes[type];

  if (!ticket) return;

  const existing = interaction.guild.channels.cache.find(
    c =>
      c.topic &&
      c.topic.includes(interaction.user.id) &&
      c.topic.includes(type)
  );

  if (existing) {
    return interaction.reply({
      content: `Ya tienes un ticket abierto: ${existing}`,
      ephemeral: true
    });
  }

  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: ticket.categoryId,

    topic: `${interaction.user.id}-${type}`,

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
          PermissionFlagsBits.ReadMessageHistory
        ]
      },

      {
        id: ticket.roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
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
});

client.login(TOKEN);
