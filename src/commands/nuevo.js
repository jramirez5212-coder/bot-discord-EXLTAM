const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { STAFF_ROLE_ID, LOGO_URL,
        CANAL_CMD_HORAS, CANAL_CMD_INACTIVO,
        CANAL_CMD_TORNEO, CANAL_CMD_ANUNCIOS } = require("../config");

// Roles que se le dan al nuevo miembro
const ROLES_NUEVO = [
  "1516258966756266054",
  "1516258974163402862",
  "1516258980601659583",
  "1516258985286696961",
];

const CANAL_BIENVENIDA_NUEVO = "1516662918664683561";
const CANAL_VIDEO_TUTORIAL   = "1516684343010136094";
const cooldowns = new Map();
const COOLDOWN_MS = 10 * 1000;

// Busca el adjunto de video más reciente en el canal fijo de tutorial
async function getTutorialVideoUrl(client) {
  try {
    const canal = await client.channels.fetch(CANAL_VIDEO_TUTORIAL);
    const mensajes = await canal.messages.fetch({ limit: 20 });
    for (const msg of mensajes.values()) {
      const video = msg.attachments.find(a => a.contentType?.startsWith("video/") || a.name?.endsWith(".mp4"));
      if (video) return video.url;
    }
  } catch (e) {
    console.error("[NUEVO] Error obteniendo video tutorial:", e.message);
  }
  return null;
}

// Mensaje DM completo
function buildDMEmbed(member) {
  return new EmbedBuilder()
    .setColor(0x39FF14)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTitle("<:exlatam:1496642022759596245> ¡Bienvenido/a a EXLATAM ROLAS!")
    .setDescription(
      `**Antes de continuar, lee atentamente las siguientes instrucciones:**\n\n` +

      `> 📋 __**REGLAS OBLIGATORIAS EX**__\n` +
      `- **OBLIGATORIO TENER LA ETIQUETA DEL SERVIDOR.**\n` +
      `- **SIEMPRE QUE JUEGUES ESTAR EN CANAL DE VOZ.** *¡Recuerda somos una comunidad, te puedes quedar a charlar!*\n` +
      `- **PROHIBIDO SACAR DE FORMA EXCESIVA COSAS DEL ARMARIO DE LA BANDA. LO QUE SAQUES LO DEVUELVES.**\n` +
      `- **OBLIGATORIO TENER LA CAMISA DE LA BANDA. LO DEMÁS LO QUE QUIERAS.**\n\n` +

      `> 🎙️ __**ACTIVIDAD DE VOZ**__\n` +
      `- Debes conectarte diariamente al canal de voz\n` +
      `- Tu tiempo se registra automáticamente\n` +
      `- Si no puedes conectarte usa \`!inactivo\` para justificarte\n` +
      `- Llevas **1 día** sin entrar = advertencia | **6 días** = pierdes el rol\n\n` +

      `> 📢 __**COMANDOS DISPONIBLES**__\n` +
      `- \`!horas\` → Ver tus horas acumuladas — úsalo en <#${CANAL_CMD_HORAS}>\n` +
      `- \`!top\` → Ver el ranking semanal — úsalo en <#${CANAL_CMD_HORAS}>\n` +
      `- \`!inactivo\` → Justificar inactividad — úsalo en <#${CANAL_CMD_INACTIVO}>\n` +
      `- \`!torneo\` → Crear un torneo — úsalo en <#${CANAL_CMD_TORNEO}>\n` +
      `- \`!activense\` \`!tormenta\` \`!battle\` \`!drop\` → Notificar eventos a la banda — úsalos en <#${CANAL_CMD_ANUNCIOS}>\n\n` +

      `> 📍 __**CANALES IMPORTANTES**__\n` +
      `- Los comandos solo funcionan en sus canales específicos\n` +
      `- Lee los canales de información del servidor\n\n` +

      `✅ **Presiona el botón de abajo para confirmar que leíste las instrucciones y recibir tu bienvenida oficial.**`
    )
    .setTimestamp();
}

