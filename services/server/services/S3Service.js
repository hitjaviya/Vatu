const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

/**
 * S3 Service - Handles all AWS S3 operations for file sharing
 * Files are uploaded once and shared via presigned URLs
 */
class S3Service {
    constructor() {
        this.client = null;
        this.bucket = process.env.AWS_S3_BUCKET;
        this._initialized = false;
    }

    /**
     * Lazy initialization - only creates S3 client when first needed
     * This prevents crashes if AWS env vars are missing at startup
     */
    _ensureInitialized() {
        if (this._initialized) return;

        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
        }

        if (!this.bucket) {
            throw new Error('AWS_S3_BUCKET not configured in .env');
        }

        this.client = new S3Client({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });

        this._initialized = true;
        console.log(`[S3Service] Initialized with bucket: ${this.bucket}, region: ${process.env.AWS_REGION || 'ap-south-1'}`);
    }

    /**
     * Generate a unique S3 key for a file
     * Format: chat-files/YYYY/MM/DD/<timestamp>-<hash>.<ext>
     * @param {String} originalFileName - Original file name
     * @returns {String} S3 object key
     */
    generateKey(originalFileName) {
        const ext = path.extname(originalFileName);
        const hash = crypto.randomBytes(16).toString('hex');
        const now = new Date();
        const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
        return `chat-files/${datePath}/${Date.now()}-${hash}${ext}`;
    }

    /**
     * Upload a file buffer to S3
     * @param {Buffer} buffer - File buffer
     * @param {String} originalFileName - Original file name
     * @param {String} mimeType - File MIME type
     * @returns {Promise<Object>} { s3Key } - The S3 object key
     */
    async upload(buffer, originalFileName, mimeType) {
        this._ensureInitialized();

        const s3Key = this.generateKey(originalFileName);

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: mimeType,
            // Set content disposition so downloads use original filename
            ContentDisposition: `inline; filename="${originalFileName}"`,
        });

        await this.client.send(command);

        console.log(`[S3Service] Uploaded file: ${originalFileName} → s3://${this.bucket}/${s3Key}`);

        return { s3Key };
    }

    /**
     * Get a CDN download URL for a file, or fallback to presigned S3 URL
     * @param {String} s3Key - S3 object key
     * @param {Number} expiresIn - URL expiry time (only used if CDN is not configured)
     * @param {Boolean} forceDownload - Whether to force file download
     * @param {String} fileName - The filename to use when downloading
     * @returns {Promise<String>} Download URL
     */
    async getDownloadUrl(s3Key, expiresIn = 3600, forceDownload = false, fileName = 'download') {
        // If CloudFront CDN is configured, return the fast public CDN URL
        if (process.env.CLOUDFRONT_DOMAIN) {
            // Clean up the domain string just in case 'https://' or trailing slashes were added
            const domain = process.env.CLOUDFRONT_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
            let url = `https://${domain}/${s3Key}`;
            if (forceDownload) {
                // With CloudFront, a custom Lambda@Edge or query parameter logic might be needed
                // depending on distribution config, but we can append it as a hint.
                url += `?download=${encodeURIComponent(fileName)}`;
            }
            return url;
        }

        // Fallback to S3 Presigned URL if CDN is not configured
        this._ensureInitialized();

        const params = {
            Bucket: this.bucket,
            Key: s3Key,
        };

        if (forceDownload && fileName) {
            params.ResponseContentDisposition = `attachment; filename="${fileName}"`;
        }

        const command = new GetObjectCommand(params);

        const url = await getSignedUrl(this.client, command, { expiresIn });
        return url;
    }

    /**
     * Get a preview URL optimized for images/media
     * @param {String} s3Key - S3 object key
     * @returns {Promise<String>} Preview URL
     */
    async getPreviewUrl(s3Key) {
        // Uses the same logic: CDN if available, else 24hr presigned URL
        return this.getDownloadUrl(s3Key, 86400);
    }

    /**
     * Delete a file from S3
     * @param {String} s3Key - S3 object key
     * @returns {Promise<void>}
     */
    async delete(s3Key) {
        this._ensureInitialized();

        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
        });

        await this.client.send(command);
        console.log(`[S3Service] Deleted file: s3://${this.bucket}/${s3Key}`);
    }
}

module.exports = new S3Service();
