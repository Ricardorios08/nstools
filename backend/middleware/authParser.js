const jwt = require('jsonwebtoken');
const { requestContext } = require('./context');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const authParser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
            next();
        });
    } else {
        next();
    }
};

module.exports = authParser;
