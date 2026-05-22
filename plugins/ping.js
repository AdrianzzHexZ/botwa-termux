module.exports = {
  names: ["ping", "p"],
  description: "Cek respon bot",
  async run({ sock, msg }) {
    const sent = Date.now();
    const m = await sock.sendMessage(msg.key.remoteJid, { text: "Pinging..." }, { quoted: msg });
    const diff = Date.now() - sent;
    await sock.sendMessage(msg.key.remoteJid, { text: `Pong: ${diff}ms` }, { quoted: m });
  }
};