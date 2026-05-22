module.exports = {
  names: ["owner"],
  description: "Info owner",
  async run({ sock, msg, config }) {
    const owner = config.owner?.[0] || "-";
    await sock.sendMessage(msg.key.remoteJid, { text: `Owner: ${owner}` }, { quoted: msg });
  }
};