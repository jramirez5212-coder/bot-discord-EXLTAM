const { EmbedBuilder }                                         = require("discord.js");
const { loadData, saveData, getUser, todayKey }                = require("../utils/dataManager");
const { msToHours }                                            = require("../utils/format");
const { ACTIVITY_ROLE_ID, STAFF_ROLE_ID,
        GUILD_ID, LOGO_URL, CANAL_CMD_ADMIN,
        AFK_CHANNEL_ID }                                       = require("../config");

function isAdmin(message) {
  return message.member?.roles?.cache?.has(STAFF_ROLE_ID) ||
         message.member?.permissions?.has(8n);
}

function parseTime(str) {
  let ms = 0;
  const hours = str.match(/(\d+)h/i);
  const mins  = str.match(/(\d+)m/i);
  if (hours) ms += parseInt(hours[1]) * 60 * 60 * 1000;
  if (mins)  ms += parseInt(mins[1])  * 60 * 1000;
  return ms;
}

async function handleAdmin(message, client) {
  if (message.author.bot) return;
  const args    = message.content.trim().split(/\s+/);
  const comando = args[0].toLowerCase();

  const adminCmds = ["!addtime","!removetime","!sethoras","!resetuser","!resetweek","!syncvoz","!status","!sesiones","!forceupdate"];
  if (!adminCmds.includes(comando)) return;

  if (!isAdmin(message))
    return message.reply("❌ No tienes permiso para usar este comando.");

  // Solo en canal admin
  if (message.channel.id !== CANAL_CMD_ADMIN) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_ADMIN}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const data = loadData();

  if (comando === "!addtime") {
    const target = message.mentions.members.first();
    const tiempo = args[2];
    if (!target || !tiempo) return message.reply("❌ Uso: `!addtime @usuario 2h30m`");
    const ms = parseTime(tiempo);
    if (!ms) return message.reply("❌ Tiempo inválido. Ej: `2h`, `30m`, `1h30m`");
    const ud = getUser(data, target.id);
    const hoy = todayKey();
    ud.totalMs += ms; ud.weekMs += ms;
    if (!ud.days[hoy]) ud.days[hoy] = { totalMs: 0 };
    ud.days[hoy].totalMs += ms;
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Tiempo agregado")
      .setDescription(`Se agregaron **${msToHours(ms)}** a ${target}\n\n📆 Semana: \`${msToHours(ud.weekMs)}\`\n🏆 Total: \`${msToHours(ud.totalMs)}\``)
      .setTimestamp()] });
  }

  if (comando === "!removetime") {
    const target = message.mentions.members.first();
    const tiempo = args[2];
    if (!target || !tiempo) return message.reply("❌ Uso: `!removetime @usuario 1h`");
    const ms = parseTime(tiempo);
    if (!ms) return message.reply("❌ Tiempo inválido.");
    const ud = getUser(data, target.id);
    const hoy = todayKey();
    ud.totalMs = Math.max(0, ud.totalMs - ms);
    ud.weekMs  = Math.max(0, ud.weekMs  - ms);
    if (ud.days[hoy]) ud.days[hoy].totalMs = Math.max(0, (ud.days[hoy].totalMs||0) - ms);
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("✅ Tiempo removido")
      .setDescription(`Se removieron **${msToHours(ms)}** de ${target}\n\n📆 Semana: \`${msToHours(ud.weekMs)}\`\n🏆 Total: \`${msToHours(ud.totalMs)}\``)
      .setTimestamp()] });
  }

  if (comando === "!sethoras") {
    const target = message.mentions.members.first();
    const tiempo = args[2];
    if (!target || !tiempo) return message.reply("❌ Uso: `!sethoras @usuario 5h`");
    const ms = parseTime(tiempo);
    const ud = getUser(data, target.id);
    const hoy = todayKey();
    ud.totalMs = ms; ud.weekMs = ms;
    if (!ud.days[hoy]) ud.days[hoy] = { totalMs: 0 };
    ud.days[hoy].totalMs = ms;
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Horas establecidas")
      .setDescription(`Horas de ${target} ajustadas a **${msToHours(ms)}**`).setTimestamp()] });
  }

  if (comando === "!resetuser") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Uso: `!resetuser @usuario`");
    data[target.id] = { totalMs:0, weekMs:0, lastSeen:null, days:{}, topsGanados:0, diasSeguidos:0, advertencias:0 };
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("✅ Usuario reseteado")
      .setDescription(`Todos los datos de ${target} fueron reseteados.`).setTimestamp()] });
  }

  if (comando === "!resetweek") {
    let count = 0;
    for (const id in data) { data[id].weekMs = 0; count++; }
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Semana reseteada")
      .setDescription(`Se resetearon las horas semanales de **${count}** usuarios.`).setTimestamp()] });
  }

  if (comando === "!syncvoz") {
    const { activeSessions } = require("../events/voiceStateUpdate");
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    activeSessions.clear();
    const ahora = Date.now();
    let synced = 0;
    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot &&
      m.voice?.channelId && m.voice.channelId !== AFK_CHANNEL_ID
    );
    for (const [id, member] of miembros) {
      const ud = getUser(data, id);
      const sessionStart = ud.sessionStart || ahora;
      activeSessions.set(id, sessionStart);
      if (!ud.sessionStart) ud.sessionStart = ahora;
      synced++;
    }
    saveData(data);
    client.emit("updateActividadEmbed");
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Voz sincronizada")
      .setDescription(`Se sincronizaron **${synced}** sesiones activas de voz.`).setTimestamp()] });
  }

  if (comando === "!status") {
    const { activeSessions } = require("../events/voiceStateUpdate");
    const ahora = Date.now();
    let desc = "";
    for (const [id, ts] of activeSessions) {
      const mins = Math.floor((ahora - ts) / 60000);
      desc += `<@${id}> — \`${mins}m\` en sesión\n`;
    }
    if (!desc) desc = "*No hay sesiones activas registradas.*";
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14)
      .setTitle(`📊 Sesiones activas (${activeSessions.size})`).setDescription(desc.slice(0,4000)).setTimestamp()] });
  }

  if (comando === "!sesiones") {
    let desc = "";
    for (const id in data) {
      if (data[id].sessionStart) {
        const mins = Math.floor((Date.now() - data[id].sessionStart) / 60000);
        desc += `<@${id}> — sesión guardada hace \`${mins}m\`\n`;
      }
    }
    if (!desc) desc = "*No hay sesiones guardadas en el JSON.*";
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14)
      .setTitle("📋 Sesiones en JSON").setDescription(desc.slice(0,4000)).setTimestamp()] });
  }

  if (comando === "!forceupdate") {
    client.emit("updateActividadEmbed");
    return message.reply("✅ Embed actualizado manualmente.");
  }
}

module.exports = { handleAdmin };