async function handleNuevo(message, client) {
  if (message.author.bot) return;
  if (message.content.trim().split(/\s+/)[0].toLowerCase() !== "!nuevo") return;

  // Solo staff
  if (!message.member?.roles?.cache?.has(STAFF_ROLE_ID) &&
      !message.member?.permissions?.has(8n))
    return message.reply("❌ No tienes permiso para usar este comando.");

  const target = message.mentions.members.first();
  if (!target)
    return message.reply("❌ Uso: `!nuevo @usuario`");

  const key    = `nuevo:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    return message.reply("⏳ Espera unos segundos antes de usar este comando de nuevo.");
  }
  cooldowns.set(key, Date.now());

  // Dar roles
  const rolesOk = [];
  const rolesFail = [];
  for (const rolId of ROLES_NUEVO) {
    try {
      await target.roles.add(rolId);
      rolesOk.push(rolId);
    } catch {
      rolesFail.push(rolId);
    }
  }

  // Enviar DM con instrucciones y botón
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_leido:${target.id}`)
        .setLabel("✅ Leído — ¡Entendido!")
        .setStyle(ButtonStyle.Success)
    );

    await target.send({
      embeds:     [buildDMEmbed(target)],
      components: [row]
    });

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x39FF14)
        .setTitle("✅ Nuevo miembro procesado")
        .setDescription(
          `${target} fue procesado correctamente.\n\n` +
          `📩 DM enviado con instrucciones\n` +
          `🎭 Roles asignados: ${rolesOk.map(r=>`<@&${r}>`).join(", ")}\n` +
          (rolesFail.length ? `⚠️ Roles fallidos: ${rolesFail.map(r=>`<@&${r}>`).join(", ")}` : "")
        )
        .setTimestamp()]
    });

  } catch(e) {
    console.error("[NUEVO] Error enviando DM:", e.message);
    await message.reply(`⚠️ No pude enviar el DM a ${target} (privados cerrados). Roles asignados igualmente.`);
  }

  // Enviar tutorial en el mismo canal donde se usó el comando
  try {
    const videoUrl = await getTutorialVideoUrl(client);
    const rowTutorial = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial_claro:${target.id}`)
        .setLabel("✅ Todo claro")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tutorial_dudas:${target.id}`)
        .setLabel("❓ Tengo dudas")
        .setStyle(ButtonStyle.Danger)
    );

    const embedTutorial = new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle("🎬 Tutorial de Discord — EXLATAM")
      .setDescription(
        `${target}, antes de empezar mira el **tutorial completo** sobre cómo funciona el servidor.\n\n` +
        `📺 **Ve el video completo** para entender canales, comandos y reglas.\n\n` +
        (videoUrl ? "" : "⚠️ *No se encontró el video en este momento, avisa al staff.*")
      )
      .setTimestamp();

    await message.channel.send({
      content: videoUrl || undefined,
      embeds:  [embedTutorial],
      components: [rowTutorial]
    });
  } catch(e) {
    console.error("[NUEVO] Error enviando tutorial:", e.message);
  }
}

// Cuando el usuario presiona "Leído"
async function handleNuevoButton(interaction, client) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("btn_leido:")) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  // Deshabilitar botón
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_leido:${ownerId}`)
        .setLabel("✅ ¡Instrucciones leídas!")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.update({ components: [row] });
  } catch {}

  // Mandar bienvenida en el canal
  try {
    const canal = await client.channels.fetch(CANAL_BIENVENIDA_NUEVO);
    if (canal) {
      const embed = new EmbedBuilder()
        .setColor(0x39FF14)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `# <:exlatam:1496642022759596245> ¡Bienvenido/a a EXLATAM ROLAS <@${ownerId}>! <a:emoji_30:1504932273739530543>\n\n` +
          `<:emoji_27:1504932117233008671> **Ya eres parte oficial de la familia.**\n` +
          `-# <a:emoji_35:1504932489104195714> *¡Mucho éxito y a darle duro!* <a:emoji_35:1504932489104195714>`
        )
        .setTimestamp();

      await canal.send({
        content: `<@${ownerId}>`,
        embeds:  [embed]
      });
    }
  } catch(e) {
    console.error("[NUEVO] Error bienvenida canal:", e.message);
  }
}

// Botones del tutorial: "Todo claro" / "Tengo dudas"
async function handleTutorialButton(interaction, client) {
  if (!interaction.isButton()) return;
  const isClaro = interaction.customId.startsWith("tutorial_claro:");
  const isDudas = interaction.customId.startsWith("tutorial_dudas:");
  if (!isClaro && !isDudas) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  if (isClaro) {
    try {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tutorial_claro:${ownerId}`).setLabel("✅ Todo claro").setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`tutorial_dudas:${ownerId}`).setLabel("❓ Tengo dudas").setStyle(ButtonStyle.Danger).setDisabled(true)
      );
      await interaction.update({ components: [row] });
    } catch {}
    return interaction.followUp({ content: `✅ ${interaction.user} entendió el tutorial. ¡Bienvenido!`, ephemeral: false });
  }

  // Tengo dudas — notificar al staff
  try {
    await interaction.reply({ content: `❓ <@&${STAFF_ROLE_ID}> ${interaction.user} tiene dudas sobre el tutorial del servidor, por favor ayúdenle.`, ephemeral: false });
  } catch {}
}

module.exports = { handleNuevo, handleNuevoButton, handleTutorialButton };
