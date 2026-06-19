const { EmbedBuilder } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const CANAL_TRIUNFOS_ID = "1516259316225671263";
const CANAL_LOGS_ID     = "1517003347561938954";
const DATA_FILE         = path.join(__dirname, "../../triunfos_data.json");

// ── Persistencia ──────────────────────────────────────────────────────────────
function loadTriunfos() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
function saveTriunfos(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Mensaje fijado ─────────────────────────────────────────────────────────────
let pinnedTriunfosMsgId = null;

async function ensurePinnedTriunfos(canal) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("🏆 ¡COMPARTE TUS TRIUNFOS!")
    .setDescription(
      "¿Ganaste un torneo? ¿Hiciste algo épico? **¡Sube tu foto o clip aquí!**\n\n" +
      "🎁 **Habrá premio para quien más triunfos acumule al final del mes.**\n" +
      "El bot lleva el registro automáticamente — cada cosa que subas cuenta.\n\n" +
      "📌 Solo fotos y videos relacionados con logros en el servidor.\n" +
      "🤖 El bot repostea todo automáticamente mostrando quién lo envió."
    )
    .setFooter({ text: "¡El que más triunfos acumule se lleva el premio mensual! 🥇" })
    .setTimestamp();

  if (pinnedTriunfosMsgId) {
    try {
      const old = await canal.messages.fetch(pinnedTriunfosMsgId);
      await old.delete();
    } catch {}
  }

  try {
    const msg = await canal.send({ embeds: [embed] });
    pinnedTriunfosMsgId = msg.id;
  } catch (e) {
    console.error("[TRIUNFOS] Error enviando mensaje fijado:", e.message);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
async function handleTriunfos(message) {
  if (message.author.bot) return;
  if (message.channel.id !== CANAL_TRIUNFOS_ID) return;

  const contenido = message.content?.trim() || "";
  const adjuntos  = [...message.attachments.values()];

  if (!contenido && adjuntos.length === 0) return;

  // Esperar 3 segundos para que el CDN de Discord procese el adjunto
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Descargar adjuntos a memoria
  const archivosDescargados = [];
  for (const a of adjuntos) {
    try {
      const res    = await fetch(a.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      archivosDescargados.push({ buffer, name: a.name || "archivo", contentType: a.contentType });
    } catch (e) {
      console.error("[TRIUNFOS] Error descargando adjunto:", e.message);
    }
  }

  // Actualizar registro
  const data = loadTriunfos();
  if (!data[message.author.id]) data[message.author.id] = { tag: message.author.tag, total: 0 };
  data[message.author.id].total++;
  data[message.author.id].tag = message.author.tag;
  const totalUsuario = data[message.author.id].total;
  saveTriunfos(data);

  // Embed de repost
  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setDescription(contenido || null)
    .setFooter({ text: `Triunfo #${totalUsuario} de ${message.author.tag} • ID: ${message.author.id}` })
    .setTimestamp();

  const imagenDescargada = archivosDescargados.find(a => a.contentType?.startsWith("image/"));
  if (imagenDescargada) embed.setImage(`attachment://${imagenDescargada.name}`);

  try {
    await message.channel.send({
      content: `🏆 Triunfo de ${message.author}`,
      embeds:  [embed],
      files:   archivosDescargados.map(a => ({ attachment: a.buffer, name: a.name })),
    });
  } catch (e) {
    console.error("[TRIUNFOS] Error reenviando:", e.message);
  }

  // Borrar mensaje original
  try { await message.delete(); } catch {}

  // Log en canal de logs
  try {
    const canalLogs = await message.client.channels.fetch(CANAL_LOGS_ID);
    if (canalLogs) {
      // Top 3 actual
      const top3 = Object.entries(data)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 3)
        .map(([, v], i) => `${["🥇","🥈","🥉"][i]} **${v.tag}** — ${v.total} triunfos`);

      const logEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("📋 Nuevo Triunfo Registrado")
        .setDescription(
          `**Usuario:** ${message.author}\n` +
          `**Triunfo #:** ${totalUsuario} (acumulado)\n` +
          `${contenido ? `**Mensaje:** ${contenido}\n` : ""}` +
          `\n🏅 **Top 3 del mes:**\n${top3.join("\n")}`
        )
        .setTimestamp();
      await canalLogs.send({ embeds: [logEmbed] });
    }
  } catch (e) {
    console.error("[TRIUNFOS] Error enviando log:", e.message);
  }

  // Re-enviar mensaje fijado al final para que siempre quede abajo
  await ensurePinnedTriunfos(message.channel);
}

module.exports = { handleTriunfos };
