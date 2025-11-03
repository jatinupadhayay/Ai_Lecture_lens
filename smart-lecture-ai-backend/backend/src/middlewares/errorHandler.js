module.exports = (err, req, res, next) => {
  // Basic error handler
  console.error(err && err.stack ? err.stack : err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, message, details: err.details || null });
};
