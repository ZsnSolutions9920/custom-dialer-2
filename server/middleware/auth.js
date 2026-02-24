const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.agent = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authenticate;
