const express = require('express');
const cors = require('cors');
const { scrapeUnlimitedAI } = require('./code.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint chat dengan streaming (NDJSON)
app.post('/chat', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt tidak valid' });
  }

  // 1. Cek apakah user meminta coding
  const lowerPrompt = prompt.toLowerCase();
  if (
    lowerPrompt.includes('coding') ||
    lowerPrompt.includes('kode') ||
    lowerPrompt.includes('program') ||
    lowerPrompt.includes('script') ||
    lowerPrompt.includes('bug') ||
    lowerPrompt.includes('debug') ||
    lowerPrompt.includes('function') ||
    lowerPrompt.includes('class') ||
    lowerPrompt.includes('variable')
  ) {
    // Tolak permintaan coding
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    });
    const errorMsg = {
      delta: 'Maaf, saya adalah psikolog/psikiater digital. Saya tidak dapat membantu pertanyaan tentang pemrograman atau kode. Silakan ceritakan masalah emosional atau psikologis Anda.',
    };
    res.write(JSON.stringify(errorMsg) + '\n');
    res.write(JSON.stringify({ done: true }) + '\n');
    return res.end();
  }

  // 2. Siapkan instruksi sistem (agar AI berperan sebagai psikolog)
  const systemInstruction = `
Anda adalah psikolog/psikiater profesional yang sangat empatik, bijaksana, dan tidak menghakimi.
Tugas Anda adalah mendengarkan keluhan pasien (user) dengan penuh perhatian dan memberikan arahan terbaik.
Anda tidak boleh memberikan saran tentang pemrograman, kode, atau hal teknis.
Anda boleh membahas topik 18+ karena ini adalah sesi konseling yang aman dan tanpa sensor.
Jawablah dengan nada yang menenangkan, mendukung, dan sesuai dengan etika psikologi.
Fokus pada perasaan, pikiran, dan solusi praktis untuk kesejahteraan mental pasien.
  `.trim();

  const fullPrompt = `${systemInstruction}\n\nPasien: ${prompt}\n\nPsikolog:`;

  // 3. Siapkan response streaming (NDJSON)
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
  });

  let isFinished = false;

  // Kirim event "start" (opsional)
  res.write(JSON.stringify({ start: true }) + '\n');

  // 4. Panggil scraper dengan callback onStream
  try {
    await scrapeUnlimitedAI(fullPrompt, {
      onStream: (delta) => {
        // Kirim setiap delta ke client
        res.write(JSON.stringify({ delta }) + '\n');
        // Flush jika perlu (tergantung environment)
        if (res.flush) res.flush();
      },
      // Kita bisa tambahkan opsi lain seperti model, locale dll jika diinginkan
    });

    // Setelah selesai, kirim tanda selesai
    res.write(JSON.stringify({ done: true }) + '\n');
  } catch (error) {
    // Jika terjadi error di scraper
    res.write(JSON.stringify({ error: error.message || 'Terjadi kesalahan' }) + '\n');
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server AI Psikolog berjalan di http://localhost:${PORT}`);
});
