const nodeMailer = require('nodemailer');
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpSecure = process.env.SMTP_SECURE;
const smtpRequireTLS = process.env.SMTP_REQUIRE_TLS;
const smtpAuthUser = process.env.SMTP_AUTH_USER;
const smtpAuthPass = process.env.SMTP_AUTH_PASS;

transpoter = nodeMailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
    auth: {
        user: smtpAuthUser,
        pass: smtpAuthPass
    }
})

module.exports = transpoter;