const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465, // true for 465, false for 587
    auth: {
        user: config.email.user,
        pass: config.email.pass
    }
});

/**
 * Send OTP verification email
 * @param {string} to - Recipient email address
 * @param {string} otp - 6-digit OTP code
 */
async function sendOtpEmail(to, otp) {
    const mailOptions = {
        from: `"Vatu App" <${config.email.from}>`,
        to,
        subject: 'Your Email Verification OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #333; margin-bottom: 8px;">Email Verification</h2>
                <p style="color: #555;">Use the OTP below to verify your account. It expires in <strong>10 minutes</strong>.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #4f46e5; background: #f0f0ff; padding: 16px 28px; border-radius: 8px;">
                        ${otp}
                    </span>
                </div>
                <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail };
