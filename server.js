const express = require('express');
const cors = require('cors');
const path = require('path');
const { scrapeUnlimitedAI } = require('./code.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const CODING_KEYWORDS = [
  'coding', 'kode', 'program', 'script', 'bug', 'debug', 'function', 'class', 'variable',
];

const SYSTEM_INSTRUCTION = `
Anda adalah psikolog/psikiater profesional yang sangat empatik, bijaksana, dan tidak menghakimi.
Tugas Anda adalah mendengarkan keluhan pasien (user) dengan penuh perhatian dan memberikan arahan terbaik.
Anda tidak boleh memberikan saran tentang pemrograman, kode, atau hal teknis.
Anda boleh membahas topik 18+ karena ini adalah sesi konseling yang aman dan tanpa sensor.
Jawablah dengan nada yang menenangkan, mendukung, dan sesuai dengan etika psikologi.
Fokus pada perasaan, pikiran, dan solusi praktis untuk kesejahteraan mental pasien.
Gunakan konteks percakapan sebelumnya pada sesi ini agar jawaban tetap nyambung dan personal.
`.trim();

// Bangun prompt lengkap dengan menyertakan riwayat percakapan sesi ini
function buildPrompt(prompt, history) {
  const lines = [SYSTEM_INSTRUCTION, ''];
  if (Array.isArray(history)) {
    for (const m of history) {
      if (!m || typeof m.content !== 'string' || !m.content.trim()) continue;
      const speaker = m.role === 'assistant' ? 'Psikolog' : 'Pasien';
      lines.push(`${speaker}: ${m.content.trim()}`);
    }
  }
  lines.push(`Pasien: ${prompt}`, 'Psikolog:');
  return lines.join('\n');
}

// Handler chat dengan streaming (NDJSON) + riwayat percakapan per sesi
async function chatHandler(req, res) {
  const { prompt, history } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt tidak valid' });
  }

  const lowerPrompt = prompt.toLowerCase();
  if (CODING_KEYWORDS.some((kw) => lowerPrompt.includes(kw))) {
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    });
    const errorMsg = {
      delta:
        'Maaf, saya adalah psikolog/psikiater digital. Saya tidak dapat membantu pertanyaan tentang pemrograman atau kode. Silakan ceritakan masalah emosional atau psikologis Anda.',
    };
    res.write(JSON.stringify(errorMsg) + '\n');
    res.write(JSON.stringify({ done: true }) + '\n');
    return res.end();
  }

  const fullPrompt = buildPrompt(prompt, history);

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
  });

  res.write(JSON.stringify({ start: true }) + '\n');

  try {
    await scrapeUnlimitedAI(fullPrompt, {
      onStream: (delta) => {
        res.write(JSON.stringify({ delta }) + '\n');
        if (res.flush) res.flush();
      },
    });
    res.write(JSON.stringify({ done: true }) + '\n');
  } catch (error) {
    res.write(JSON.stringify({ error: error.message || 'Terjadi kesalahan' }) + '\n');
  } finally {
    res.end();
  }
}

app.post('/chat', chatHandler);
app.post('/api/chat', chatHandler);

// Sajikan aplikasi pada root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server AI Psikolog berjalan di http://localhost:${PORT}`);
});
