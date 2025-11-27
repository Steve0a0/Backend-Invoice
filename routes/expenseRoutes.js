const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const {
  uploadReceipt,
  listExpenses,
  getExpenseById,
  updateExpense,
  linkExpenseToInvoice,
} = require("../controllers/expenseController");
const { authenticate } = require("../middleware/authh");

const receiptsDir = path.join(__dirname, "..", "uploads", "receipts");
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, receiptsDir),
  filename: (_, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || "";
    cb(null, `${timestamp}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function fileFilter(_, file, cb) {
  const allowed = ["image/png", "image/jpeg", "application/pdf"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only PNG, JPG, or PDF files are allowed"), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = express.Router();

router.post(
  "/upload",
  authenticate,
  upload.single("receipt"),
  uploadReceipt
);
router.get("/", authenticate, listExpenses);
router.get("/:id", authenticate, getExpenseById);
router.patch("/:id", authenticate, updateExpense);
router.post("/:id/link", authenticate, linkExpenseToInvoice);

module.exports = router;
