const { EmbedBuilder } = require("discord.js");

const CANAL_TRIUNFOS_ID = "1516259316225671263"; // canal donde la gente manda triunfos (repost)
// Nota: usamos el mismo canal para el repost y para el log, según lo indicado.

async function handleTriunfos(message) {
  if (message.author.bot) return;
  if (message.channel.id !== CANAL_TRIUNFOS_ID) return;

  const contenido = message.content?.trim() || "";
  const adjuntos  = [...message.attachments.values()];

  if (!contenido && adjuntos.length === 0) return;

  // Esperamos 3 segundos para asegurar que el adjunto terminó de subirse/procesarse en el CDN de Discord
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Descargamos todos los adjuntos a memoria y los re-subimos como archivos nuevos.
  // Esto evita depender de la URL del mensaje original, que puede fallar al renderizar
  // si Discord la procesa justo cuando el mensaje original ya fue borrado.
  const archivosDescargados = [];
  for (const a of adjuntos) {
    try {
      const res = await fetch(a.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      archivosDescargados.push({ buffer, name: a.name || "archivo", contentType: a.contentType });
    } catch (e) {
      console.error("[TRIUNFOS] Error descargando adjunto:", e.message);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setDescription(contenido || null)
    .setFooter({ text: `Enviado por ${message.author.tag} • ID: ${message.author.id}` })
    .setTimestamp();

  // Si hay una sola imagen, la mostramos como imagen principal del embed
  const imagenDescargada = archivosDescargados.find(a => a.contentType?.startsWith("image/"));
  if (imagenDescargada) embed.setImage(`attachment://${imagenDescargada.name}`);

  try {
    await message.channel.send({
      content: `🏆 Triunfo de ${message.author}`,
      embeds: [embed],
      files: archivosDescargados.map(a => ({ attachment: a.buffer, name: a.name })),
    });
  } catch (e) {
    console.error("[TRIUNFOS] Error reenviando:", e.message);
  }

  // Borrar el mensaje original al final
  try {
    await message.delete();
  } catch (e) {
    console.error("[TRIUNFOS] Error borrando mensaje original:", e.message);
  }
}

module.exports = { handleTriunfos };
