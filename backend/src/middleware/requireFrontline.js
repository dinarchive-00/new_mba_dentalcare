const frontlineAuth = require('../services/frontlineAuthService');

function requireFrontline(req, res, next) {
  const session = frontlineAuth.getSession(req);
  if (!session) return res.status(401).json({ error: 'Login Frontline diperlukan untuk mengakses data ini.' });
  req.frontline = { role: session.role };
  return next();
}

module.exports = requireFrontline;
