const Member = require("../models/memberModel");
const paymentsModel = require("../models/paymentsModel");
const mpesaService = require("../services/mpesaService");

const ALLOWED_TYPES = new Set(["missions", "tithes-offerings", "tabernacle-construction", "general"]);

function buildContributionReference(type) {
    const map = {
        missions: "MISSIONS",
        "tithes-offerings": "TITHE",
        "tabernacle-construction": "TABERNACLE",
        general: "GENERAL"
    };
    return map[type] || "CHURCH";
}

function getBankRedirectBaseUrl() {
    return String(process.env.BANK_PAYMENT_REDIRECT_URL || "").trim();
}

function appBaseUrl(req) {
    const envUrl = String(process.env.APP_BASE_URL || "").trim();
    if (envUrl) return envUrl.replace(/\/$/, "");
    const host = req.get("host");
    const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
    return host ? `${protocol}://${host}` : "";
}

function paymentConfigResponse(req) {
    const base = appBaseUrl(req);
    const mpesa = mpesaService.getConfigStatus(base);
    return {
        mpesa,
        bankRedirect: {
            enabled: Boolean(getBankRedirectBaseUrl())
        }
    };
}

function buildBankRedirectUrl(req, { paymentId, amount, contributionType, memberName }) {
    const base = getBankRedirectBaseUrl();
    if (!base) return null;

    const url = new URL(base);
    const appUrl = appBaseUrl(req);
    const successUrl = String(process.env.BANK_PAYMENT_SUCCESS_URL || `${appUrl}/api/payments/bank/return?status=success&paymentId=${paymentId}`).trim();
    const cancelUrl = String(process.env.BANK_PAYMENT_CANCEL_URL || `${appUrl}/api/payments/bank/return?status=cancelled&paymentId=${paymentId}`).trim();
    url.searchParams.set("paymentId", String(paymentId));
    url.searchParams.set("amount", String(amount));
    url.searchParams.set("contributionType", contributionType);
    url.searchParams.set("memberName", memberName);
    url.searchParams.set("successUrl", successUrl);
    url.searchParams.set("cancelUrl", cancelUrl);
    return url.toString();
}

async function resolveMember(memberId, memberName) {
    let member = null;
    if (memberName && !memberId) {
        member = await Member.getMemberByName(memberName);
    } else if (memberId) {
        member = await Member.getById(memberId);
    }
    return member;
}

async function resolveMemberForRequest(req, memberId, memberName) {
    if (req.user?.role === "admin") {
        return resolveMember(memberId, memberName);
    }

    const accountName = String(req.user?.name || "").trim();
    if (!accountName) {
        return null;
    }

    return resolveMember(null, accountName);
}

