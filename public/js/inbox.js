(() => {
  const seed = document.getElementById('inbox-seed');
  const list = document.getElementById('messages-list');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('inbox-count-title');
  let messages = [];
  let currentInboxId = null;

  const envelopeIcon = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6"/></svg>';
  const modeTitles = {
    anonymous: 'Send me anonymous messages',
    confessions: 'Send me anonymous confessions',
    about: 'One thing I should know anonymously?',
    ask: 'Ask me anything anonymously',
    opinion: 'Send me your anonymous honest opinion',
    crush: 'Send me love messages',
    compliment: 'Send me a compliment without revealing yourself',
    roast: 'Roast me anonymously'
  };

  function normalize(message) {
    return {
      ...message,
      id: String(message.id || message._id || ''),
      body: String(message.body || ''),
      created_at: message.created_at || message.createdAt || '',
      mode: String(message.mode || 'anonymous'),
      read: Boolean(message.read),
      flagged: Boolean(message.flagged)
    };
  }

  function rowHtml(message) {
    const title = message.read ? escapeHtml(message.body.slice(0, 58) + (message.body.length > 58 ? '…' : '')) : 'New Message!';
    return `<button type="button" class="inbox-row mode-${escapeHtml(message.mode)}" data-id="${escapeHtml(message.id)}">
      <span class="row-icon${message.read ? '' : ' unread'}">${envelopeIcon}</span>
      <span class="row-text"><strong class="row-title${message.read ? '' : ' unread-title'}">${title}</strong><span class="row-time">${formatRelativeTime(message.created_at)}</span></span>
      <span class="row-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function render() {
    list.innerHTML = messages.map(rowHtml).join('');
    empty.classList.toggle('hidden', messages.length > 0);
    count.textContent = `(${messages.length})`;
    list.querySelectorAll('.inbox-row').forEach((row) => row.addEventListener('click', () => openInboxDetail(row.dataset.id)));
  }

  function openInboxDetail(id) {
    const message = messages.find((item) => item.id === id);
    if (!message) return;
    currentInboxId = id;
    window.currentInboxId = id;
    document.getElementById('detail-body').textContent = message.body;
    document.querySelector('.detail-title').textContent = modeTitles[message.mode] || modeTitles.anonymous;
    document.querySelector('.detail-gradient-header').className = `detail-gradient-header mode-header-${message.mode}`;
    document.getElementById('detail-time-text').textContent = formatRelativeTime(message.created_at);
    document.getElementById('message-detail').classList.remove('hidden');
    if (!message.read) {
      message.read = true;
      render();
      fetch(`/dashboard/messages/${encodeURIComponent(id)}/read`, { method: 'POST' }).catch(() => {});
    }
  }

  function closeInboxDetail() {
    document.getElementById('message-detail').classList.add('hidden');
    document.getElementById('inbox-detail-menu').classList.add('hidden');
    currentInboxId = null;
    window.currentInboxId = null;
  }

  function toggleInboxDetailMenu(event) {
    event.stopPropagation();
    document.getElementById('inbox-detail-menu').classList.toggle('hidden');
  }

  async function deleteInboxMessage(id) {
    if (!id || !confirm('Delete this message?')) return;
    const response = await fetch(`/dashboard/messages/${encodeURIComponent(id)}/delete`, { method: 'POST' });
    if (!response.ok) return showToast('Could not delete message.');
    messages = messages.filter((message) => message.id !== id);
    closeInboxDetail();
    render();
    showToast('Message deleted.');
  }

  async function reportInboxMessage(id) {
    if (!id) return;
    const response = await fetch(`/dashboard/messages/${encodeURIComponent(id)}/report`, { method: 'POST' });
    if (!response.ok) return showToast('Could not report message.');
    const message = messages.find((item) => item.id === id);
    if (message) message.flagged = true;
    showToast('Message reported.');
  }

  async function blockInboxSender(id) {
    if (!id || !confirm("Block this sender? They won't be able to message you again.")) return;
    const response = await fetch(`/dashboard/messages/${encodeURIComponent(id)}/block`, { method: 'POST' });
    if (!response.ok) return showToast('Could not block sender.');
    showToast('Sender blocked.');
  }

  function closeInboxDetailOutside(event) {
    if (event.target.id === 'message-detail') closeInboxDetail();
  }

  async function exportInboxMessage(id) {
    const message = messages.find((item) => item.id === id);
    if (!message) return;
    try {
      const blob = await renderMessageToImageBlob(message);
      const file = new File([blob], 'anon-message.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Anonymous Message', text: 'Send me anonymous messages!' });
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'anon-message.png';
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('Message card downloaded.');
    } catch (error) {
      showToast('Could not create the message card.');
    }
  }

  async function refresh() {
    try {
      const response = await fetch('/dashboard/api/messages');
      if (!response.ok) throw new Error('Inbox request failed');
      const data = await response.json();
      messages = Array.isArray(data.messages) ? data.messages.map(normalize).filter((item) => item.id) : [];
      render();
    } catch (error) {
      console.error('Inbox refresh failed:', error);
      showToast('Could not load your inbox.');
    }
  }

  try {
    messages = JSON.parse(seed.textContent).map(normalize).filter((item) => item.id);
    render();
  } catch (error) {
    console.error('Inbox seed failed:', error);
    refresh();
  }

  setInterval(refresh, 5000);
  window.openInboxDetail = openInboxDetail;
  window.closeInboxDetail = closeInboxDetail;
  window.closeInboxDetailOutside = closeInboxDetailOutside;
  window.exportInboxMessage = exportInboxMessage;
  window.toggleInboxDetailMenu = toggleInboxDetailMenu;
  window.deleteInboxMessage = deleteInboxMessage;
  window.reportInboxMessage = reportInboxMessage;
  window.blockInboxSender = blockInboxSender;
})();
