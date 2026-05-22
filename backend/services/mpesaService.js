const crypto = require("crypto");

function envName() {
    return String(process.env.MPESA_ENV || "sandbox").trim().toLowerCase();
}

function baseUrl() {
    return envName() === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";
}

function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function normalizeBaseUrl(url) {
    return String(url || "").trim().replace(/\/$/, "");
}

function callbackUrl(baseAppUrl = "") {
    const explicit = normalizeBaseUrl(process.env.MPESA_CALLBACK_URL);
    if (explicit) {
        return explicit;
    }

    const base = normalizeBaseUrl(baseAppUrl || process.env.APP_BASE_URL);
    return base ? `${base}/api/payments/mpesa/callback` : "";
}

function authHeader() {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    if (!key || !secret) {
        throw new Error("Missing M-Pesa credentials");
    }
    return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

async function getAccessToken() {
    const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
            Authorization: authHeader()
        }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        throw new Error(data.errorMessage || data.error_description || "Failed to get M-Pesa access token");
    }

    return data.access_token;
}

exports.isConfigured = () => {
    return exports.getConfigStatus().enabled;
};

exports.getCallbackUrl = (baseAppUrl = "") => callbackUrl(baseAppUrl);

exports.getConfigStatus = (baseAppUrl = "") => {
    const missing = [];

    if (!process.env.MPESA_CONSUMER_KEY) missing.push("MPESA_CONSUMER_KEY");
    if (!process.env.MPESA_CONSUMER_SECRET) missing.push("MPESA_CONSUMER_SECRET");
    if (!process.env.MPESA_SHORTCODE) missing.push("MPESA_SHORTCODE");
    if (!process.env.MPESA_PASSKEY) missing.push("MPESA_PASSKEY");

    const resolvedCallbackUrl = callbackUrl(baseAppUrl);
    if (!resolvedCallbackUrl) {
        missing.push("MPESA_CALLBACK_URL or APP_BASE_URL");
    }

    return {
        enabled: missing.length === 0,
        environment: envName(),
        shortcode: process.env.MPESA_SHORTCODE || "",
        callbackUrl: resolvedCallbackUrl,
        missing
    };
};

exports.normalizePhone = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("254")) return digits;
    if (digits.startsWith("0")) return `254${digits.slice(1)}`;
    if (digits.length === 9) return `254${digits}`;
    return digits;
};

exports.createExternalReference = (prefix = "PAY") => {
    return `${prefix}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
};

exports.initiateStkPush = async ({
    amount,
    phoneNumber,
    accountReference,
    description,
    callbackUrl: callbackUrlOverride
}) => {
    const accessToken = await getAccessToken();
    const ts = timestamp();
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
    const resolvedCallbackUrl = callbackUrlOverride || callbackUrl();

    if (!resolvedCallbackUrl) {
        throw new Error("Missing M-Pesa callback URL");
    }

    const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: ts,
            TransactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
            Amount: Math.round(Number(amount)),
            PartyA: phoneNumber,
            PartyB: shortcode,
            PhoneNumber: phoneNumber,
            CallBackURL: resolvedCallbackUrl,
            AccountReference: accountReference,
            TransactionDesc: description || "Church contribution payment"
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ResponseCode !== "0") {
        throw new Error(data.errorMessage || data.ResponseDescription || "Failed to initiate STK push");
    }

    return data;
};
