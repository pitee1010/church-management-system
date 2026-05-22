const donationsModel = require('../models/donationsModel');
const Member = require('../models/memberModel');

const ALLOWED_TYPES = new Set(['missions', 'tithes-offerings', 'tabernacle-construction', 'general']);

function isOwnDonation(user, donation) {
    if (!user || user.role === 'admin') return true;
    const accountName = String(user.name || '').trim().toLowerCase();
    const donorName = String(donation?.user_name || donation?.donor_name || '').trim().toLowerCase();
    return Boolean(accountName) && accountName === donorName;
}

// Add donation
exports.addDonation = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can record manual contributions' });
        }

        let { memberId, memberName, amount, date, description, contributionType } = req.body;
        
        // If memberName is provided, look up the member by name
        if (memberName && !memberId) {
            const member = await Member.getMemberByName(memberName);
            if (!member) return res.status(404).json({ error: 'Member not found' });
            memberId = member.id;
        }
        
        // Member must be provided — donations made by members only
        if (!memberId) return res.status(400).json({ error: 'memberId or memberName is required' });

        // Validate amount
        if (amount === undefined || amount === null || amount === "") {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const member = await Member.getById(memberId);
        if (!member) return res.status(400).json({ error: 'Member not found' });

        // Use member name as donor_name
        const donor_name = member.name;

        // Normalize optional fields
        const donation_date = date === undefined ? null : date;
        description = description === undefined ? null : description;
        contributionType = contributionType || 'general';
        if (!ALLOWED_TYPES.has(contributionType)) {
            return res.status(400).json({ error: 'Invalid contributionType' });
        }

        const donation = await donationsModel.addDonation({
            donor_name,
            amount,
            donation_date,
            contribution_type: contributionType,
            createdBy: req.user.id,
            description,
            payment_method: "manual",
            payment_reference: null
        });
        res.json({ message: "Contribution added", donation });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get donations
exports.getDonations = async (req, res) => {
    try {
        const type = req.query.type || 'all';
        if (type !== 'all' && !ALLOWED_TYPES.has(type)) {
            return res.status(400).json({ error: 'Invalid type filter' });
        }
        const donations = await donationsModel.getAll(req.user, type);
        res.json(donations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Admin: update donation
exports.updateDonation = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const id = req.params.id;
        const { amount, date, description, donor_name, contributionType, payment_method, payment_reference } = req.body;
        // Fetch existing
        const existing = await donationsModel.getById(id);
        if (!existing) return res.status(404).json({ error: 'Donation not found' });

        const donorNameFinal = donor_name === undefined ? existing.user_name : donor_name;
        const donationDateFinal = date === undefined ? existing.date : date;
        const descriptionFinal = description === undefined ? existing.description : description;
        const amountFinal = amount === undefined ? existing.amount : amount;
        const typeFinal = contributionType === undefined ? existing.contribution_type : contributionType;
        const paymentMethodFinal = payment_method === undefined ? existing.payment_method : payment_method;
        const paymentReferenceFinal = payment_reference === undefined ? existing.payment_reference : payment_reference;
        if (!ALLOWED_TYPES.has(typeFinal)) {
            return res.status(400).json({ error: 'Invalid contributionType' });
        }

        const affected = await donationsModel.updateById(id, {
            donor_name: donorNameFinal,
            amount: amountFinal,
            donation_date: donationDateFinal,
            contribution_type: typeFinal,
            description: descriptionFinal,
            payment_method: paymentMethodFinal,
            payment_reference: paymentReferenceFinal
        });
        if (affected > 0) return res.json({ message: 'Contribution updated' });
        res.status(500).json({ error: 'Update failed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Admin: delete donation
exports.deleteDonation = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const id = req.params.id;
        const existing = await donationsModel.getById(id);
        if (!existing) return res.status(404).json({ error: 'Donation not found' });
        const affected = await donationsModel.deleteById(id);
        if (affected > 0) return res.json({ message: 'Contribution deleted' });
        res.status(500).json({ error: 'Delete failed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get single donation by id
exports.getDonationById = async (req, res) => {
    try {
        const id = req.params.id;
        const donation = await donationsModel.getById(id);
        if (!donation) return res.status(404).json({ error: 'Donation not found' });
        if (!isOwnDonation(req.user, donation)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(donation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
