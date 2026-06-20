const messagesEl = document.getElementById('messages');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

// Kirim pesan
async function sendMessage() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  // Tampilkan pesan user
  appendMessage('user', prompt);
  promptInput.value = '';
  promptInput.style.height = 'auto';

  // Tampilkan indikator mengetik
  typingIndicator.style.display = 'block';

  // Siapkan elemen pesan asisten (akan diisi stream)
  const assistantMsgDiv = document.createElement('div');
  assistantMsgDiv.className = 'message assistant';
  assistantMsgDiv.textContent = '';
  messagesEl.appendChild(assistantMsgDiv);

  let fullText = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // simpan sisa yang tidak lengkap

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.delta) {
            fullText += data.delta;
            assistantMsgDiv.textContent = fullText;
            // Scroll ke bawah
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          if (data.error) {
            appendMessage('assistant', '⚠️ ' + data.error);
          }
          if (data.done) {
            // selesai
          }
        } catch (e) {
          // ignore parse error
        }
      }
    }

    // Jika tidak ada delta sama sekali (misal error di awal)
    if (!fullText) {
      assistantMsgDiv.textContent = 'Maaf, terjadi kesalahan. Coba lagi.';
    }

  } catch (error) {
    assistantMsgDiv.textContent = '⚠️ Gagal terhubung ke server. Periksa koneksi Anda.';
    console.error(error);
  } finally {
    typingIndicator.style.display = 'none';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Event listener
sendBtn.addEventListener('click', sendMessage);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto';
  promptInput.style.height = promptInput.scrollHeight + 'px';
});

// Pesan sambutan
window.addEventListener('load', () => {
  appendMessage('assistant', 'Halo, saya AI Psikolog. Silakan ceritakan apa yang Anda rasakan atau alami. Saya siap mendengarkan tanpa menghakimi.');
});
