const multer = require('multer');
const path = require('path');
const config = require('../config/config');

// File filter for images only (avatars)
const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

// Multer middleware for avatar uploads using memory storage
const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.maxAvatarSize || 2097152 // 2MB default
    },
    fileFilter: imageFilter
}).single('avatar');

// Error handling wrapper
const handleUploadError = (uploadMiddleware) => {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        error: 'File too large',
                        maxSize: config.maxAvatarSize || 2097152
                    });
                }
                return res.status(400).json({ error: err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    };
};

module.exports = {
    uploadAvatar: handleUploadError(uploadAvatar)
};
