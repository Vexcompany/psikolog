/* ====================================================================
 * AI Psikolog — manajemen sesi, riwayat, dan streaming chat
 * Setiap chat = satu sesi, disimpan di localStorage (per perangkat).
 * ==================================================================== */

const STORAGE_KEY = 'aipsikolog.sessions.v1';
const ACTIVE_KEY = 'aipsikolog.active.v1';
const THEME_KEY = 'aipsikolog.theme.v1';

/* ---------- Elemen ---------- */
const $ = (id) => document.getElementById(id);
const messagesEl = $('messages');
const emptyState = $('empty-state');
const promptInput = $('prompt-input');
const sendBtn = $('send-btn');
const sessionListEl = $('session-list');
const currentTitleEl = $('current-title');
const searchInput = $('search-input');
const sidebar = $('sidebar');
const overlay = $('sidebar-overlay');

/* ---------- State ---------- */
let sessions = loadSessions();
let activeId = localStorage.getItem(ACTIVE_KEY) || null;
let isStreaming = false;

/* ==================== Penyimpanan ==================== */
function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}
function getActive() {
  return sessions.find((s) => s.id === activeId) || null;
}
function setActive(id) {
  activeId = id;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

function newId() {
  return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function createSession() {
  const s = { id: newId(), title: 'Sesi Baru', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  sessions.unshift(s);
  setActive(s.id);
  saveSessions();
  return s;
}

function ensureActive() {
  let s = getActive();
  if (!s) {
    s = sessions[0] || createSession();
    setActive(s.id);
  }
  return s;
}

function deleteSession(id) {
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions.splice(idx, 1);
  if (activeId === id) setActive(sessions[0] ? sessions[0].id : null);
  saveSessions();
  if (!getActive()) createSession();
  renderAll();
}

function clearAllSessions() {
  if (!sessions.length) return;
  if (!confirm('Hapus semua riwayat sesi? Tindakan ini tidak bisa dibatalkan.')) return;
  sessions = [];
  setActive(null);
  saveSessions();
  createSession();
  renderAll();
}

/* ==================== Render daftar sesi ==================== */
function dayBucket(ts) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYest = startToday - 86400000;
  const start7 = startToday - 6 * 86400000;
  if (ts >= startToday) return 'Hari Ini';
  if (ts >= startYest) return 'Kemarin';
  if (ts >= start7) return '7 Hari Terakhir';
  return 'Lebih Lama';
}

function renderSessions() {
  const q = (searchInput.value || '').trim().toLowerCase();
  sessionListEl.innerHTML = '';

  let list = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  if (q) {
    list = list.filter((s) => {
      const inTitle = (s.title || '').toLowerCase().includes(q);
      const inMsg = s.messages.some((m) => (m.content || '').toLowerCase().includes(q));
      return inTitle || inMsg;
    });
  }

  if (!list.length) {
    const e = document.createElement('div');
    e.className = 'empty-history';
    e.textContent = q ? 'Tidak ada hasil.' : 'Belum ada riwayat sesi.';
    sessionListEl.appendChild(e);
    return;
  }

  let lastBucket = null;
  for (const s of list) {
    const bucket = dayBucket(s.updatedAt);
    if (bucket !== lastBucket) {
      const label = document.createElement('div');
      label.className = 'session-group-label';
      label.textContent = bucket;
      sessionListEl.appendChild(label);
      lastBucket = bucket;
    }

    const item = document.createElement('div');
    item.className = 'session-item' + (s.id === activeId ? ' active' : '');
    item.setAttribute('role', 'button');
    item.tabIndex = 0;

    const icon = document.createElement('span');
    icon.className = 's-icon';
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 01-8.9 8.4 8.5 8.5 0 01-3.6-.8L3 21l1.9-5.5a8.38 8.38 0 01-.8-3.6A8.5 8.5 0 0112.5 3a8.38 8.38 0 018.5 8.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const title = document.createElement('span');
    title.className = 's-title';
    title.textContent = s.title || 'Sesi Baru';

    const del = document.createElement('button');
    del.className = 's-del';
    del.setAttribute('aria-label', 'Hapus sesi');
    del.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(s.id);
    });

    item.addEventListener('click', () => switchSession(s.id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchSession(s.id);
      }
    });

    item.append(icon, title, del);
    sessionListEl.appendChild(item);
  }
}

function switchSession(id) {
  if (isStreaming) return;
  setActive(id);
  renderAll();
  closeSidebar();
  promptInput.focus();
}

/* ==================== Render pesan ==================== */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Markdown ringan & aman (escape dulu, lalu format terbatas) */
function renderMarkdown(text) {
  let t = escapeHtml(text);
  // code block ```
  t = t.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.replace(/^\n/, '')}</code></pre>`);
  // inline code `
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // bold **text**
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // italic *text*
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // bullet list
  t = t.replace(/(?:^|\n)((?:[ \t]*[-*] .+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map((l) => '<li>' + l.replace(/^[ \t]*[-*] /, '') + '</li>').join('');
    return '\n<ul>' + items + '</ul>';
  });
  // paragraphs / line breaks
  const blocks = t.split(/\n{2,}/).map((b) => {
    if (/^\s*<(ul|ol|pre)/.test(b)) return b;
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  });
  return blocks.join('');
}

