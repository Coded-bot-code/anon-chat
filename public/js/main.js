// --- DevAfeez branding badge ---
function closeDevafeezBadge() {
  const badge = document.getElementById('devafeez-badge');
  if (badge) badge.style.display = 'none';
}

// --- Lightweight toast notifications ---
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// --- Password visibility toggle ---
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  const eyeIcon = `
    <svg class="eye-icon" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const eyeOffIcon = `
    <svg class="eye-icon" viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;

  btn.innerHTML = isPassword ? eyeOffIcon : eyeIcon;
}

// --- HTML escaping (used before inserting user-supplied text via innerHTML) ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Relative time formatting ---
// Timestamps can arrive in two shapes depending on which backend wrote them:
// a naive SQLite-style "YYYY-MM-DD HH:MM:SS" (no timezone, always UTC), or a
// proper ISO string from MongoDB/Mongoose like "2026-01-01T12:00:00.000Z"
// (already has a timezone). Treating the second shape like the first would
// double up the "Z" and produce an Invalid Date, so we detect which one we
// have before touching it.
function toUTCDate(timestamp) {
  if (timestamp instanceof Date) return timestamp;
  const str = String(timestamp);
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(str);
  if (hasTimezone) return new Date(str);
  return new Date(str.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(timestamp) {
  const date = toUTCDate(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (Number.isNaN(seconds)) return '';
  if (seconds < 5) return 'just now';

  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1]
  ];

  for (const [name, secondsInUnit] of units) {
    const value = Math.floor(seconds / secondsInUnit);
    if (value >= 1) return `${value} ${name}${value > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

// --- Canvas helpers used by the share-card generators below ---
function wrapTextMeasure(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws a small envelope glyph (replaces the old emoji icon on the canvas,
// since emoji rendering varies a lot across OS/browser combos).
function drawEnvelopeIcon(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  const w = r * 1.1;
  const h = r * 0.8;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cx, cy + h * 0.15);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

function drawLockIcon(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.6;
  const bodyH = size * 0.62;
  const bodyY = y + size - bodyH;
  ctx.strokeRect(x, bodyY, size, bodyH);
  ctx.beginPath();
  ctx.arc(x + size / 2, bodyY, size * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

function drawClockIcon(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - r * 0.55);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.4, cy);
  ctx.stroke();
  ctx.restore();
}

const SHARE_FONT = 'Roboto, -apple-system, Segoe UI, sans-serif';

const MESSAGE_MODE_TITLES = {
  anonymous: 'Send me anonymous messages',
  confessions: 'Send me anonymous confessions',
  about: 'One thing I should know anonymously?',
  ask: 'Ask me anything anonymously',
  opinion: 'Send me your anonymous honest opinion',
  crush: 'Send me love messages',
  compliment: 'Send me a compliment without revealing yourself',
  roast: 'Roast me anonymously'
};

// Renders a received message as a shareable PNG card. The header always
// reads "Send me anonymous messages!" (the app's fixed tagline) rather than
// that particular message's randomized prompt, so every shared card looks
// consistent and on-brand regardless of which prompt template was shown to
// the sender.
function renderMessageToImageBlob(message) {
  return new Promise((resolve) => {
    const width = 760;
    const padding = 42;
    const headerPaddingY = 34;
    const bodyPaddingY = 38;
    const lineHeight = 30;
    const tagline = MESSAGE_MODE_TITLES[message.mode] || MESSAGE_MODE_TITLES.anonymous;

    const measure = document.createElement('canvas').getContext('2d');

    measure.font = `600 27px ${SHARE_FONT}`;
    const titleLines = wrapTextMeasure(measure, tagline, width - padding * 2 - 76);

    measure.font = `400 21px ${SHARE_FONT}`;
    const bodyText = message.body.length > 500 ? message.body.slice(0, 500) + '…' : message.body;
    const bodyLines = wrapTextMeasure(measure, bodyText, width - padding * 2);

    const headerHeight = headerPaddingY * 2 + Math.max(92, titleLines.length * 34 + 50);
    const bodyHeight = bodyPaddingY * 2 + bodyLines.length * lineHeight;
    const footerHeight = 52;
    const totalHeight = headerHeight + bodyHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    roundRectPath(ctx, 0, 0, width, totalHeight, 26);
    ctx.clip();

    const inboxGradients = {
      anonymous: ['#5564e8', '#202c6b'],
      confessions: ['#9b4a9d', '#48225d'],
      about: ['#3b8bd0', '#3d3b91'],
      ask: ['#24a9bd', '#2459a3'],
      opinion: ['#5662d6', '#1d8492'],
      crush: ['#e05a9d', '#6b3bb0'],
      compliment: ['#eb719c', '#9b3d76'],
      roast: ['#e08042', '#713f91']
    };
    const inboxColors = inboxGradients[message.mode] || inboxGradients.anonymous;
    ctx.fillStyle = inboxColors[0];
    ctx.fillRect(0, 0, width, headerHeight);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(padding + 26, headerPaddingY + 26, 26, 0, Math.PI * 2);
    ctx.fill();
    drawEnvelopeIcon(ctx, padding + 26, headerPaddingY + 26, 15);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = `600 27px ${SHARE_FONT}`;
    let ty = headerPaddingY + 12;
    titleLines.forEach((line) => {
      ctx.fillText(line, padding + 66, ty);
      ty += 34;
    });

    ty += 10;
    ctx.font = `500 16px ${SHARE_FONT}`;
    const pillPadX = 10;
    const pillIconSpace = 16;
    const pillText = 'Private';
    const pillWidth = ctx.measureText(pillText).width + pillPadX * 2 + pillIconSpace;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRectPath(ctx, padding + 66, ty - 16, pillWidth, 26, 13);
    ctx.fill();
    drawLockIcon(ctx, padding + 66 + pillPadX, ty - 9, 9);
    ctx.fillStyle = '#fff';
    ctx.fillText(pillText, padding + 66 + pillPadX + pillIconSpace, ty + 2);

    const timeText = formatRelativeTime(message.created_at);
    const dotX = padding + 66 + pillWidth + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('•', dotX, ty + 2);
    drawClockIcon(ctx, dotX + 14, ty - 4, 7);
    ctx.fillText(timeText, dotX + 26, ty + 2);

    ctx.fillStyle = '#14141c';
    ctx.fillRect(0, headerHeight, width, bodyHeight);
    ctx.fillStyle = '#fff';
    ctx.font = `400 21px ${SHARE_FONT}`;
    let by = headerHeight + bodyPaddingY + 16;
    bodyLines.forEach((line) => {
      ctx.fillText(line, padding, by);
      by += lineHeight;
    });

    ctx.fillStyle = '#1e1e28';
    ctx.fillRect(0, headerHeight + bodyHeight, width, footerHeight);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `500 15px ${SHARE_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Powered by DevAfeez', width / 2, headerHeight + bodyHeight + footerHeight / 2 + 5);

    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Renders a promo card for the user's own link: avatar + display name +
// username + the "Send me anonymous messages!" tagline. This is what gets
// attached (image + caption) when sharing the link itself, as opposed to
// renderMessageToImageBlob() above, which shares a specific received message.
async function renderLinkShareImageBlob(profile) {
  const width = 680;
  const height = 390;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  roundRectPath(ctx, 0, 0, width, height, 26);
  ctx.clip();

  const modeGradients = {
    anonymous: ['#5564e8', '#202c6b', '#12152d'],
    confessions: ['#9b4a9d', '#48225d', '#17152d'],
    about: ['#3b8bd0', '#3d3b91', '#15182e'],
    ask: ['#24a9bd', '#2459a3', '#121b31'],
    opinion: ['#5662d6', '#1d8492', '#121a2c'],
    crush: ['#e05a9d', '#6b3bb0', '#21152e'],
    compliment: ['#eb719c', '#9b3d76', '#24172c'],
    roast: ['#e08042', '#713f91', '#21162d']
  };
  const colors = modeGradients[profile.mode && profile.mode.slug] || modeGradients.anonymous;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const avatarX = 86;
  const avatarY = 116;
  const avatarR = 52;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  let drewPhoto = false;
  if (profile.profilePhoto) {
    try {
      const img = await loadImageForCanvas(profile.profilePhoto);
      ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      drewPhoto = true;
    } catch (e) {
      drewPhoto = false;
    }
  }
  if (!drewPhoto) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = '#fff';
    ctx.font = `600 44px ${SHARE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (profile.displayName || profile.username || '?').charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX, avatarY + 3);
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `600 28px ${SHARE_FONT}`;
  ctx.fillText(profile.displayName || profile.username, avatarX + avatarR + 20, avatarY - 4);

  ctx.font = `400 18px ${SHARE_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('@' + profile.username, avatarX + avatarR + 20, avatarY + 18);

  ctx.font = `600 36px ${SHARE_FONT}`;
  ctx.fillStyle = '#fff';
  const modeName = MESSAGE_MODE_TITLES[profile.mode && profile.mode.slug] || MESSAGE_MODE_TITLES.anonymous;
  ctx.fillText(modeName, 56, 220);
  ctx.font = `400 20px ${SHARE_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  const modeDescription = profile.mode && profile.mode.description ? profile.mode.description : 'Send me anonymous messages!';
  wrapTextMeasure(ctx, modeDescription, width - 112).slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, 56, 256 + index * 27);
  });

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, height - 48, width, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 14px ${SHARE_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Powered by DevAfeez', width / 2, height - 22);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
