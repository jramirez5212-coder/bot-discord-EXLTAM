const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { CANAL_CMD_TORNEO } = require("../config");

const CANAL_PANEL_EVENTOS = "1516259370994761781";

const EMOJIS = {
  torneo:      "🏆",
  tormenta:    "🌪️",
  battle:      "💥",
  drop:        "🎁",
  mega_torneo: "🔥",
  mega_battle: "⚔️",
};

const RANKS = {
  F1: { color: 0xffffff, emoji: "⬜" },
  F4: { color: 0x39FF14, emoji: "🟩" },
  F7: { color: 0xff6b00, emoji: "🟧" },
  F9: { color: 0xe74c3c, emoji: "🟥" },
};

let panelMessageId = null;

// ── PANEL DE EVENTOS ──────────────────────────────────────────────────────────
function buildPanelEmbed(EVENTOS) {
  const ahora = (() => {
    const c = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
    return c.getHours() * 60 + c.getMinutes();
  })();

  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }

  const ordenados = [...EVENTOS].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));

  // Encontrar evento actual (el último que ya pasó)
  let eventoActual = null;
  let eventoActualIdx = -1;
  for (let i = ordenados.length - 1; i >= 0; i--) {
    if (horaAMin(ordenados[i].hora) <= ahora) {
      eventoActual    = ordenados[i];
      eventoActualIdx = i;
      break;
    }
  }
  // Si no hay ninguno que haya pasado, el actual es el último del día anterior
  if (!eventoActual) {
    eventoActual    = ordenados[ordenados.length - 1];
    eventoActualIdx = ordenados.length - 1;
  }

  // Próximos 2 eventos
  const proximos = [];
  for (let i = 1; i <= 2; i++) {
    const idx = (eventoActualIdx + i) % ordenados.length;
    const e   = ordenados[idx];
    const diffMin = (horaAMin(e.hora) - ahora + 1440) % 1440;
    proximos.push({ ...e, diffMin });
  }

  const emoji = EMOJIS[eventoActual.tipo] || "🎮";
  const rankInfo = RANKS[eventoActual.rank] || {};

  const embed = new EmbedBuilder()
    .setColor(rankInfo.color || 0x39FF14)
    .setTitle("📊 Panel de Eventos — EXLATAM")
    .addFields(
      {
        name: "🟢 ── AHORA ──",
        value: `${eventoActual.hora} — ${emoji} **${eventoActual.nombre}**${eventoActual.puntos ? ` → ${eventoActual.puntos}` : ""} → Rank **${eventoActual.rank}**\n🟢 **EN CURSO**`,
        inline: false
      },
      {
        name: "📅 ── EVENTOS PRÓXIMOS ──",
        value: proximos.map(e => {
          const em = EMOJIS[e.tipo] || "🎮";
          return `${e.hora} — ${em} **${e.nombre}**${e.puntos ? ` → ${e.puntos}` : ""} → Rank **${e.rank}**\n⏳ En ${e.diffMin} minutos`;
        }).join("\n\n"),
        inline: false
      }
    )
    .setFooter({ text: `Sistema de Eventos — EXLATAM | Última actualización` })
    .setTimestamp();

  return embed;
}

function buildListadoEmbed(EVENTOS) {
  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }
  const ordenados = [...EVENTOS].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));

  const lineas = ordenados.map(e => {
    const em = EMOJIS[e.tipo] || "🎮";
    return `• **${e.hora}** — ${em} ${e.nombre}${e.puntos ? ` → ${e.puntos}` : ""} → Rank **${e.rank}**`;
  });

  return new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle("📋 Listado de eventos")
    .setDescription(lineas.join("\n"))
    .setTimestamp();
}

