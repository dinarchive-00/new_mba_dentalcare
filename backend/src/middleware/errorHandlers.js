function notFoundHandler(req, res, next) {
  const error = new Error(`Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
  res.status(status).json({
    error: status === 500 ? 'Terjadi kesalahan pada server.' : error.message,
  });
}

module.exports = { notFoundHandler, errorHandler };
