const token = localStorage.getItem("token");
const donationsTable = document.getElementById("donationsTable");
const donationForm = document.getElementById("donationForm");
const totalContributedEl = document.getElementById("totalContributed");
const showDonateBtn = document.getElementById("showDonateBtn");
const cancelDonateBtn = document.getElementById("cancelDonateBtn");
const donateFormDiv = document.getElementById("donateFormDiv");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const mpesaPayBtn = document.getElementById("mpesaPayBtn");
const bankPayBtn = document.getElementById("bankPayBtn");
const manualRecordBtn = document.getElementById("manualRecordBtn");
const paymentStatusPanel = document.getElementById("paymentStatusPanel");
const mpesaStatusNote = document.getElementById("mpesaStatusNote");
const bankStatusNote = document.getElementById("bankStatusNote");
const mpesaPaymentOption = document.getElementById("mpesaPaymentOption");
const bankPaymentOption = document.getElementById("bankPaymentOption");
const historyHeading = document.getElementById("historyHeading");
const memberColumnHeader = document.getElementById("memberColumnHeader");
const actionsColumnHeader = document.getElementById("actionsColumnHeader");
const contributionIntro = document.getElementById("contributionIntro");
const memberNameLabel = document.getElementById("memberNameLabel");

if (!token) window.location.href = "index.html";

const payload = token ? JSON.parse(atob(token.split(".")[1])) : null;
const role = payload ? payload.role : null;
const isAdmin = role === "admin";

const params = new URLSearchParams(window.location.search);
const contributionType = params.get("type");
const paymentIdFromUrl = params.get("paymentId");
const paymentStatusFromUrl = params.get("paymentStatus");

const TYPE_META = {
    "missions": {
        title: "Missions Contributions",
        bank: "Kingdom Missions Bank",
        accountName: "Ministry of Repentance and Holiness - Missions",
        accountNumber: "1002003001",
        paybill: "821001",
        reference: "MISSIONS"
    },
    "tithes-offerings": {
        title: "Tithes and Offerings Contributions",
        bank: "Diamond Trust Bank",
        accountName: "Ministry of Repentance and Holiness",
        accountNumber: "0055227001",
        paybill: "516600",
        reference: "TITHE"
    },
    "tabernacle-construction": {
        title: "Tabernacle Construction Contributions",
        bank: "Builders Trust Bank",
        accountName: "Ministry of Repentance and Holiness - Tabernacle Construction",
        accountNumber: "1330496248",
        paybill: "522522",
        reference: "TABERNACLE"
    }
};

if (!TYPE_META[contributionType]) {
    alert("Invalid contribution type selected");
    window.location.href = "donations.html";
}

let paymentPollTimer = null;
let paymentConfig = null;

function setupTypeDetails() {
    const meta = TYPE_META[contributionType];
    document.getElementById("contribTitle").textContent = meta.title;
    document.getElementById("accBank").textContent = meta.bank;
    document.getElementById("accName").textContent = meta.accountName;
    document.getElementById("accNumber").textContent = meta.accountNumber;
    document.getElementById("accPaybill").textContent = meta.paybill;
    document.getElementById("accRef").textContent = meta.reference;

    const memberNameField = document.getElementById("member_name");
    if (memberNameField && payload?.name && !memberNameField.value) {
        memberNameField.value = payload.name;
    }

    if (!isAdmin) {
        if (historyHeading) {
            historyHeading.textContent = "Your Contribution History";
        }
        if (contributionIntro) {
            contributionIntro.textContent = "Review approved account details, pay live through M-Pesa STK push or bank redirect, and track your contribution history for this category.";
        }
        if (memberNameLabel) {
            memberNameLabel.textContent = "Your Member Name";
        }
        if (memberNameField) {
            memberNameField.readOnly = true;
        }
        if (memberColumnHeader) {
            memberColumnHeader.style.display = "none";
        }
        if (actionsColumnHeader) {
            actionsColumnHeader.style.display = "none";
        }
    }

    if (manualRecordBtn && !isAdmin) {
        manualRecordBtn.style.display = "none";
    }
}

function setMethodAvailability(button, noteEl, enabled, message, optionCard) {
    if (button) {
        button.disabled = !enabled;
    }
    if (noteEl) {
        noteEl.textContent = message || "";
    }
    if (optionCard) {
        optionCard.classList.toggle("is-disabled", !enabled);
    }
}

