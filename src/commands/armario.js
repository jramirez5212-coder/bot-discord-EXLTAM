const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const CANAL_LOGS_ROLAS_ID = "1516259267374612500"; // canal donde Rolas Academy manda los mensajes
const BOT_ROLAS_NAME      = "Rolas Academy";        // nombre del bot externo
const DATA_FILE           = path.join(__dirname, "../../armario_data.json");

// Umbrales para alertas de "está sacando mucho"
const ALERTAS = [
  { cantidad: 5,  mensaje: "👀 **OJO** — {usuario} ya sacó **{total}** {arma} hoy. ¿Está acumulando?" },
  { cantidad: 10, mensaje: "⚠️ **ALERTA** — {usuario} lleva **{total}** {arma} sacadas hoy. Revisar." },
  { cantidad: 20, mensaje: "🚨 **MUCHAS** — {usuario} tiene **{total}** {arma} sacadas hoy. ¡Ojo con esto!" },
];

// ── Persistencia ──────────────────────────────────────────────────────────────
function loadArmario() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
function saveArmario(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUsuario(data, userId, tag) {
  if (!data[userId]) data[userId] = { tag, armas: {}, dinero: { total: 0 }, hoy: {} };
  if (!data[userId].hoy) data[userId].hoy = {};
  data[userId].tag = tag;
  return data[userId];
}

function fechaHoy() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// ── Parser de líneas del bot Rolas Academy ───────────────────────────────────
// Formatos:
// "@usuario saco N WEAPON_XXX de banda_exlatam (stock)"
// "@usuario metio N WEAPON_XXX en banda_exlatam (stock)"
// "@usuario saco N money de banda_exlatam (stock)"
// "@usuario metio N money en banda_exlatam (stock)"
function parsearLinea(linea) {
  const regex = /^<@!?(\d+)>\s+(saco|metio)\s+(\d+)\s+(\S+)\s+(de|en)\s+\S+\s+\((\d+)\)/i;
  const match = linea.match(regex);
  if (!match) return null;
  return {
    userId:  match[1],
    accion:  match[2].toLowerCase(), // "saco" | "metio"
    cantidad: parseInt(match[3]),
    item:    match[4].toUpperCase(), // "WEAPON_SMG", "money", etc.
    stock:   parseInt(match[6]),
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────
async function handleArmarioLogs(message) {
  if (message.channel.id !== CANAL_LOGS_ROLAS_ID) return;
  if (!message.author.bot) return;
  if (!message.author.username.includes("Rolas Academy") &&
      !message.webhookId) return;

  const lineas = message.content.split("\n").filter(Boolean);
  if (!lineas.length) return;

  const data   = loadArmario();
  const hoy    = fechaHoy();
  const alertas = [];

  for (const linea of lineas) {
    const parsed = parsearLinea(linea);
    if (!parsed) continue;

    // Necesitamos el tag del usuario — intentamos resolverlo desde la mención
    let tag = `<@${parsed.userId}>`;
    try {
      const member = await message.guild.members.fetch(parsed.userId).catch(() => null);
      if (member) tag = member.user.tag;
    } catch {}

    const ud = getUsuario(data, parsed.userId, tag);
    const { item, accion, cantidad } = parsed;

    // Inicializar arma si no existe
    if (!ud.armas[item]) ud.armas[item] = { saco: 0, metio: 0 };
    if (!ud.hoy[hoy])    ud.hoy[hoy]   = {};
    if (!ud.hoy[hoy][item]) ud.hoy[hoy][item] = { saco: 0, metio: 0 };

    // Registrar
    if (item === "MONEY") {
      if (!ud.dinero) ud.dinero = { total: 0 };
      ud.dinero.total += accion === "saco" ? cantidad : -cantidad;
    } else {
      ud.armas[item][accion]       += cantidad;
      ud.hoy[hoy][item][accion]    += cantidad;

      // Verificar alertas si sacó
      if (accion === "saco") {
        const totalHoySacado = ud.hoy[hoy][item].saco;
        for (const alerta of ALERTAS) {
          if (totalHoySacado === alerta.cantidad) {
            alertas.push({
              userId: parsed.userId,
              tag,
              item,
              total: totalHoySacado,
              msg: alerta.mensaje
                .replace("{usuario}", `<@${parsed.userId}>`)
                .replace("{total}", totalHoySacado)
                .replace("{arma}", item),
            });
          }
        }
      }
    }
  }

  saveArmario(data);

  // Mandar alertas en el mismo canal
  for (const alerta of alertas) {
    try {
      await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🔫 Alerta de Armario")
          .setDescription(alerta.msg)
          .setTimestamp()]
      });
    } catch (e) {
      console.error("[ARMARIO] Error alerta:", e.message);
    }
  }
}

// ── Comando !armario @usuario ─────────────────────────────────────────────────
async function handleArmarioCommand(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!armario")) return;

  const target = message.mentions.members.first() || message.member;
  const data   = loadArmario();
  const ud     = data[target.id];

  if (!ud || !Object.keys(ud.armas || {}).length) {
    return message.reply(`❌ No hay registros de armario para ${target}.`);
  }

  const hoy      = fechaHoy();
  const armasHoy = ud.hoy?.[hoy] || {};

  // Tabla de armas totales
  const lineasArmas = Object.entries(ud.armas)
    .sort((a, b) => b[1].saco - a[1].saco)
    .map(([item, vals]) => {
      const hoyItem = armasHoy[item] || { saco: 0, metio: 0 };
      return `**${item}**\n↑ Sacó: ${vals.saco} (hoy: ${hoyItem.saco}) | ↓ Metió: ${vals.metio} (hoy: ${hoyItem.metio})`;
    });

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle(`🔫 Armario de ${target.user.tag}`)
    .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
    .setDescription(lineasArmas.join("\n\n") || "Sin registros de armas.")
    .setTimestamp()
    .setFooter({ text: `Datos acumulados desde que el bot empezó a registrar` });

  if (ud.dinero?.total !== undefined) {
    embed.addFields({ name: "💰 Dinero neto (saco - metio)", value: `$${ud.dinero.total.toLocaleString()}`, inline: true });
  }

  await message.reply({ embeds: [embed] });
}

// ── Comando !toparmario ───────────────────────────────────────────────────────
async function handleTopArmario(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!toparmario")) return;

  const data = loadArmario();
  const hoy  = fechaHoy();

  // Calcular total de armas sacadas por usuario hoy
  const ranking = Object.entries(data)
    .map(([uid, ud]) => {
      const armasHoy = ud.hoy?.[hoy] || {};
      const totalHoy = Object.values(armasHoy).reduce((sum, v) => sum + (v.saco || 0), 0);
      const totalGen  = Object.values(ud.armas || {}).reduce((sum, v) => sum + (v.saco || 0), 0);
      return { uid, tag: ud.tag, totalHoy, totalGen };
    })
    .filter(u => u.totalGen > 0)
    .sort((a, b) => b.totalGen - a.totalGen)
    .slice(0, 10);

  if (!ranking.length) return message.reply("❌ No hay datos de armario registrados.");

  const medalias = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  const lineas   = ranking.map((u, i) =>
    `${medalias[i]} **${u.tag}** — ${u.totalGen} armas sacadas en total (hoy: ${u.totalHoy})`
  );

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("🏆 Top Armario — Armas Sacadas")
    .setDescription(lineas.join("\n"))
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

module.exports = { handleArmarioLogs, handleArmarioCommand, handleTopArmario };
