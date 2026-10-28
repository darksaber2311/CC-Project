export function errorHandler(err, req, res, next) {
  console.error('[SecureDocs Error]:', err.message);

  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 
    ? 'An internal security or processing error occurred. Please try again later.'
    : err.message;

  res.status(statusCode).json({
    error: message,
    correlationId: req.headers['x-correlation-id'] || undefined
  });
}
