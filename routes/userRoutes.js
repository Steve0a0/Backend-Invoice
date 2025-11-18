const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadProfileImage, uploadCompanyLogo, updateUser, getUser, getBankDetails, updateBankDetails } = require("../controllers/userController");
const { authenticate } = require("../middleware/authh");

const router = express.Router();

// Multer configuration for profile images
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/profile-images";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const profileImageUpload = multer({
  storage: profileImageStorage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (mimeType && extname) {
      return cb(null, true);
    } else {
      cb("Error: Only JPEG, JPG, and PNG files are allowed!");
    }
  },
});

// Multer configuration for company logos
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/company-logos";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|svg/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (mimeType && extname) {
      return cb(null, true);
    } else {
      cb("Error: Only JPEG, JPG, PNG, and SVG files are allowed!");
    }
  },
});

// Route for uploading profile image
router.post("/profile-image", authenticate, profileImageUpload.single("profileImage"), uploadProfileImage);

// Route for uploading company logo
router.post("/company-logo", authenticate, logoUpload.single("companyLogo"), uploadCompanyLogo);


// Route for updating user profile
router.patch("/profile", authenticate, updateUser);

// Route for getting user profile
router.get("/profile", authenticate, getUser);

// Route for getting bank details
router.get("/bank-details", authenticate, getBankDetails);

// Route for updating bank details
router.put("/bank-details", authenticate, updateBankDetails);

module.exports = router;
