const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const os = require("os");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

async function bufferFromStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function runFFmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", input,
      "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
      "-vcodec", "libwebp",
      "-lossless", "1",
      "-q:v", "80",
      "-preset", "default",
      "-an",
      "-vsync", "0",
      output
    ];
    execFile("ffmpeg", args, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = {
  names: ["sticker", "s"],
  description: "Ubah media jadi sticker",
  async run({ sock, msg }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaMsg = quoted
      ? quoted.imageMessage || quoted.videoMessage
      : msg.message?.imageMessage || msg.message?.videoMessage || null;

    if (!mediaMsg) {
      return sock.sendMessage(msg.key.remoteJid, { text: "Balas gambar/video lalu ketik .sticker" }, { quoted: msg });
    }

    const mime = mediaMsg.mimetype || "";
    const isVideo = mime.startsWith("video/");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hexz-"));
    const input = path.join(tmpDir, isVideo ? "input.mp4" : "input.jpg");
    const output = path.join(tmpDir, "output.webp");

    try {
      const stream = await downloadContentFromMessage(mediaMsg, isVideo ? "video" : "image");
      const mediaBuffer = await bufferFromStream(stream);
      fs.writeFileSync(input, mediaBuffer);

      await runFFmpeg(input, output);

      const webp = fs.readFileSync(output);
      await sock.sendMessage(msg.key.remoteJid, { sticker: webp }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(msg.key.remoteJid, { text: "Gagal bikin sticker." }, { quoted: msg });
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
};