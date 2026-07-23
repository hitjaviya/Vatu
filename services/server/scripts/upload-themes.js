#!/usr/bin/env node
/**
 * upload-themes.js
 * Uploads chat background images from apps/desktop/public/assets/backgrounds/
 * to the S3 bucket under the "themes/" prefix, then outputs the CloudFront URLs.
 *
 * Usage: node scripts/upload-themes.js
 * Requires .env to be loaded (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, CLOUDFRONT_DOMAIN)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CDN_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

if (!BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    console.error('Missing AWS credentials or bucket. Check your .env file.');
    process.exit(1);
}

const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const BACKGROUNDS_DIR = path.resolve(__dirname, '../../../apps/desktop/public/assets/backgrounds');
const THEMES_PREFIX = 'themes/backgrounds';

async function fileExistsInS3(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}

async function uploadThemes() {
    const files = fs.readdirSync(BACKGROUNDS_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

    console.log(`\nFound ${files.length} theme files to upload...\n`);
    const cdnUrls = {};

    for (const file of files) {
        const filePath = path.join(BACKGROUNDS_DIR, file);
        const s3Key = `${THEMES_PREFIX}/${file}`;
        const ext = path.extname(file).toLowerCase();
        const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
        const contentType = mimeMap[ext] || 'image/png';

        const exists = await fileExistsInS3(s3Key);
        if (exists) {
            console.log(`✓ Already in S3: ${s3Key}`);
        } else {
            const buffer = fs.readFileSync(filePath);
            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
                Body: buffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable',
            }));
            console.log(`↑ Uploaded: ${file} → s3://${BUCKET}/${s3Key}`);
        }

        const themeName = path.basename(file, ext);
        const cdnUrl = CDN_DOMAIN
            ? `https://${CDN_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${s3Key}`
            : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;

        cdnUrls[themeName] = cdnUrl;
    }

    console.log('\n✅ Done! Add these URLs to Settings.jsx THEMES object:\n');
    for (const [name, url] of Object.entries(cdnUrls)) {
        console.log(`  ${name}: "${url}"`);
    }

    return cdnUrls;
}

uploadThemes().catch(err => {
    console.error('Upload failed:', err.message);
    process.exit(1);
});
