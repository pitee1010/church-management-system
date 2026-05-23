const twilio = require("twilio");

const sendSMS = async (to, message) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !from) {
        console.warn("[SMS] Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.");
        return { ok: false, error: "SMS provider is not configured" };
    }

    const normalizedTo = normalizePhone(to);
    if (!normalizedTo) {
        return { ok: false, error: "Invalid phone number" };
    }

    try {
        const client = twilio(accountSid, authToken);
        const result = await client.messages.create({
            body: message,
            from,
            to: normalizedTo
        });
        return { ok: true, sid: result.sid };
    } catch (err) {
        console.error("SMS send error:", err.message);
        return { ok: false, error: err.message };
    }
};

function normalizePhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("254")) return `+${digits}`;
    if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
    if (digits.length === 9) return `+254${digits}`;
    if (String(phone || "").trim().startsWith("+")) return String(phone).trim();
    return `+${digits}`;
}

module.exports = { sendSMS, normalizePhone };
