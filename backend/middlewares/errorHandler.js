const errorHandler = (err, req, res, next) => {
    console.error('SERVER ERROR:', err);

    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Config file is too large (max 10MB)' });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'Validation error', details: err.message });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid ID format' });
    }

    if (err.name === 'MongoServerError' && err.code === 11000) {
        return res.status(409).json({ error: 'Duplicate field value entered' });
    }

    const status = err.status || 500;
    const message = err.message || 'An internal server error occurred';

    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = {
    errorHandler,
};
