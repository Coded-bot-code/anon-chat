const crypto = require('crypto');

// One-way keyed hash of a sender's IP address. This is used ONLY to let a
// recipient block a specific anonymous sender from messaging them again —
// it is never displayed to anyone (recipient or admin) and, because it's
// keyed with a server-side secret (HMAC, not a bare hash), it can't be
// reversed back into the original IP even if the hash leaked. This keeps
// senders genuinely anonymous while still enabling a working block feature.
function hashSenderIp(ip) {
  const secret = process.env.IP_HASH_SECRET || process.env.SESSION_SECRET || 'dev-only-fallback-secret-change-me';
  return crypto.createHmac('sha256', secret).update(String(ip || 'unknown')).digest('hex');
}

module.exports = { hashSenderIp };
