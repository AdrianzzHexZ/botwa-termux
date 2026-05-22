const { runtime } = require("../lib/helper");

module.exports = {
  names: ["menu", "help"],
  description: "Daftar command",
  async run({ sock, msg, prefix, startTime, config }) {
    const text = [
      `*${config.botName}*`,
      "",
      `Prefix: ${prefix}`,
      `Runtime: ${runtime(process.uptime())}`,
      "",
      "Command:",
      `${prefix}menu`,
      `${prefix}ping`,
      `${prefix}sticker`,
      `${prefix}owner`,
      `${prefix}runtime`
    ].join("\n");
    await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
  }
};