async function initPanelEventos(client, EVENTOS) {
  try {
    const canal = await client.channels.fetch(CANAL_PANEL_EVENTOS);
    if (!canal) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("panel_ver_todos").setLabel("Ver todos los eventos").setEmoji("📋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("panel_proximo_torneo").setLabel("Ver próximo torneo").setEmoji("🏆").setStyle(ButtonStyle.Primary)
    );

    const embed = buildPanelEmbed(EVENTOS);

    if (panelMessageId) {
      try {
        const msg = await canal.messages.fetch(panelMessageId);
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      } catch {}
    }

    // Buscar mensaje existente del bot en el canal
    const msgs = await canal.messages.fetch({ limit: 20 });
    const existing = msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (existing) {
      panelMessageId = existing.id;
      await existing.edit({ embeds: [embed], components: [row] });
      return;
    }

    const msg = await canal.send({ embeds: [embed], components: [row] });
    panelMessageId = msg.id;
  } catch (e) {
    console.error("[PANEL] Error:", e.message);
  }
}

async function handlePanelButton(interaction, EVENTOS) {
  if (!interaction.isButton()) return;
  if (!["panel_ver_todos", "panel_proximo_torneo"].includes(interaction.customId)) return;

  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }

  if (interaction.customId === "panel_ver_todos") {
    const embed = buildListadoEmbed(EVENTOS);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.customId === "panel_proximo_torneo") {
    const ahora = (() => {
      const c = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      return c.getHours() * 60 + c.getMinutes();
    })();
    const ordenados = [...EVENTOS].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));
    const proximo = ordenados.find(e => horaAMin(e.hora) > ahora) || ordenados[0];
    const diffMin = ((horaAMin(proximo.hora) - ahora) + 1440) % 1440;
    const emoji = EMOJIS[proximo.tipo] || "🎮";

    const embed = new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle(`${emoji} Próximo torneo`)
      .setDescription(
        `**${proximo.nombre}**\n` +
        `📅 **Hora:** ${proximo.hora}\n` +
        `🏅 **Rank:** ${proximo.rank}\n` +
        `${proximo.puntos ? `🎯 **Puntos:** ${proximo.puntos}\n` : ""}` +
        `⏳ **En:** ${diffMin} minutos`
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// ── CREADOR DE EMBEDS ─────────────────────────────────────────────────────────
// Uso: !embed #canal | titulo | descripcion | #color | logo_url | banner_url | footer
async function handleEmbedCreator(message) {
  if (message.author.bot) return;
  if (!message.content.trim().startsWith("!embed")) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
    return message.reply("❌ Solo el admin/dueño puede usar este comando.");

  const args = message.content.slice("!embed".length).trim();
  const partes = args.split("|").map(p => p.trim());

  if (partes.length < 2) {
    return message.reply(
      "❌ Uso correcto:\n" +
      "`!embed #canal | titulo | descripcion | #color | logo_url | banner_url | footer`\n\n" +
      "Solo son obligatorios `#canal` y `titulo`. El resto es opcional. Usa `_` para dejar un campo vacío.\n\n" +
      "**Ejemplo:**\n" +
      "`!embed #anuncios | ¡Nuevo evento! | Hay torneo hoy a las 20:00 | #39FF14 | https://logo.png | https://banner.png | EXLATAM`"
    );
  }

  const [canalMencion, titulo, descripcion, colorHex, logoUrl, bannerUrl, footer] = partes;
  const canalId = canalMencion.replace(/[<#>]/g, "");
  const canal   = await message.guild.channels.fetch(canalId).catch(() => null);

  if (!canal) return message.reply("❌ No encontré ese canal. Asegúrate de mencionarlo con #.");

  const color = colorHex && colorHex !== "_" && colorHex.startsWith("#")
    ? parseInt(colorHex.replace("#", ""), 16)
    : 0x39FF14;

  const embed = new EmbedBuilder().setColor(color).setTimestamp();

  if (titulo && titulo !== "_")      embed.setTitle(titulo);
  if (descripcion && descripcion !== "_") embed.setDescription(descripcion);
  if (logoUrl && logoUrl !== "_")    embed.setThumbnail(logoUrl);
  if (bannerUrl && bannerUrl !== "_") embed.setImage(bannerUrl);
  if (footer && footer !== "_")      embed.setFooter({ text: footer });

  try {
    await canal.send({ embeds: [embed] });
    await message.reply(`✅ Embed enviado en ${canal}.`);
  } catch (e) {
    await message.reply(`❌ No pude enviar el embed en ese canal: ${e.message}`);
  }
}

module.exports = { initPanelEventos, handlePanelButton, handleEmbedCreator };
