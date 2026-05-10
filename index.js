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
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require('discord.js');

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────
//  ENV
// ─────────────────────────────────────────
const TOKEN     = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID  = '1469434046638461231';

if (!TOKEN)     throw new Error('Falta TOKEN en Railway');
if (!CLIENT_ID) throw new Error('Falta CLIENT_ID en Railway');

// ─────────────────────────────────────────
//  CONFIG  ← edita aquí los IDs que faltan
// ─────────────────────────────────────────
const config = {
  guildName: 'TU SERVIDOR',   // cambia el nombre de tu servidor

  // ── Actividad ──
  trackedRoleIds: [
    '1469433888949665976'      // rol a trackear
  ],
  activityChannelId: '1502906373846077582',  // embed ranking actividad
  inactivityLogsId:  '1502906524001898537',  // canal logs / alertas inactividad
  inactiveDays: 7,                           // días sin voz = inactivo

  // ── Bienvenida ──
  bannerWelcomeChannelId: '1469434029475496209',

  // ── Tickets ──
  transcriptChannelId: '1469434006331330561',

  // ── Categorías de tickets (reemplaza con los IDs reales de tus categorías) ──
  categories: {
    soporte:    'CATEGORY_ID_SOPORTE',
    reportes:   'CATEGORY_ID_REPORTES',
    donaciones: 'CATEGORY_ID_DONACIONES',
    apelar:     'CATEGORY_ID_APELAR',
    staff:      'CATEGORY_ID_STAFF',
    bugs:       'CATEGORY_ID_BUGS',
    recompensa: 'CATEGORY_ID_RECOMPENSA'
  },

  // ── Roles de staff por ticket (reemplaza con los IDs reales) ──
  staffRoles: {
    soporte:    'STAFF_ROLE_SOPORTE',
    reportes:   'STAFF_ROLE_REPORTES',
    donaciones: 'STAFF_ROLE_DONACIONES',
    apelar:     'STAFF_ROLE_APELAR',
    staff:      'STAFF_ROLE_STAFF',
    bugs:       'STAFF_ROLE_BUGS',
    recompensa: 'STAFF_ROLE_RECOMPENSA'
  },

  // ── Assets ──
  logoUrl:   'https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png?ex=6a00e170&is=69ff8ff0&hm=50f5e8ba4101bb15b3d05c648a5ad13ef57f8408b2cfad94431a2effe219bab6&',
  bannerUrl: 'https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png?ex=6a00ff8a&is=69ffae0a&hm=f54d7a23160bfc30fdd22e438104f200f5e8cc1970985179fba540aae6af1904&'
};

// ─────────────────────────────────────────
//  ARCHIVOS JSON
// ─────────────────────────────────────────
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const ACTIVITY_MSG  = path.join(__dirname, 'activity_message.json');
const CLAIMS_FILE   = path.join(__dirname, 'claims.json');
const RANKING_FILE  = path.join(__dirname, 'ranking_message.json');

function ensureFile(file, fallback) {
  if (!fs.existsSync(file))
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
}

function readJson(file, fallback) {
  ensureFile(file, fallback);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ─────────────────────────────────────────
//  HELPERS — ACTIVIDAD
// ─────────────────────────────────────────

function isTracked(member) {
  return config.trackedRoleIds.some(id => member.roles.cache.has(id));
}

function recordVoiceActivity(userId) {
  const data = readJson(ACTIVITY_FILE, {});
  if (!data[userId]) data[userId] = { sessions: 0, lastSeen: null, warned: false };
  data[userId].sessions += 1;
  data[userId].lastSeen  = Date.now();
  data[userId].warned    = false; // si vuelve, se resetea la advertencia
  writeJson(ACTIVITY_FILE, data);
}

function resetAllActivity() {
  writeJson(ACTIVITY_FILE, {});
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

// ─────────────────────────────────────────
//  EMBED DE ACTIVIDAD
// ─────────────────────────────────────────
function buildActivityEmbed() {
  const list  = getSortedActivity();

  const lines = list.map((entry, i) => {
    const dias   = daysSince(entry.lastSeen);
    const estado = dias >= config.inactiveDays ? '🔴' : dias >= 3 ? '🟡' : '🟢';
    return `${estado} **${i + 1}.** <@${entry.userId}> — ${entry.sessions} sesión(es) — última: ${formatDate(entry.lastSeen)}`;
  });

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('📊 Actividad de Miembros — Voz')
    .setDescription(lines.length ? lines.join('\n') : 'Sin registros de actividad aún.')
    .setThumbnail(config.logoUrl)
    .setFooter({ text: `${config.guildName} • 🟢 Activo  🟡 +3 días  🔴 Inactivo (+7 días)` })
    .setTimestamp();
}

async function updateActivityEmbed() {
  const channel = await client.channels.fetch(config.activityChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const db    = readJson(ACTIVITY_MSG, {});
  const embed = buildActivityEmbed();

  if (db.messageId) {
    const old = await channel.messages.fetch(db.messageId).catch(() => null);
    if (old) { await old.edit({ embeds: [embed] }); return; }
  }

  const msg = await channel.send({ embeds: [embed] });
  writeJson(ACTIVITY_MSG, { messageId: msg.id });
}

// ─────────────────────────────────────────
//  CHEQUEO DE INACTIVIDAD — cada hora
// ─────────────────────────────────────────
async function checkInactivity() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const logsChannel = await guild.channels.fetch(config.inactivityLogsId).catch(() => null);
  const data        = readJson(ACTIVITY_FILE, {});
  let   changed     = false;

  for (const [userId, entry] of Object.entries(data)) {
    if (entry.warned) continue;
    if (daysSince(entry.lastSeen) < config.inactiveDays) continue;

    data[userId].warned = true;
    changed = true;

    const member = await guild.members.fetch(userId).catch(() => null);
    const dias   = daysSince(entry.lastSeen);

    // DM al usuario
    if (member) {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('⚠️ Advertencia de Inactividad')
            .setDescription(
              `Hola **${member.user.username}**,\n\n` +
              `Llevás **${dias} días** sin conectarte a un canal de voz en **${config.guildName}**.\n\n` +
              `Por favor conectate pronto para no perder tu lugar en el servidor.`
            )
            .setThumbnail(config.logoUrl)
            .setTimestamp()
        ]
      }).catch(() => null);
    }

       // Log en canal de admins
    if (logsChannel?.isTextBased()) {
      await logsChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🔴 Miembro Inactivo')
            .setDescription(
              `<@${userId}> lleva **${dias} días** sin conectarse a un canal de voz en **${config.guildName}**.`
            )
            .setThumbnail(config.logoUrl)
            .setTimestamp()
        ]
      }).catch(() => null);
    }
  }

  if (changed) writeJson(ACTIVITY_FILE, data);
}
                      client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.login(TOKEN);
