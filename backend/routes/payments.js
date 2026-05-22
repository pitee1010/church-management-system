const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");
const controller = require("../controllers/paymentsController");

router.post("/mpesa/callback", controller.handleMpesaCallback);
router.get("/bank/return", controller.handleBankReturn);
router.get("/config", authMiddleware, controller.getPaymentConfig);
router.post("/mpesa/stk", authMiddleware, controller.initiateMpesaStk);
router.post("/bank/redirect", authMiddleware, controller.initiateBankRedirect);
router.get("/:id", authMiddleware, controller.getPaymentStatus);

module.exports = router;
