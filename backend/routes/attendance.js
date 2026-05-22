const router = require('express').Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/authMiddleware');

// Support both specific and root endpoints for compatibility
router.post('/mark', authMiddleware, attendanceController.markAttendance);
router.post('/scan/qr', authMiddleware, attendanceController.scanQrAttendance);
router.post('/', authMiddleware, attendanceController.markAttendance);

router.get('/trends', authMiddleware, attendanceController.getAttendanceTrends);
router.get('/', authMiddleware, attendanceController.getAttendanceRecords);
router.get('/my-report', authMiddleware, attendanceController.getMyAttendanceReport);
// Reporting routes
router.get('/report/month', authMiddleware, attendanceController.getMonthlyReport);
router.get('/report/year', authMiddleware, attendanceController.getYearlyReport);
router.get('/member/:id', authMiddleware, attendanceController.getMemberStats);

// Delete attendance record
router.delete('/', authMiddleware, attendanceController.deleteAttendance);

module.exports = router;
