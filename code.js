/**
 *   UNLIMITEDAI SCRAPER
 *   
 *   [•] AUTHOR      :: DEFAN
 *   [•] WEB         :: soonex.biz.id
 *   [•] DESCRIPTION :: Scraper for UnlimitedAI Chat API with streaming support
 *   [•] BASE        :: https://app.unlimitedai.chat/api/chat
 *   [•] CHANNEL     :: https://whatsapp.com/channel/0029Vb89qIx1XquQoXgzdd2m
 *   
 *   [!] ATTENTION:
 *   Modification without permission is prohibited.
 *   RESPECT THE AUTHOR, DO NOT REMOVE THIS WATERMARK!
 */

const https = require("https");
const { randomUUID } = require("crypto");

function scrapeUnlimitedAI(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const chatId = randomUUID();
    const messageId = randomUUID();
    const assistantId = randomUUID();
    const deviceId = options.deviceId || randomUUID();
    const locale = options.locale || "id";
    const model = options.model || "chat-model-reasoning";

    const body = JSON.stringify({
      chatId,
      messages: [
        {
          id: messageId,
          role: "user",
          content: prompt,
          parts: [{ type: "text", text: prompt }],
          createdAt: new Date().toISOString(),
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          parts: [{ type: "text", text: "" }],
          createdAt: new Date().toISOString(),
        },
      ],
      selectedChatModel: model,
      selectedCharacter: null,
      selectedStory: null,
      deviceId,
      locale,
    });

    const reqOptions = {
      hostname: "app.unlimitedai.chat",
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-next-intl-locale": locale,
        "Content-Length": Buffer.byteLength(body),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    };

    const req = https.request(reqOptions, (res) => {
      let fullText = "";
      let rawChunks = [];

      res.on("data", (chunk) => {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            rawChunks.push(parsed);
            if (parsed.type === "delta" && parsed.delta) {
              fullText += parsed.delta;
              if (options.onStream) options.onStream(parsed.delta);
            }
          } catch (_) {}
        }
      });

      res.on("end", () => {
        resolve({
          status: true,
          author: "DEFAN",
          web: "soonex.biz.id",
          result: {
            text: fullText,
            totalChars: fullText.length,
            chatId,
            deviceId,
            model,
            locale,
          },
          raw: rawChunks,
        });
      });

      res.on("error", (err) => {
        reject({
          status: false,
          author: "DEFAN",
          web: "soonex.biz.id",
          error: err.message,
        });
      });
    });

    req.on("error", (err) => {
      reject({
        status: false,
        author: "DEFAN",
        web: "soonex.biz.id",
        error: err.message,
      });
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  const prompt = process.argv[2] || "buat cerita seram";
  console.log(`Prompt: ${prompt}\n`);
  console.log("Response:\n" + "=".repeat(50));

  try {
    const result = await scrapeUnlimitedAI(prompt, {
      onStream: (delta) => process.stdout.write(delta),
    });

    console.log("\n" + "=".repeat(50));
    console.log("\nJSON Output:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("\nJSON Error Output:");
    console.error(JSON.stringify(err, null, 2));
  }
}

main();

module.exports = { scrapeUnlimitedAI };