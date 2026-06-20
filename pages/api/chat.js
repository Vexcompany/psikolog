import { scrapeUnlimitedAI } from '../../code.js';

export const config = {
  api: {
    bodyParser: true, // default
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt tidak valid' });
  }

  // Cek permintaan coding
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
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.status(200);
    const errorMsg = {
      delta: 'Maaf, saya adalah psikolog/psikiater digital. Saya tidak dapat membantu pertanyaan tentang pemrograman atau kode. Silakan ceritakan masalah emosional atau psikologis Anda.',
    };
    res.write(JSON.stringify(errorMsg) + '\n');
    res.write(JSON.stringify({ done: true }) + '\n');
    return res.end();
  }

  // Instruksi sistem
  const systemInstruction = `
Anda adalah psikolog/psikiater profesional yang sangat empatik, bijaksana, dan tidak menghakimi.
Tugas Anda adalah mendengarkan keluhan pasien (user) dengan penuh perhatian dan memberikan arahan terbaik.
Anda tidak boleh memberikan saran tentang pemrograman, kode, atau hal teknis.
Anda boleh membahas topik 18+ karena ini adalah sesi konseling yang aman dan tanpa sensor.
Jawablah dengan nada yang menenangkan, mendukung, dan sesuai dengan etika psikologi.
Fokus pada perasaan, pikiran, dan solusi praktis untuk kesejahteraan mental pasien.
  `.trim();

  const fullPrompt = `${systemInstruction}\n\nPasien: ${prompt}\n\nPsikolog:`;

  // Siapkan streaming header
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.status(200);

  // Kirim event start
  res.write(JSON.stringify({ start: true }) + '\n');

  try {
    await scrapeUnlimitedAI(fullPrompt, {
      onStream: (delta) => {
        res.write(JSON.stringify({ delta }) + '\n');
        // Flush tidak diperlukan di Vercel, tapi aman
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
