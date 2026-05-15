const { EmbedBuilder }                                        = require("discord.js");
const { loadData, getUser }                                   = require("../utils/dataManager");
const { msToHours, lastNDays }                                = require("../utils/format");
const { ACTIVITY_ROLE_ID, TOP_ROLE_ID, TOP_SIZE, GUILD_ID, LOGO_URL } = require("../config");

async function handleHoras(message, client) {
  if (message.author.bot) return;
  const args    = message.content.trim().split(/\s+/);
  const comando = args[0].toLowerCase();

  if (comando === "!horas") {
    const target = message.mentions.members.first() || message.member;
    if (!target.roles.cache.has(ACTIVITY_ROLE_ID))
      return message.reply("❌ Ese usuario no tiene el rol de actividad.");

    const data     = loadData();
    const userData = getUser(data, target.id);
    const dias     = lastNDays(7);
    let diasText = "";
    for (const dia of dias) {
      const ms = userData.days?.[dia]?.totalMs || 0;
      diasText += `${ms > 0 ? "🟩" : "⬜"} \`${dia}\` — ${msToHours(ms)}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⏱️ Horas de ${target.user.username}`)
      .setColor(0x39FF14)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📅 Últimos 7 días",  value: diasText || "*Sin registros*" },
        { name: "📆 Esta semana",     value: `\`${msToHours(userData.weekMs)}\``,          inline: true },
        { name: "🏆 Total acumulado", value: `\`${msToHours(userData.totalMs)}\``,         inline: true },
        { name: "🔥 Racha actual",    value: `\`${userData.diasSeguidos || 0}d\``,         inline: true },
        { name: "🎖️ Tops ganados",    value: `\`${userData.topsGanados || 0}\``,           inline: true },
        { name: "⚠️ Advertencias",    value: `\`${userData.advertencias || 0} / 3\``,      inline: true },
        { name: "👁️ Última vez",      value: userData.lastSeen ? `<t:${Math.floor(userData.lastSeen/1000)}:R>` : "*Nunca*", inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${target.id}` });

    return message.reply({ embeds: [embed] });
  }

  if (comando === "!top") {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    const data     = loadData();
    const miembros = guild.members.cache.filter(m => m.roles.cache.has(TOP_ROLE_ID) && !m.user.bot);
    const ranking  = [];
    for (const [id, member] of miembros) {
      const ud = getUser(data, id);
      ranking.push({ member, weekMs: ud.weekMs||0, totalMs: ud.totalMs||0 });
    }
    ranking.sort((a,b) => b.weekMs - a.weekMs);
    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
    let topText = "";
    ranking.slice(0, TOP_SIZE).forEach(({ member, weekMs, totalMs }, i) => {
      topText += `${medals[i]} **${member.user.username}**\n┣ Esta semana: \`${msToHours(weekMs)}\`\n┗ Total: \`${msToHours(totalMs)}\`\n\n`;
    });
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top ${TOP_SIZE} — Semana Actual`)
      .setColor(0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(topText || "*Sin datos aún.*")
      .setTimestamp()
      .setFooter({ text: "Actualizado en tiempo real" });
    return message.reply({ embeds: [embed] });
  }
}

module.exports = { handleHoras };
