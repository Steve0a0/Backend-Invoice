const { Router } = require ("express");
const { createUser , loginUser, googleAuth, refreshToken, forgotPassword, resetPassword, verifyOTP, resendOTP } = require ("../controllers/authController");
const { authenticate } = require("../middleware/authh");
const router = Router();

router.post("/signup", createUser)
router.post("/login", loginUser)
router.post("/verify-otp", verifyOTP)
router.post("/resend-otp", resendOTP)
router.post("/auth/google", googleAuth)
router.post("/refresh-token", authenticate, refreshToken)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password/:token", resetPassword)

module.exports = router;