async function fetchPaymentConfig() {
    try {
        const res = await fetch("/api/payments/config", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Failed to load payment configuration");
        }

        paymentConfig = data;

        const mpesaEnabled = Boolean(data?.mpesa?.enabled);
        const mpesaMessage = mpesaEnabled
            ? `M-Pesa is ready in ${String(data.mpesa.environment || "sandbox").toUpperCase()} mode.`
            : `M-Pesa is unavailable until the server is configured: ${(data?.mpesa?.missing || []).join(", ")}`;
        setMethodAvailability(mpesaPayBtn, mpesaStatusNote, mpesaEnabled, mpesaMessage, mpesaPaymentOption);

        const bankEnabled = Boolean(data?.bankRedirect?.enabled);
        const bankMessage = bankEnabled
            ? "Bank redirect is available."
            : "Bank redirect is not configured on the server.";
        setMethodAvailability(bankPayBtn, bankStatusNote, bankEnabled, bankMessage, bankPaymentOption);
    } catch (err) {
        console.error(err);
        paymentConfig = null;
        setMethodAvailability(mpesaPayBtn, mpesaStatusNote, false, "Could not verify M-Pesa configuration.", mpesaPaymentOption);
        setMethodAvailability(bankPayBtn, bankStatusNote, false, "Could not verify bank redirect configuration.", bankPaymentOption);
    }
}

function showPaymentStatus(message, tone = "info") {
    if (!paymentStatusPanel) return;
    paymentStatusPanel.style.display = "block";
    paymentStatusPanel.textContent = message;
    paymentStatusPanel.className = `status-panel ${tone === "error" ? "status-error" : tone === "success" ? "status-success" : "status-info"}`;
}

function clearPaymentPolling() {
    if (paymentPollTimer) {
        clearInterval(paymentPollTimer);
        paymentPollTimer = null;
    }
}

async function fetchContributions() {
    try {
        const res = await fetch(`/api/donations?type=${encodeURIComponent(contributionType)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Failed to load contributions");
        }

        let total = 0;
        donationsTable.innerHTML = "";

        data.forEach((d) => {
            const amountNum = Number(d.amount) || 0;
            total += amountNum;
            const tr = document.createElement("tr");
            const cells = [
                `<td>${d.id}</td>`
            ];

            if (isAdmin) {
                cells.push(`<td>${d.user_name || d.donor_name || ""}</td>`);
            }

            cells.push(
                `<td>KSH ${amountNum.toLocaleString()}</td>`,
                `<td>${d.payment_method || "manual"}</td>`,
                `<td>${d.payment_reference || "-"}</td>`,
                `<td>${d.description || ""}</td>`,
                `<td>${d.date || ""}</td>`
            );

            if (isAdmin) {
                cells.push(`<td><button class="small-btn btn-primary" onclick="editContribution(${d.id})">Edit</button> <button class="small-btn btn-danger" onclick="deleteContribution(${d.id})">Delete</button></td>`);
            }

            tr.innerHTML = cells.join("");
            donationsTable.appendChild(tr);
        });

        totalContributedEl.textContent = `KSH ${total.toLocaleString()}`;
    } catch (err) {
        console.error(err);
        donationsTable.innerHTML = `<tr><td colspan="${isAdmin ? 8 : 6}">Failed to load contributions.</td></tr>`;
        totalContributedEl.textContent = "KSH 0";
    }
}

function getContributionPayload() {
    const memberName = document.getElementById("member_name")?.value.trim() || null;
    const amount = document.getElementById("amount").value;
    const description = document.getElementById("description")?.value.trim() || null;
    const phone = document.getElementById("phone_number")?.value.trim() || null;

    if (!memberName) {
        throw new Error("Please enter a member name");
    }

    if (!amount || Number(amount) <= 0) {
        throw new Error("Please enter a valid amount");
    }

    return {
        memberName,
        amount,
        description,
        contributionType,
        phone
    };
}

async function startPaymentStatusPolling(paymentId) {
    clearPaymentPolling();
    let attempts = 0;

    const poll = async () => {
        attempts += 1;
        try {
            const res = await fetch(`/api/payments/${paymentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch payment status");
            }

            if (data.status === "completed") {
                showPaymentStatus(`Payment completed successfully. Reference: ${data.provider_reference || "Recorded"}`, "success");
                clearPaymentPolling();
                fetchContributions();
                return;
            }

            if (data.status === "failed" || data.status === "cancelled") {
                showPaymentStatus(data.response_message || "Payment was not completed.", "error");
                clearPaymentPolling();
                return;
            }

            showPaymentStatus(data.response_message || "Payment is still pending. Please complete it on your phone or payment page.", "info");
            if (attempts >= 24) {
                clearPaymentPolling();
            }
        } catch (err) {
            console.error(err);
            clearPaymentPolling();
        }
    };

    await poll();
    paymentPollTimer = setInterval(poll, 5000);
}

