const { EmbedBuilder } = require("discord.js");

const CANAL_TRIUNFOS_ID = "1517003347561938954"; // canal donde la gente manda triunfos (repost) y también logs
// Nota: usamos el mismo canal para el repost y para el log, según lo indicado.

async function handleTriunfos(message) {
  if (message.author.bot) return;
  if (message.channel.id !== CANAL_TRIUNFOS_ID) return;

  const contenido = message.content?.trim() || "";
  const adjuntos  = [...message.attachments.values()];

  if (!contenido && adjuntos.length === 0) return;

  try {
    await message.delete();
  } catch (e) {
    console.error("[TRIUNFOS] Error borrando mensaje original:", e.message);
  }

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setDescription(contenido || null)
    .setFooter({ text: `Enviado por ${message.author.tag} • ID: ${message.author.id}` })
    .setTimestamp();

  // Si hay una sola imagen, la mostramos como imagen principal del embed
  const imagen = adjuntos.find(a => a.contentType?.startsWith("image/"));
  if (imagen) embed.setImage(imagen.url);

  try {
    await message.channel.send({
      content: `🏆 Triunfo de ${message.author}`,
      embeds: [embed],
      files: adjuntos.filter(a => a.url !== imagen?.url).map(a => a.url), // adjuntos extra (videos u otras imágenes)
    });
  } catch (e) {
    console.error("[TRIUNFOS] Error reenviando:", e.message);
  }
}

module.exports = { handleTriunfos };
