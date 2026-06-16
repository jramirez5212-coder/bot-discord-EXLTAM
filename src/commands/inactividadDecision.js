const { EmbedBuilder } = require("discord.js");
const { loadData, saveData, getUser } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, STAFF_ROLE_ID, CANAL_ADVERTENCIAS_ID } = require("../config");

async function handleInactividadDecision(interaction, client) {
  if (!interaction.isButton()) return;
  const isExpulsar    = interaction.customId.startsWith("expulsar_inactivo:");
  const isRestablecer = interaction.customId.startsWith("restablecer_inactivo:");
  if (!isExpulsar && !isRestablecer) return;

  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
    return interaction.reply({ content: "❌ Solo Staff puede tomar esta decisión.", ephemeral: true });

  const targetId = interaction.customId.split(":")[1];
  const data     = loadData();
  const userData = getUser(data, targetId);

  try {
    const guild  = await client.guilds.fetch(interaction.guildId);
    const member = await guild.members.fetch(targetId).catch(() => null);

    if (isExpulsar) {
      if (member) await member.roles.remove(ACTIVITY_ROLE_ID).catch(() => {});
      userData.advertencias        = 0;
      userData.pendienteExpulsion  = false;
      saveData(data);

      const canalAdv = await client.channels.fetch(CANAL_ADVERTENCIAS_ID).catch(() => null);
      if (canalAdv && member) {
        canalAdv.send(`🚫 ${member} fue **expulsado del rol de actividad** por inactividad. Decisión de ${interaction.user}.`).catch(() => {});
      }
      if (member) {
        member.send({ embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🚫 Rol de Actividad Removido")
          .setDescription(`Hola **${member.user.username}**,\n\nTu rol fue **removido** por inactividad.\n\nHabla con el staff si deseas recuperarlo. 🙏`)
          .setTimestamp()] }).catch(() => {});
      }

      await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xe74c3c)
          .setDescription(`✅ **Expulsado** por ${interaction.user}.`)],
        components: [],
      });
    } else {
      userData.advertencias       = 0;
      userData.pendienteExpulsion = false;
      userData.botFirstSeen       = Date.now();
      saveData(data);

      if (member) {
        member.send({ embeds: [new EmbedBuilder()
          .setColor(0x39FF14)
          .setTitle("♻️ Advertencias Restablecidas")
          .setDescription(`Hola **${member.user.username}**,\n\nEl staff te dio otra oportunidad y reinició tus advertencias. ¡Vuelve a entrar pronto! 🎙️`)
          .setTimestamp()] }).catch(() => {});
      }

      await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x39FF14)
          .setDescription(`♻️ **Advertencias restablecidas** por ${interaction.user}.`)],
        components: [],
      });
    }
  } catch (e) {
    console.error("[INACTIVIDAD_DECISION] Error:", e.message);
    if (!interaction.replied) await interaction.reply({ content: "❌ Ocurrió un error procesando la decisión.", ephemeral: true }).catch(() => {});
  }
}

module.exports = { handleInactividadDecision };
