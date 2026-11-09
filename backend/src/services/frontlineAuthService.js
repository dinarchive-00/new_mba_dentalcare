const { randomBytes, timingSafeEqual } = require('crypto');

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isConfigured() {
  return Boolean(process.env.FRONTLINE_USERNAME && process.env.FRONTLINE_PASSWORD);
}

function getCookieToken(req) {
  const cookies = String(req.headers.cookie || '').split(';');
  const sessionCookie = cookies.map((part) => part.trim()).find((part) => part.startsWith('frontline_session='));
  return sessionCookie ? decodeURIComponent(sessionCookie.slice('frontline_session='.length)) : '';
}

function getSession(req) {
  const token = getCookieToken(req);
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, role: 'frontline' };
}

function login(username, password) {
  if (!isConfigured()) {
    const error = new Error('Login Frontline belum dikonfigurasi. Atur FRONTLINE_USERNAME dan FRONTLINE_PASSWORD pada environment backend.');
    error.status = 503;
    throw error;
  }
  if (!safeEqual(username, process.env.FRONTLINE_USERNAME) || !safeEqual(password, process.env.FRONTLINE_PASSWORD)) {
    const error = new Error('Nama pengguna atau kata sandi salah.');
    error.status = 401;
    throw error;
  }

  const token = randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_LIFETIME_MS });
  return { token, maxAge: SESSION_LIFETIME_MS };
}

function logout(req) {
  const session = getSession(req);
  if (session) sessions.delete(session.token);
}

module.exports = { getSession, isConfigured, login, logout, SESSION_LIFETIME_MS };
