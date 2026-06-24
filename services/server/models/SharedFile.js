const mongoose = require('mongoose');

/**
 * SharedFile Model
 * Stores metadata about files uploaded to AWS S3.
 * A file is uploaded once to S3 and can be shared/forwarded to multiple users
 * without re-uploading — only the SharedFile reference is passed along.
 */
const sharedFileSchema = new mongoose.Schema({
    // Who originally uploaded the file
    uploader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // The S3 object key (used to generate presigned URLs)
    s3Key: {
        type: String,
        required: true,
        unique: true
    },

    // Original file name (for display to users)
    fileName: {
        type: String,
        required: true
    },

    // File size in bytes
    fileSize: {
        type: Number,
        required: true
    },

    // MIME type (e.g., image/png, application/pdf)
    mimeType: {
        type: String,
        required: true
    },

    // Simplified file type for UI rendering
    fileType: {
        type: String,
        enum: ['image', 'video', 'audio', 'file'],
        default: 'file'
    },

    // Track how many times the file has been downloaded
    downloadCount: {
        type: Number,
        default: 0
    },

    // Track how many times the file has been shared/forwarded
    shareCount: {
        type: Number,
        default: 1 // starts at 1 (initial share)
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
sharedFileSchema.index({ uploader: 1, createdAt: -1 });
sharedFileSchema.index({ s3Key: 1 });

/**
 * Determine simplified file type from MIME type
 * @param {String} mimeType - MIME type string
 * @returns {String} Simplified type: 'image', 'video', 'audio', or 'file'
 */
sharedFileSchema.statics.getFileType = function (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
};

const SharedFile = mongoose.model('SharedFile', sharedFileSchema);

module.exports = SharedFile;
