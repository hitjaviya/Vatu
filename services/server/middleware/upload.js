const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure upload directories exist
const uploadDirs = {
    avatars: path.join(__dirname, '../uploads/avatars'),
    files: path.join(__dirname, '../uploads/files')
};

Object.values(uploadDirs).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirs.avatars);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.user._id}-${uniqueSuffix}${ext}`);
    }
});

// Configure storage for general file uploads
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirs.files);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const sanitizedName = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    }
});

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

// Multer middleware for avatar uploads
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: {
        fileSize: config.maxAvatarSize // 2MB by default
    },
    fileFilter: imageFilter
}).single('avatar');

// Multer middleware for general file uploads
const uploadFile = multer({
    storage: fileStorage,
    limits: {
        fileSize: config.maxFileSize // 10MB by default
    }
}).single('file');

// Error handling wrapper
const handleUploadError = (uploadMiddleware) => {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        error: 'File too large',
                        maxSize: err.field === 'avatar' ? config.maxAvatarSize : config.maxFileSize
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
    uploadAvatar: handleUploadError(uploadAvatar),
    uploadFile: handleUploadError(uploadFile)
};
