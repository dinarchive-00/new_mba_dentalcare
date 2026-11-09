const authService = require('../services/frontlineAuthService');

function setSessionCookie(res, token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `frontline_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${Math.floor(maxAge / 1000)}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `frontline_session=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${secure}`);
}

function createAuthController() {
  return {
    login(req, res, next) {
      try {
        const { username, password } = req.body || {};
        if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
          const error = new Error('Nama pengguna dan kata sandi wajib diisi.');
          error.status = 400;
          throw error;
        }
        const session = authService.login(username, password);
        setSessionCookie(res, session.token, authService.SESSION_LIFETIME_MS);
        return res.status(200).json({ data: { role: 'frontline' } });
      } catch (error) { return next(error); }
    },
    session(req, res) {
      const session = authService.getSession(req);
      if (!session) return res.status(401).json({ error: 'Sesi Frontline tidak ditemukan.' });
      return res.status(200).json({ data: { role: session.role } });
    },
    logout(req, res) {
      authService.logout(req);
      clearSessionCookie(res);
      return res.status(200).json({ data: { loggedOut: true } });
    },
  };
}

module.exports = createAuthController;
