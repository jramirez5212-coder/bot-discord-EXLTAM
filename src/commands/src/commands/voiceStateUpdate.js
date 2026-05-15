const { loadData, saveData, getUser, cleanOldDays, todayKey } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, MAX_SESSION_MS }                    = require("../config");

const activeSessions = new Map();
const pendingUpdates = new Map();

module.exports = {
  activeSessions,
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    if (!member.roles.cache.has(ACTIVITY_ROLE_ID)) return;

    const userId = member.id;
    const entró  = !oldState.channelId && newState.channelId;
    const salió  = oldState.channelId  && !newState.channelId;

    if (entró) {
      activeSessions.set(userId, Date.now());
      console.log(`[VOZ] ▶ ${member.user.tag} entró a #${newState.channel?.name}`);
    }

    if (salió) {
      const joinedAt = activeSessions.get(userId);
      if (joinedAt) {
        const duration = Date.now() - joinedAt;
        if (duration > 0 && duration < MAX_SESSION_MS) {
          const data     = loadData();
          const userData = getUser(data, userId);
          const hoy      = todayKey();

          userData.totalMs  += duration;
          userData.weekMs   += duration;
          userData.lastSeen  = Date.now();

          if (!userData.days[hoy]) userData.days[hoy] = { totalMs: 0 };
          userData.days[hoy].totalMs += duration;

          const ayer = new Date();
          ayer.setDate(ayer.getDate() - 1);
          const ayerKey = ayer.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
          if (userData.ultimoDiaContinuo === ayerKey || userData.ultimoDiaContinuo === hoy) {
            if (userData.ultimoDiaContinuo !== hoy) {
              userData.diasSeguidos = (userData.diasSeguidos || 0) + 1;
              userData.ultimoDiaContinuo = hoy;
            }
          } else {
            userData.diasSeguidos = 1;
            userData.ultimoDiaContinuo = hoy;
          }

          cleanOldDays(userData);
          saveData(data);
          console.log(`[VOZ] ✓ ${member.user.tag} +${Math.floor(duration/60000)}m`);
        }
        activeSessions.delete(userId);
      }

      clearTimeout(pendingUpdates.get(userId));
      pendingUpdates.set(userId, setTimeout(() => {
        client.emit("updateActividadEmbed");
        pendingUpdates.delete(userId);
      }, 5000));
    }
  },
};
