const sendVerificationEmail = async (email, code) => {
  // In dev mode, log to console. In production, integrate with SendGrid/AWS SES.
  console.log(`[DEV] Verification code for ${email}: ${code}`);
};

module.exports = {
  sendVerificationEmail
};
