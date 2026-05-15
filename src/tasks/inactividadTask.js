const { EmbedBuilder }                              = require("discord.js");
const { loadData, saveData, getUser, todayKey,
        horaMinutoColombia }                        = require("../utils/dataManager");
const { msToHours }                                 = require("../utils/format");
const { ACTIVITY_ROLE_ID, STAFF_ROLE_ID,
        ROL_AVISO_ID, CANAL_ADVERTENCIAS_ID,
        CANAL_LOGS_ID, CANAL_SANCIONES_ID,
        GUILD_ID, DIA_ADV_1, DIA_ADV_2,
        DIA_ADV_3, DIA_EXPULSA }                   = require("../config");

let lastCheck = null;

function startInactividadTask(client) {
  console.log(`[INACTIVIDAD] Bot prendido: ${todayKey()}`);
  setInterval(() => checkMedianoche(client), 60 * 1000);
}

async function checkMedianoche(client) {
  const hora     = horaMinutoColombia();
  const fechaHoy = todayKey();
  if (hora !== "00:00" || lastCheck === fechaHoy) return;
  lastCheck = fechaHoy;
  console.log("[INACTIVIDAD] Check de medianoche...");

  try {
    const guild        = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    const data         = loadData();
    const canalAdv     = await client.channels.fetch(CANAL_ADVERTENCIAS_ID).catch(() => null);
    const canalLogs    = await client.channels.fetch(CANAL_LOGS_ID).catch(() => null);
    const canalSancion = await client.channels.fetch(CANAL_SANCIONES_ID).catch(() => null);

    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const ahora_ms = Date.now();

    for (const [id, member] of miembros) {
      const userData = getUser(data, id);
      const msHoy    = userData.days?.[fechaHoy]?.totalMs || 0;

      // Primer registro
      if (!userData.lastSeen && !userData.botFirstSeen) {
        userData.botFirstSeen = Date.now();
        continue;
      }

      const referencia = userData.botFirstSeen || userData.lastSeen;
      const diasSin    = Math.floor((ahora_ms - referencia) / (24 * 60 * 60 * 1000));
      const cumplioHoy = msHoy > 0;
      const excusado   = global.isExcused && global.isExcused(id);

      // Log diario en #logs
      if (canalLogs) {
        const logEmbed = new EmbedBuilder()
          .setColor(cumplioHoy ? 0x39FF14 : 0xe74c3c)
          .setThumbnail(member.user.displayAvatarURL())
          .setTitle(`${cumplioHoy ? "✅" : "❌"} ${member.user.username}`)
          .addFields(
            { name: "📅 Fecha",           value: fechaHoy,                         inline: true },
            { name: "⏰ Horas hoy",       value: msToHours(msHoy),                 inline: true },
            { name: "📆 Esta semana",     value: msToHours(userData.weekMs),       inline: true },
            { name: "🏆 Total",           value: msToHours(userData.totalMs),      inline: true },
            { name: "📉 Días sin entrar", value: `${diasSin}d`,                    inline: true },
            { name: "🔥 Racha",           value: `${userData.diasSeguidos || 0}d`, inline: true },
          )
          .setTimestamp();
        try { await canalLogs.send({ embeds: [logEmbed] }); } catch {}
      }

      // Si entró hoy → resetear advertencias
      if (cumplioHoy) {
        userData.advertencias = 0;
        userData.botFirstSeen = Date.now();
        if (userData.lastSeen) userData.botFirstSeen = userData.lastSeen;
        continue;
      }

      if (excusado) continue;

      // Aviso diario en canal de advertencias
      if (diasSin >= 1 && canalAdv) {
        try {
          await canalAdv.send(
            `${member} hoy no entraste, recuerda que si no entras manda <@&${ROL_AVISO_ID}>.`
          );
        } catch {}
      }

      if (!userData.advertencias) userData.advertencias = 0;

      // DÍA 3 — Advertencia 1
      if (diasSin === DIA_ADV_1 && userData.advertencias < 1) {
        userData.advertencias = 1;
        await enviarSancion(member, canalSancion, 1, diasSin,
          `Llevas **${diasSin} días** sin conectarte al canal de voz.\nEsta es tu **primera advertencia**.`,
          0xf39c12, "⚠️"
        );
        await enviarDM(member, diasSin, 1, "Esta es tu primera advertencia por inactividad.");
      }

      // DÍA 6 — Advertencia 2
      else if (diasSin === DIA_ADV_2 && userData.advertencias < 2) {
        userData.advertencias = 2;
        await enviarSancion(member, canalSancion, 2, diasSin,
          `Llevas **${diasSin} días** sin conectarte.\nEsta es tu **segunda advertencia**.\nSi no te conectas pronto perderás tu rol.`,
          0xe67e22, "🚨"
        );
        await enviarDM(member, diasSin, 2, "Esta es tu segunda advertencia. Conéctate pronto o perderás tu rol.");
      }

      // DÍA 11 — Advertencia final
      else if (diasSin === DIA_ADV_3 && userData.advertencias < 3) {
        userData.advertencias = 3;
        await enviarSancion(member, canalSancion, 3, diasSin,
          `Llevas **${diasSin} días** sin conectarte.\n🚨 **ÚLTIMA ADVERTENCIA** — Si mañana no te conectas serás **expulsado del rol**.`,
          0xe74c3c, "🚨"
        );
        await enviarDM(member, diasSin, 3, "🚨 ÚLTIMA ADVERTENCIA. Si no te conectas mañana perderás tu rol definitivamente.");
      }

      // DÍA 12 — Quitar rol
      else if (diasSin >= DIA_EXPULSA) {
        try {
          await member.roles.remove(ACTIVITY_ROLE_ID);
          userData.advertencias = 0;

          // Embed en sanciones
          if (canalSancion) {
            const embed = new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("🚫 Expulsado por Inactividad")
              .setThumbnail(member.user.displayAvatarURL())
              .setDescription(
                `${member} ha sido **expulsado del rol de actividad**.\n\n` +
                `📉 Días sin entrar: **${diasSin} días**\n` +
                `⚠️ Advertencias recibidas: **3/3**\n\n` +
                `<@&${STAFF_ROLE_ID}> revisar roles adicionales si aplica.`
              )
              .addFields(
                { name: "⚠️ Advertencias",  value: "3 / 3",       inline: true },
                { name: "📉 Días inactivo", value: `${diasSin}d`,  inline: true },
                { name: "📅 Fecha",         value: fechaHoy,       inline: true },
              )
              .setTimestamp();
            await canalSancion.send({ embeds: [embed] });
          }

          // Aviso en canal de advertencias
          if (canalAdv) {
            try {
              await canalAdv.send(
                `🚫 ${member} fue **expulsado del rol de actividad** por **${diasSin} días** de inactividad.`
              );
            } catch {}
          }

          // DM al usuario
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("🚫 Rol de Actividad Removido")
              .setDescription(
                `Hola **${member.user.username}**,\n\n` +
                `Tu rol fue **removido** por **${diasSin} días** de inactividad.\n\n` +
                `Habla con el staff si deseas recuperarlo. 🙏`
              )
              .setTimestamp();
            await member.send({ embeds: [dmEmbed] });
          } catch {}

          console.log(`[INACTIVIDAD] Rol removido: ${member.user.tag} (${diasSin}d)`);
        } catch (e) {
          console.error(`[INACTIVIDAD] Error:`, e);
        }
      }

      if (userData.lastSeen) userData.botFirstSeen = userData.lastSeen;
    }

    saveData(data);
    console.log("[INACTIVIDAD] Completado.");
  } catch (err) {
    console.error("[INACTIVIDAD] Error:", err);
  }
}

async function enviarSancion(member, canal, numero, diasSin, mensaje, color, emoji) {
  if (!canal) return;
  try {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} Advertencia ${numero}/3 — ${member.user.username}`)
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`${member}\n\n${mensaje}`)
      .addFields(
        { name: "⚠️ Advertencia nº", value: `${numero} / 3`, inline: true },
        { name: "📉 Días inactivo",  value: `${diasSin}d`,   inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${member.id}` });
    await canal.send({ embeds: [embed] });
  } catch (err) {
    console.error("[SANCION] Error:", err);
  }
}

async function enviarDM(member, diasSin, numAdv, extra) {
  try {
    const embed = new EmbedBuilder()
      .setColor(numAdv === 3 ? 0xe74c3c : 0xe67e22)
      .setTitle(`⚠️ Advertencia ${numAdv}/3 de Inactividad`)
      .setDescription(
        `Hola **${member.user.username}**,\n\n` +
        `Llevas **${diasSin} día(s)** sin conectarte.\n\n${extra}\n\n¡Te esperamos! 🎙️`
      )
      .setTimestamp();
    await member.send({ embeds: [embed] });
  } catch {}
}

module.exports = { startInactividadTask };
