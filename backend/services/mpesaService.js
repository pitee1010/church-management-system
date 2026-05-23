const crypto = require("crypto");

function envValue(...names) {
    for (const name of names) {
        const value = String(process.env[name] || "").trim();
        if (value) return value;
    }
    return "";
}

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
    const key = envValue("MPESA_CONSUMER_KEY", "SAFARICOM_CONSUMER_KEY", "DARAJA_CONSUMER_KEY");
    const secret = envValue("MPESA_CONSUMER_SECRET", "SAFARICOM_CONSUMER_SECRET", "DARAJA_CONSUMER_SECRET");
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
    const shortcode = envValue("MPESA_SHORTCODE", "MPESA_BUSINESS_SHORTCODE", "MPESA_PAYBILL", "MPESA_TILL");
    const passkey = envValue("MPESA_PASSKEY", "MPESA_STK_PASSKEY", "DARAJA_PASSKEY");

    if (!envValue("MPESA_CONSUMER_KEY", "SAFARICOM_CONSUMER_KEY", "DARAJA_CONSUMER_KEY")) missing.push("MPESA_CONSUMER_KEY");
    if (!envValue("MPESA_CONSUMER_SECRET", "SAFARICOM_CONSUMER_SECRET", "DARAJA_CONSUMER_SECRET")) missing.push("MPESA_CONSUMER_SECRET");
    if (!shortcode) missing.push("MPESA_SHORTCODE");
    if (!passkey) missing.push("MPESA_PASSKEY");

    const resolvedCallbackUrl = callbackUrl(baseAppUrl);
    if (!resolvedCallbackUrl) {
        missing.push("MPESA_CALLBACK_URL or APP_BASE_URL");
    } else if (!/^https:\/\//i.test(resolvedCallbackUrl)) {
        missing.push("HTTPS MPESA_CALLBACK_URL or APP_BASE_URL");
    }

    return {
        enabled: missing.length === 0,
        environment: envName(),
        shortcode,
        transactionType: envValue("MPESA_TRANSACTION_TYPE") || "CustomerPayBillOnline",
        callbackUrl: resolvedCallbackUrl,
        missing
    };
};

exports.normalizePhone = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    let normalized = digits;
    if (digits.startsWith("254")) normalized = digits;
    else if (digits.startsWith("0")) normalized = `254${digits.slice(1)}`;
    else if (digits.length === 9) normalized = `254${digits}`;

    return /^2547\d{8}$/.test(normalized) ? normalized : "";
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
    const amountNum = Math.round(Number(amount));
    if (!Number.isFinite(amountNum) || amountNum < 1) {
        throw new Error("M-Pesa amount must be at least KSH 1");
    }

    const accessToken = await getAccessToken();
    const ts = timestamp();
    const shortcode = envValue("MPESA_SHORTCODE", "MPESA_BUSINESS_SHORTCODE", "MPESA_PAYBILL", "MPESA_TILL");
    const partyB = envValue("MPESA_PARTY_B", "MPESA_PARTYB", "MPESA_SHORTCODE", "MPESA_BUSINESS_SHORTCODE", "MPESA_PAYBILL", "MPESA_TILL");
    const passkey = envValue("MPESA_PASSKEY", "MPESA_STK_PASSKEY", "DARAJA_PASSKEY");
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
            TransactionType: envValue("MPESA_TRANSACTION_TYPE") || "CustomerPayBillOnline",
            Amount: amountNum,
            PartyA: phoneNumber,
            PartyB: partyB,
            PhoneNumber: phoneNumber,
            CallBackURL: resolvedCallbackUrl,
            AccountReference: String(accountReference || "CHURCH").slice(0, 12),
            TransactionDesc: String(description || "Church contribution").slice(0, 60)
        })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ResponseCode !== "0") {
        throw new Error(data.errorMessage || data.ResponseDescription || data.CustomerMessage || "Failed to initiate STK push");
    }

    return data;
};
