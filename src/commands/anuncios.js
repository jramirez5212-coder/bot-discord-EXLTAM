const { EmbedBuilder } = require("discord.js");
const { ACTIVITY_ROLE_ID, RUSH_ACTIVITY_ROLE_ID, LOGO_URL,
        CANAL_CMD_ANUNCIOS }          = require('../config');

const cooldowns   = new Map();
const COOLDOWN_MS = 60 * 1000;

const COMANDOS_ROLAS = {
  "!activense": { titulo:"⚡ ¡ACTÍVENSE — ROLAS!",          color:0xFFD700, desc:"¡Vengan al canal de voz ahora!" },
  "!tormenta":  { titulo:"🌪️ ¡TORMENTA EN 1 MIN — ROLAS!", color:0xFFD700, desc:"¡Prepárense, tormenta en 1 minuto!" },
  "!battle":    { titulo:"⚔️ ¡BATTLE ROYAL — ROLAS!",       color:0xe74c3c, desc:"¡Battle Royal comenzando!" },
  "!drop":      { titulo:"📦 ¡DROP — ROLAS!",               color:0xf39c12, desc:"¡Drop cayendo en 1 minuto!" },
};

const COMANDOS_RUSH = {
  "!activenserush": { titulo:"⚡ ¡ACTÍVENSE — RUSH!",          color:0xFFD700, desc:"¡Vengan al canal de voz ahora!" },
  "!tormentarush":  { titulo:"🌪️ ¡TORMENTA EN 1 MIN — RUSH!", color:0xFFD700, desc:"¡Prepárense, tormenta en 1 minuto!" },
  "!battlerush":    { titulo:"⚔️ ¡BATTLE ROYAL — RUSH!",       color:0xe74c3c, desc:"¡Battle Royal comenzando!" },
  "!droprush":      { titulo:"📦 ¡DROP — RUSH!",               color:0xf39c12, desc:"¡Drop cayendo en 1 minuto!" },
};

const TODOS_COMANDOS = { ...COMANDOS_ROLAS, ...COMANDOS_RUSH };

async function handleAnuncios(message) {
  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();
  if (!TODOS_COMANDOS[cmd]) return;

  const esRush = cmd.endsWith("rush");
  const rolId  = esRush ? RUSH_ACTIVITY_ROLE_ID : ACTIVITY_ROLE_ID;

  if (!message.member.roles.cache.has(rolId))
    return message.reply(`❌ Solo ${esRush ? "RUSH" : "ROLAS"} puede usar este comando.`);

  if (message.channel.id !== CANAL_CMD_ANUNCIOS) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_ANUNCIOS}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const key    = `${cmd}:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    const segs = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
    return message.reply(`⏳ Espera **${segs} segundos**.`);
  }
  cooldowns.set(key, Date.now());

  const { titulo, color, desc } = TODOS_COMANDOS[cmd];
  try { await message.delete(); } catch {}

  const embed = new EmbedBuilder()
    .setTitle(titulo).setDescription(desc).setColor(color)
    .setThumbnail(LOGO_URL).setTimestamp()
    .setFooter({ text: `Enviado por ${message.author.username}` });

  // SÍ etiqueta al rol
  await message.channel.send({ content: `<@&${rolId}>`, embeds: [embed] });
}

module.exports = { handleAnuncios };
