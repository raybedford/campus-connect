const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');

const transporter = nodemailer.createTransport({
  host: config.MAIL_HOST,
  port: config.MAIL_PORT,
  auth: {
    user: config.MAIL_USER,
    pass: config.MAIL_PASS
  }
});

const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: `"Campus Connect" <${config.MAIL_FROM}>`,
    to: email,
    subject: 'Verify your Campus Connect account',
    text: `Your verification code is: ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #000;">Campus Connect Verification</h2>
        <p>Welcome to Campus Connect! Use the code below to verify your email address:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <hr />
        <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${email}`);
  } catch (err) {
    logger.error(`Failed to send verification email to ${email}:`, err);
    // In dev/test, we don't want to crash the signup if email fails, 
    // but in prod, this might be a critical failure.
  }
};

const sendPasswordResetEmail = async (email, code) => {
  const mailOptions = {
    from: `"Campus Connect" <${config.MAIL_FROM}>`,
    to: email,
    subject: 'Reset your Campus Connect password',
    text: `Your password reset code is: ${code}. It expires in 15 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #000;">Reset Your Password</h2>
        <p>We received a request to reset your password. Use the code below to proceed:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
          ${code}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <hr />
        <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}`);
  } catch (err) {
    logger.error(`Failed to send password reset email to ${email}:`, err);
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
