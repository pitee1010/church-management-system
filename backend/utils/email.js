const nodemailer = require('nodemailer');

async function sendEmail(to, subject, text) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("[EMAIL] Email is not configured. Set EMAIL_USER and EMAIL_PASS.");
        return { ok: false, error: "Email provider is not configured" };
    }

    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER, // your email
            pass: process.env.EMAIL_PASS  // your email password or app password
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
        return { ok: true };
    } catch (err) {
        console.error(err);
        return { ok: false, error: err.message };
    }
}

module.exports = { sendEmail };