async function initiateMpesaPayment() {
    try {
        if (paymentConfig && !paymentConfig?.mpesa?.enabled) {
            throw new Error(mpesaStatusNote?.textContent || "M-Pesa is not configured on the server");
        }

        const payloadData = getContributionPayload();
        if (!payloadData.phone) {
            throw new Error("Please enter the M-Pesa phone number for STK push");
        }

        showPaymentStatus("Sending STK push request...");
        const res = await fetch("/api/payments/mpesa/stk", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payloadData)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || "Failed to start M-Pesa payment");
        }

        showPaymentStatus(data.message || "STK push sent. Check the donor's phone to complete payment.");
        if (data.paymentId) {
            await startPaymentStatusPolling(data.paymentId);
        }
    } catch (err) {
        console.error(err);
        showPaymentStatus(err.message || "Failed to start M-Pesa payment.", "error");
    }
}

async function initiateBankRedirect() {
    try {
        if (paymentConfig && !paymentConfig?.bankRedirect?.enabled) {
            throw new Error(bankStatusNote?.textContent || "Bank redirect is not configured on the server");
        }

        const payloadData = getContributionPayload();
        showPaymentStatus("Preparing bank redirect...");
        const res = await fetch("/api/payments/bank/redirect", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payloadData)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || "Failed to prepare bank redirect");
        }

        showPaymentStatus("Redirecting to bank payment provider...");
        if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
            return;
        }
        throw new Error("Bank redirect URL was not returned");
    } catch (err) {
        console.error(err);
        showPaymentStatus(err.message || "Failed to start bank payment.", "error");
    }
}

window.deleteContribution = async function(id) {
    if(!confirm("Delete this contribution?")) return;
    try {
        const res = await fetch(`/api/donations/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        if(res.ok) fetchContributions();
        else { const data = await res.json(); alert(data.error || "Delete failed"); }
    } catch (err) { console.error(err); alert("Server error"); }
};

window.editContribution = async function(id) {
    try {
        const getRes = await fetch(`/api/donations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if(!getRes.ok){ const d = await getRes.json(); alert(d.error || "Not found"); return; }
        const row = await getRes.json();
        const newAmount = prompt("Amount", row.amount);
        if (newAmount === null) return;
        const newDescription = prompt("Description", row.description || "");
        if (newDescription === null) return;
        const newDate = prompt("Date (YYYY-MM-DD)", row.date ? row.date.split("T")[0] : "");
        if (newDate === null) return;

        const res = await fetch(`/api/donations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                amount: newAmount,
                date: newDate,
                description: newDescription,
                contributionType,
                payment_method: row.payment_method,
                payment_reference: row.payment_reference
            })
        });
        if(res.ok) fetchContributions();
        else { const data = await res.json(); alert(data.error || "Update failed"); }
    } catch (err) { console.error(err); alert("Server error"); }
};

if (donationForm) {
    donationForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (role !== "admin") {
            showPaymentStatus("Use M-Pesa STK push or bank redirect to make a live payment.", "error");
            return;
        }

        try {
            const payloadData = getContributionPayload();
            const res = await fetch("/api/donations/add", {
                method: "POST",
                headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(payloadData)
            });
            if(res.ok){
                showPaymentStatus("Manual contribution recorded successfully.", "success");
                donationForm.reset();
                donateFormDiv.classList.add("hidden");
                fetchContributions();
            } else {
                const data = await res.json();
                showPaymentStatus(data.error || "Failed to add contribution", "error");
            }
        } catch (err) {
            console.error(err);
            showPaymentStatus("Server error", "error");
        }
    });
}

showDonateBtn?.addEventListener("click", () => {
    donateFormDiv?.classList.remove("hidden");
    document.getElementById("member_name")?.focus();
});

cancelDonateBtn?.addEventListener("click", () => {
    donateFormDiv?.classList.add("hidden");
    clearPaymentPolling();
});

mpesaPayBtn?.addEventListener("click", initiateMpesaPayment);
bankPayBtn?.addEventListener("click", initiateBankRedirect);

refreshBtn?.addEventListener("click", fetchContributions);

logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

setupTypeDetails();
fetchPaymentConfig();
fetchContributions();

if (paymentIdFromUrl) {
    startPaymentStatusPolling(paymentIdFromUrl);
}

if (paymentStatusFromUrl === "completed") {
    showPaymentStatus("Payment completed and recorded successfully.", "success");
} else if (paymentStatusFromUrl === "failed" || paymentStatusFromUrl === "cancelled") {
    showPaymentStatus("Bank payment was not completed.", "error");
}
