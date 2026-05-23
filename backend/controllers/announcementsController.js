const db = require('../utils/db');
const { sendSMS } = require('../utils/sms');
const { sendEmail } = require('../utils/email');

function createBulkSummary(attempted = false) {
    return {
        attempted,
        sent: false,
        recipients: 0,
        successCount: 0,
        failureCount: 0,
        error: null,
        failures: []
    };
}

async function sendBulkSMS(message) {
    const summary = createBulkSummary(true);
    const [members] = await db.execute('SELECT name, phone FROM members WHERE phone IS NOT NULL AND phone != ""');
    summary.recipients = members.length;

    if (!members.length) {
        summary.error = 'No members with phone numbers found';
        return summary;
    }

    for (const member of members) {
        const result = await sendSMS(member.phone, message).catch((err) => ({ ok: false, error: err.message }));
        if (result && result.ok) {
            summary.successCount += 1;
        } else {
            summary.failureCount += 1;
            if (summary.failures.length < 5) {
                summary.failures.push({
                    recipient: member.name || member.phone,
                    error: result?.error || 'Failed to send SMS'
                });
            }
        }
    }

    summary.sent = summary.successCount === summary.recipients;
    if (!summary.sent) {
        summary.error = `Sent to ${summary.successCount}/${summary.recipients} member(s)`;
    }
    return summary;
}

async function sendBulkEmail(subject, message) {
    const summary = createBulkSummary(true);
    const [recipients] = await db.execute(`
        SELECT name, email
        FROM users
        WHERE email IS NOT NULL AND email LIKE '%@%'
        UNION
        SELECT name, phone AS email
        FROM users
        WHERE phone IS NOT NULL AND phone LIKE '%@%'
    `);
    summary.recipients = recipients.length;

    if (!recipients.length) {
        summary.error = 'No users with email addresses found';
        return summary;
    }

    for (const recipient of recipients) {
        const result = await sendEmail(recipient.email, subject, message).catch((err) => ({ ok: false, error: err.message }));
        if (result && result.ok) {
            summary.successCount += 1;
        } else {
            summary.failureCount += 1;
            if (summary.failures.length < 5) {
                summary.failures.push({
                    recipient: recipient.name || recipient.email,
                    error: result?.error || 'Failed to send email'
                });
            }
        }
    }

    summary.sent = summary.successCount === summary.recipients;
    if (!summary.sent) {
        summary.error = `Sent to ${summary.successCount}/${summary.recipients} email recipient(s)`;
    }
    return summary;
}

// Create announcement (admin only)
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, message, sendSMSToMembers, sendEmailToMembers } = req.body;
        const createdBy = req.user.id;
        if (!title || !message) return res.status(400).json({ error: 'title and message required' });
        if ((sendSMSToMembers || sendEmailToMembers) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can send bulk announcement messages' });
        }

        const [result] = await db.execute(
            'INSERT INTO announcements (title, message, created_by) VALUES (?, ?, ?)',
            [title, message, createdBy]
        );

        let smsSummary = createBulkSummary(!!sendSMSToMembers);
        let emailSummary = createBulkSummary(!!sendEmailToMembers);

        if (sendSMSToMembers) {
            smsSummary = await sendBulkSMS(message);
        }

        if (sendEmailToMembers) {
            emailSummary = await sendBulkEmail(title, message);
        }

        res.status(201).json({ id: result.insertId, title, message, smsSummary, emailSummary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// List announcements
exports.getAnnouncements = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT a.id, a.title, a.message, a.created_at, u.name as created_by_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Send SMS to individual member (admin only)
exports.sendSMSToMember = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can send SMS messages' });
        }

        const { memberId, message } = req.body;
        
        if (!memberId || !message) {
            return res.status(400).json({ error: 'memberId and message are required' });
        }

        // Get member phone number
        const [members] = await db.execute(
            'SELECT name, phone FROM members WHERE id = ? AND phone IS NOT NULL AND phone != ""',
            [memberId]
        );

        if (members.length === 0) {
            return res.status(404).json({ error: 'Member not found or has no phone number' });
        }

        const member = members[0];
        const smsResult = await sendSMS(member.phone, message);

        if (smsResult && smsResult.ok) {
            // Log the SMS in announcements if needed
            const [result] = await db.execute(
                'INSERT INTO announcements (title, message, created_by) VALUES (?, ?, ?)',
                [`SMS to ${member.name}`, message, req.user.id]
            );
            res.json({ 
                success: true, 
                message: `SMS sent to ${member.name}`,
                memberName: member.name,
                phone: member.phone
            });
        } else {
            res.status(500).json({ error: smsResult?.error || 'Failed to send SMS. Please check phone number format.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