function makeRow(role) {
  const row = document.createElement('div');
  row.className = 'row ' + role;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🙂' : '🧠';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  row.append(avatar, bubble);
  return { row, bubble };
}

function renderMessages() {
  const s = getActive();
  messagesEl.innerHTML = '';
  const msgs = s ? s.messages : [];
  if (!msgs.length) {
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';
    for (const m of msgs) {
      const { row, bubble } = makeRow(m.role);
      bubble.innerHTML = m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content).replace(/\n/g, '<br>');
      messagesEl.appendChild(row);
    }
  }
  currentTitleEl.textContent = s ? s.title || 'Sesi Baru' : 'Sesi Baru';
  scrollToBottom(false);
}

function scrollToBottom(smooth = true) {
  const c = $('chat-container');
  c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function renderAll() {
  renderSessions();
  renderMessages();
}

/* ==================== Kirim pesan ==================== */
function titleFrom(text) {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 40 ? t.slice(0, 40) + '…' : t;
}

async function sendMessage(text) {
  const prompt = (text != null ? text : promptInput.value).trim();
  if (!prompt || isStreaming) return;

  const s = ensureActive();
  const firstMessage = s.messages.length === 0;

  s.messages.push({ role: 'user', content: prompt });
  if (firstMessage) s.title = titleFrom(prompt);
  s.updatedAt = Date.now();
  saveSessions();

  promptInput.value = '';
  autoResize();
  emptyState.style.display = 'none';

  // tampilkan pesan user
  const userRow = makeRow('user');
  userRow.bubble.innerHTML = escapeHtml(prompt).replace(/\n/g, '<br>');
  messagesEl.appendChild(userRow.row);

  // siapkan bubble asisten + indikator mengetik
  const botRow = makeRow('assistant');
  botRow.bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  messagesEl.appendChild(botRow.row);
  scrollToBottom();

  setStreaming(true);
  currentTitleEl.textContent = s.title;
  renderSessions();

  // kirim riwayat percakapan (tanpa pesan terakhir) agar AI punya konteks sesi
  const history = s.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

  let fullText = '';
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history }),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.delta) {
            fullText += data.delta;
            botRow.bubble.innerHTML = renderMarkdown(fullText);
            scrollToBottom();
          }
          if (data.error) {
            fullText = fullText || '⚠️ ' + data.error;
            botRow.bubble.innerHTML = renderMarkdown(fullText);
          }
        } catch {}
      }
    }
    if (!fullText) fullText = 'Maaf, terjadi kesalahan. Coba lagi.';
  } catch (err) {
    fullText = '⚠️ Gagal terhubung ke server. Periksa koneksi Anda lalu coba lagi.';
    console.error(err);
  } finally {
    botRow.bubble.innerHTML = renderMarkdown(fullText);
    s.messages.push({ role: 'assistant', content: fullText });
    s.updatedAt = Date.now();
    saveSessions();
    setStreaming(false);
    renderSessions();
    scrollToBottom();
  }
}

function setStreaming(v) {
  isStreaming = v;
  sendBtn.disabled = v;
  promptInput.disabled = v;
}

/* ==================== Sidebar (mobile) ==================== */
function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('show');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

/* ==================== Tema ==================== */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f1117' : '#f4f6fb');
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(saved || (prefersLight ? 'light' : 'dark'));
}

/* ==================== Textarea auto-resize ==================== */
function autoResize() {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
}

/* ==================== Event listeners ==================== */
sendBtn.addEventListener('click', () => sendMessage());
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
promptInput.addEventListener('input', autoResize);

$('new-chat-btn').addEventListener('click', () => { newChat(); });
$('new-chat-top').addEventListener('click', () => { newChat(); });
function newChat() {
  if (isStreaming) return;
  // hindari membuat banyak sesi kosong: jika sesi aktif sudah kosong, cukup pakai itu
  const a = getActive();
  if (a && a.messages.length === 0) {
    closeSidebar();
    promptInput.focus();
    renderAll();
    return;
  }
  createSession();
  renderAll();
  closeSidebar();
  promptInput.focus();
}

$('clear-all-btn').addEventListener('click', clearAllSessions);
$('theme-toggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

$('sidebar-open').addEventListener('click', openSidebar);
$('sidebar-close').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

searchInput.addEventListener('input', renderSessions);

document.querySelectorAll('.suggestion').forEach((btn) => {
  btn.addEventListener('click', () => sendMessage(btn.textContent));
});

/* ==================== Inisialisasi ==================== */
initTheme();
ensureActive();
renderAll();
autoResize();
promptInput.focus();
