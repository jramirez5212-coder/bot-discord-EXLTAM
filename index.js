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
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const EMBED_COLOR = 0x00ff3c;

const config = {
  guildName: 'EXLATAM / #300K?',
  guildId: '1469434046638461231',

  welcomeChannelId: '1469434029475496209',
  activityChannelId: '1502906373846077582',
  inactivityLogsId: '1502906524001898537',

  trackedRoleId: '1469433888949665976',

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
        '~ Residencia/Pais?:\n' +
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

const activityFile = './activity.json';

if (!fs.existsSync(activityFile)) {
  fs.writeFileSync(activityFile, JSON.stringify({}));
}

function loadActivity() {
  try {
    return JSON.parse(fs.readFileSync(activityFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveActivity(data) {
  fs.writeFileSync(activityFile, JSON.stringify(data, null, 2));
}

function formatTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Nunca';

  return new Date(timestamp).toLocaleString('es-CO', {
    hour12: true,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
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

function buildRenameModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_rename_ticket')
    .setTitle('Renombrar ticket');

  const input = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('Nuevo nombre del canal')
    .setPlaceholder('Ejemplo: postulacion-juan')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return modal;
}

async function updateActivityEmbed() {
  const channel = await client.channels.fetch(config.activityChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const data = loadActivity();

  const sorted = Object.entries(data).sort((a, b) => {
    const aTime = (a[1].time || 0) + (a[1].joinedAt ? Date.now() - a[1].joinedAt : 0);
    const bTime = (b[1].time || 0) + (b[1].joinedAt ? Date.now() - b[1].joinedAt : 0);
    return bTime - aTime;
  });

  const description =
    sorted
      .map(([userId, info], i) => {
        const totalTime = (info.time || 0) + (info.joinedAt ? Date.now() - info.joinedAt : 0);
        const online = info.joinedAt ? '🟢 conectado ahora' : '⚫ desconectado';

        const recentSessions = (info.sessions || [])
          .slice(-3)
          .reverse()
          .map(s => {
            const entrada = formatDate(s.joinedAt);
            const salida = s.leftAt ? formatDate(s.leftAt) : 'Sigue conectado';
            const duracion = s.duration ? formatTime(s.duration) : 'En curso';

            return `   ↳ Entrada: ${entrada} | Salida: ${salida} | Tiempo: **${duracion}**`;
          })
          .join('\n');

        return (
          `**${i + 1}.** <@${userId}> — Total: **${formatTime(totalTime)}** — ${online}\n` +
          (recentSessions || '   ↳ Sin sesiones registradas todavía')
        );
      })
      .join('\n\n') || 'Sin actividad registrada.';

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('📊 Actividad de Miembros — Voz / Radio')
    .setDescription(description)
    .setThumbnail(config.logoUrl)
    .setFooter({ text: `${config.guildName} • Actividad por horas de entrada y salida` })
    .setTimestamp();

  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
  const existing = messages?.find(m => m.author.id === client.user.id);

  if (existing) {
    await existing.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }
}

client.once('clientReady', async () => {
  console.log('✅ BOT NUEVO EXLATAM V2');
  console.log(`✅ Conectado como ${client.user.tag}`);

  await updateActivityEmbed();
  setInterval(updateActivityEmbed, 30000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  if (!member.roles.cache.has(config.trackedRoleId)) return;

  const data = loadActivity();

  if (!data[member.id]) {
    data[member.id] = {
      time: 0,
      joinedAt: null,
      sessions: []
    };
  }

  if (!oldState.channelId && newState.channelId) {
    const now = Date.now();

    data[member.id].joinedAt = now;
    data[member.id].sessions.push({
      joinedAt: now,
      leftAt: null,
      duration: null
    });
  }

  if (oldState.channelId && !newState.channelId) {
    if (data[member.id].joinedAt) {
      const now = Date.now();
      const duration = now - data[member.id].joinedAt;

      data[member.id].time += duration;
      data[member.id].joinedAt = null;

      const lastSession = data[member.id].sessions[data[member.id].sessions.length - 1];

      if (lastSession && !lastSession.leftAt) {
        lastSession.leftAt = now;
        lastSession.duration = duration;
      }
    }
  }

  saveActivity(data);
  await updateActivityEmbed();
});

client.on('guildMemberAdd', async member => {
  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n` +
      `*si quieres postular acá lo puedes hacer:* <#1469434046638461231>`
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
      '<:emoji_6:1485010432514326558> __Postulaciones:__ Ser parte de las bandas de la comunidad.\n' +
      '<:emoji_6:1485010432514326558> __Reportes:__ Reportar alguna inconformidad.\n' +
      '<:emoji_6:1485010432514326558> __Compras:__ Compras en nuestra tienda.\n' +
      '<:emoji_6:1485010432514326558> __Partners:__ Alianzas entre discord (PUBLICIDAD).\n\n' +
      '👇 **¡SI ESTAS INTERESADO EN POSTULAR PRESIONA EL BOTON CORRESPONDIENTE!** 👇'
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
      return message.reply('No tienes permisos.');
    }

    await message.channel.send(ticketPanel());
    return message.reply('✅ Panel enviado.');
  }

  if (message.content === '!ranking') {
    await updateActivityEmbed();
    return message.reply('✅ Ranking actualizado.');
  }

  if (message.content === '!resetactividad') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('No tienes permisos.');
    }

    saveActivity({});
    await updateActivityEmbed();
    return message.reply('✅ Actividad reiniciada.');
  }
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

      return;
    }

    if (!interaction.isButton()) return;

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

      return interaction.showModal(buildRenameModal());
    }

    if (!interaction.customId.startsWith('ticket_')) return;

    const type = interaction.customId.replace('ticket_', '');
    const ticket = ticketTypes[type];

    if (!ticket) return;

    const existing = interaction.guild.channels.cache.find(
      c => c.topic && c.topic.includes(`ticketOwner:${interaction.user.id}`) && c.topic.includes(`ticketType:${type}`)
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

client.login(TOKEN);
