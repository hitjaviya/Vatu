const express = require('express');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const S3Service = require('../services/S3Service');
const SharedFile = require('../models/SharedFile');

const router = express.Router();

// Use memory storage — file goes to buffer, then to S3
// (no local disk writes needed)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types for chat sharing
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|mp4|mkv|avi|mp3|wav|ogg|aac|flac/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (extname) {
            return cb(null, true);
        }
        cb(new Error('File type not allowed. Supported: images, documents, audio, video, archives.'));
    }
});

const handleUpload = (req, res, next) => {
    upload.single('file')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size allowed is ' + (parseInt(process.env.MAX_FILE_SIZE) / (1024 * 1024)) + 'MB' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

/**
 * POST /api/files/upload
 * Upload a file to AWS S3 and create a SharedFile record
 * Returns file metadata + presigned download URL
 */
router.post('/upload', authenticate, handleUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload to S3
        const { s3Key } = await S3Service.upload(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // Determine simplified file type
        const fileType = SharedFile.getFileType(req.file.mimetype);

        // Create SharedFile record in MongoDB
        const sharedFile = await SharedFile.create({
            uploader: req.user._id,
            s3Key,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            fileType
        });

        // Generate presigned download URL
        const downloadUrl = await S3Service.getDownloadUrl(s3Key);

        res.status(201).json({
            fileId: sharedFile._id,
            fileName: sharedFile.fileName,
            fileSize: sharedFile.fileSize,
            fileType: sharedFile.fileType,
            mimeType: sharedFile.mimeType,
            downloadUrl,
            uploadedBy: req.user._id,
            createdAt: sharedFile.createdAt
        });
    } catch (error) {
        console.error('Error uploading file to S3:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

/**
 * GET /api/files/:fileId
 * Get file metadata (who uploaded, name, size, type, etc.)
 */
router.get('/:fileId', authenticate, async (req, res) => {
    try {
        const file = await SharedFile.findById(req.params.fileId)
            .populate('uploader', 'username avatar');

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Generate a fresh presigned URL
        const downloadUrl = await S3Service.getDownloadUrl(file.s3Key);

        res.json({
            fileId: file._id,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            mimeType: file.mimeType,
            downloadUrl,
            uploadedBy: file.uploader,
            shareCount: file.shareCount,
            downloadCount: file.downloadCount,
            createdAt: file.createdAt
        });
    } catch (error) {
        console.error('Error getting file metadata:', error);
        res.status(500).json({ error: 'Failed to get file info' });
    }
});

/**
 * GET /api/files/:fileId/download
 * Get a fresh presigned download URL for a file
 * Increments download counter
 */
router.get('/:fileId/download', authenticate, async (req, res) => {
    try {
        const file = await SharedFile.findById(req.params.fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment download counter
        file.downloadCount += 1;
        await file.save();

        // Generate presigned URL (1 hour expiry) with forceDownload=true
        const downloadUrl = await S3Service.getDownloadUrl(file.s3Key, 3600, true, file.fileName);

        res.json({
            downloadUrl,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            mimeType: file.mimeType
        });
    } catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
});

/**
 * POST /api/files/:fileId/forward
 * Mark a file as forwarded (increments share count)
 * Returns fresh download URL — no re-upload to S3 needed
 */
router.post('/:fileId/forward', authenticate, async (req, res) => {
    try {
        const file = await SharedFile.findById(req.params.fileId)
            .populate('uploader', 'username avatar');

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment share count
        file.shareCount += 1;
        await file.save();

        // Generate fresh download URL
        const downloadUrl = await S3Service.getDownloadUrl(file.s3Key);

        res.json({
            fileId: file._id,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            mimeType: file.mimeType,
            downloadUrl,
            uploadedBy: file.uploader,
            shareCount: file.shareCount,
            createdAt: file.createdAt
        });
    } catch (error) {
        console.error('Error forwarding file:', error);
        res.status(500).json({ error: 'Failed to forward file' });
    }
});

/**
 * DELETE /api/files/:fileId
 * Delete a file from S3 and remove the SharedFile record
 * Only the original uploader can delete
 */
router.delete('/:fileId', authenticate, async (req, res) => {
    try {
        const file = await SharedFile.findById(req.params.fileId);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Only the uploader can delete
        if (file.uploader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the original uploader can delete this file' });
        }

        // Delete from S3
        await S3Service.delete(file.s3Key);

        // Remove from MongoDB
        await SharedFile.findByIdAndDelete(file._id);

        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

module.exports = router;
