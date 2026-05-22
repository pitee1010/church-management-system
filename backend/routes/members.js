const express = require('express');
const router = require("express").Router();

// Import the members controller
const membersController = require('../controllers/membersController');

// Import the auth middleware
const authMiddleware = require('../middlewares/authMiddleware');


const { createMember,getMembers } = require("../controllers/membersController");
const verifyToken = require("../middlewares/verifyToken");
const { exportToCSV } = require('../utils/export');
const memberModel = require('../models/memberModel');

router.post("/", verifyToken, createMember);
router.get("/", verifyToken, getMembers);
router.get("/my-pass", authMiddleware, membersController.getMyMemberPass);
router.delete('/:id', authMiddleware, membersController.deleteMember);
router.put('/:id', authMiddleware, membersController.updateMember);
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        const db = require('../utils/db');

        // Total members (all members regardless of who created them)
        const [membersCountRows] = await db.execute(
            "SELECT COUNT(*) as total FROM members"
        );
        const totalMembers = membersCountRows[0].total || 0;

        // Upcoming events (next 30 days)
        const [eventsRows] = await db.execute(
            "SELECT COUNT(*) as upcoming FROM events WHERE event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
        );
        const upcomingEvents = eventsRows[0].upcoming || 0;

        // Total donations amount
        const [donationRows] = await db.execute(
            "SELECT IFNULL(SUM(amount),0) as totalDonations FROM donations"
        );
        const totalDonations = donationRows[0].totalDonations || 0;

        // Today's attendance count
        const [attendanceRows] = await db.execute(
            "SELECT COUNT(*) as todayAttendance FROM attendance WHERE DATE(check_in) = CURDATE()"
        );
        const todayAttendance = attendanceRows[0].todayAttendance || 0;

        res.json({ totalMembers, upcomingEvents, totalDonations, todayAttendance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export', authMiddleware, async (req, res) => {
    try {
        const members = await memberModel.getAll(req.user); // admin sees all, user sees own
        const fileName = 'members_export.csv';
        exportToCSV(members, fileName);
        res.download(fileName);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