exports.getPaymentStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: "Invalid payment id" });

        const payment = await paymentsModel.getPaymentById(id);
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user?.role !== "admin" && Number(payment.created_by) !== Number(req.user?.id)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        res.json({
            id: payment.id,
            amount: payment.amount,
            donor_name: payment.donor_name,
            contribution_type: payment.contribution_type,
            payment_method: payment.payment_method,
            status: payment.status,
            provider_reference: payment.provider_reference,
            redirect_url: payment.redirect_url,
            response_message: payment.response_message,
            paid_at: payment.paid_at,
            created_at: payment.created_at
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPaymentConfig = async (req, res) => {
    try {
        res.json(paymentConfigResponse(req));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.initiateMpesaStk = async (req, res) => {
    try {
        const { memberId, memberName, amount, description, contributionType, phone } = req.body;
        const mpesaConfig = mpesaService.getConfigStatus(appBaseUrl(req));
        if (!mpesaConfig.enabled) {
            return res.status(501).json({
                error: `M-Pesa is not configured yet. Missing: ${mpesaConfig.missing.join(", ")}`
            });
        }

        const member = await resolveMemberForRequest(req, memberId, memberName);
        if (!member) return res.status(404).json({ error: "Member not found" });

        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ error: "Valid amount is required" });
        }

        const type = String(contributionType || "general").trim();
        if (!ALLOWED_TYPES.has(type)) {
            return res.status(400).json({ error: "Invalid contribution type" });
        }

        const phoneNumber = mpesaService.normalizePhone(phone || member.phone);
        if (!phoneNumber) {
            return res.status(400).json({ error: "A valid phone number is required for STK push" });
        }

        const externalReference = mpesaService.createExternalReference(buildContributionReference(type));
        const paymentId = await paymentsModel.createPayment({
            member_id: member.id,
            donor_name: member.name,
            phone_number: phoneNumber,
            amount: amountNum,
            contribution_type: type,
            description,
            payment_method: "mpesa_stk",
            status: "pending",
            created_by: req.user?.id || null,
            external_reference: externalReference
        });

        try {
            const stkResponse = await mpesaService.initiateStkPush({
                amount: amountNum,
                phoneNumber,
                accountReference: externalReference,
                description: description || `${buildContributionReference(type)} contribution`,
                callbackUrl: mpesaConfig.callbackUrl
            });

            await paymentsModel.updatePayment(paymentId, {
                provider_request_id: stkResponse.MerchantRequestID || null,
                provider_checkout_id: stkResponse.CheckoutRequestID || null,
                response_message: stkResponse.CustomerMessage || stkResponse.ResponseDescription || null,
                provider_payload: JSON.stringify(stkResponse)
            });

            return res.status(201).json({
                message: stkResponse.CustomerMessage || "STK push sent successfully",
                paymentId,
                checkoutRequestId: stkResponse.CheckoutRequestID,
                merchantRequestId: stkResponse.MerchantRequestID,
                status: "pending"
            });
        } catch (stkErr) {
            await paymentsModel.updatePayment(paymentId, {
                status: "failed",
                response_message: stkErr.message
            });
            throw stkErr;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.initiateBankRedirect = async (req, res) => {
    try {
        const { memberId, memberName, amount, description, contributionType } = req.body;
        const member = await resolveMemberForRequest(req, memberId, memberName);
        if (!member) return res.status(404).json({ error: "Member not found" });

        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ error: "Valid amount is required" });
        }

        const type = String(contributionType || "general").trim();
        if (!ALLOWED_TYPES.has(type)) {
            return res.status(400).json({ error: "Invalid contribution type" });
        }

        const redirectBase = getBankRedirectBaseUrl();
        if (!redirectBase) {
            return res.status(501).json({
                error: "Bank redirect payment is not configured yet. Add BANK_PAYMENT_REDIRECT_URL and provider return URLs in the server environment."
            });
        }

        const externalReference = mpesaService.createExternalReference(`BANK-${buildContributionReference(type)}`);
        const paymentId = await paymentsModel.createPayment({
            member_id: member.id,
            donor_name: member.name,
            phone_number: member.phone || null,
            amount: amountNum,
            contribution_type: type,
            description,
            payment_method: "bank_redirect",
            status: "pending",
            created_by: req.user?.id || null,
            external_reference: externalReference
        });

        const redirectUrl = buildBankRedirectUrl(req, {
            paymentId,
            amount: amountNum,
            contributionType: type,
            memberName: member.name
        });

        await paymentsModel.updatePayment(paymentId, {
            redirect_url: redirectUrl,
            response_message: "Redirect ready"
        });

        res.status(201).json({
            message: "Redirecting to bank payment provider",
            paymentId,
            redirectUrl,
            status: "pending"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.handleMpesaCallback = async (req, res) => {
    try {
        const callback = req.body?.Body?.stkCallback;
        if (!callback) {
            return res.status(400).json({ error: "Invalid callback payload" });
        }

        const checkoutId = callback.CheckoutRequestID;
        const payment = await paymentsModel.getPaymentByCheckoutId(checkoutId);
        if (!payment) {
            return res.status(404).json({ error: "Payment record not found" });
        }

        const metadataItems = callback.CallbackMetadata?.Item || [];
        const findMeta = (name) => metadataItems.find((item) => item.Name === name)?.Value;
        const resultCode = Number(callback.ResultCode);
        const receipt = findMeta("MpesaReceiptNumber") || null;
        const transactionDateRaw = findMeta("TransactionDate");
        let paidAt = new Date();
        if (transactionDateRaw) {
            const raw = String(transactionDateRaw);
            const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
            if (match) {
                paidAt = new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3]),
                    Number(match[4]),
                    Number(match[5]),
                    Number(match[6])
                );
            }
        }

        if (resultCode === 0) {
            await paymentsModel.updatePayment(payment.id, {
                provider_reference: receipt,
                response_message: callback.ResultDesc || "Payment completed",
                provider_payload: JSON.stringify(req.body)
            });
            await paymentsModel.finalizeSuccessfulPayment(payment, receipt, paidAt);
        } else {
            await paymentsModel.updatePayment(payment.id, {
                status: "failed",
                response_message: callback.ResultDesc || "Payment failed",
                provider_payload: JSON.stringify(req.body)
            });
        }

        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.handleBankReturn = async (req, res) => {
    try {
        const paymentId = Number(req.query.paymentId);
        const status = String(req.query.status || "").trim().toLowerCase();
        const reference = String(req.query.reference || "").trim();
        const message = String(req.query.message || "").trim();

        if (!paymentId) {
            return res.status(400).json({ error: "Invalid paymentId" });
        }

        const payment = await paymentsModel.getPaymentById(paymentId);
        if (!payment) {
            return res.status(404).json({ error: "Payment record not found" });
        }

        const contributionType = payment.contribution_type || "general";

        if (status === "success" || status === "completed") {
            await paymentsModel.updatePayment(payment.id, {
                provider_reference: reference || payment.provider_reference || payment.external_reference,
                response_message: message || "Bank payment completed"
            });
            await paymentsModel.finalizeSuccessfulPayment(payment, reference || payment.external_reference, new Date());
            return res.redirect(`/contribution.html?type=${encodeURIComponent(contributionType)}&paymentId=${payment.id}&paymentStatus=completed`);
        }

        await paymentsModel.updatePayment(payment.id, {
            status: "failed",
            provider_reference: reference || payment.provider_reference || null,
            response_message: message || "Bank payment not completed"
        });
        return res.redirect(`/contribution.html?type=${encodeURIComponent(contributionType)}&paymentId=${payment.id}&paymentStatus=failed`);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
