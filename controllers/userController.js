const User = require("../model/User");
const { logActivity } = require("../utils/activityLogger");

exports.updateUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      companyName,
      companyLogo,
      bankName,
      accountName,
      accountNumber,
      iban,
      bic,
      sortCode,
      swiftCode,
      routingNumber,
      bankAddress,
      itemStructure
    } = req.body;

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate itemStructure if provided
    if (itemStructure !== undefined) {
      const validStructures = ['hourly', 'fixed_price', 'daily_rate', 'simple'];
      if (!validStructures.includes(itemStructure)) {
        return res.status(400).json({ 
          message: "Invalid item structure. Must be one of: hourly, fixed_price, daily_rate, simple" 
        });
      }
    }

    // Update only provided fields
    if (name !== undefined) user.name = name;
    if (companyName !== undefined) user.companyName = companyName;
    if (companyLogo !== undefined) user.companyLogo = companyLogo; // Allow null to remove logo
    if (bankName !== undefined) user.bankName = bankName;
    if (accountName !== undefined) user.accountName = accountName;
    if (accountNumber !== undefined) user.accountNumber = accountNumber;
    if (iban !== undefined) user.iban = iban;
    if (bic !== undefined) user.bic = bic;
    if (sortCode !== undefined) user.sortCode = sortCode;
    if (swiftCode !== undefined) user.swiftCode = swiftCode;
    if (routingNumber !== undefined) user.routingNumber = routingNumber;
    if (bankAddress !== undefined) user.bankAddress = bankAddress;
    if (itemStructure !== undefined) user.itemStructure = itemStructure;

    await user.save();

    // Log activity
    const updatedFields = [];
    if (name !== undefined) updatedFields.push('name');
    if (companyName !== undefined) updatedFields.push('company name');
    if (itemStructure !== undefined) updatedFields.push('invoice item structure');
    await logActivity(
      userId,
      'profile_updated',
      `Profile updated: ${updatedFields.join(', ') || 'details'}`,
      null,
      { name, companyName, itemStructure }
    );

    // Return user without password
    const { password, ...userWithoutPassword } = user.toJSON();
    res.status(200).json({
      message: "User updated successfully",
      user: userWithoutPassword
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

exports.getUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user.toJSON();
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

exports.uploadProfileImage = async (req, res) => {
    try {
      const userId = req.user.id; // Access `id` from token payload
      console.log("Extracted userId:", userId); // Debugging
  
      const filePath = `uploads/profile-images/${req.file.filename}`;
  
      const user = await User.findByIdAndUpdate(
        userId,
        { profileImage: filePath },
        { new: true }
      );
  
      if (!user) {
        console.log("User not found with ID:", userId);
        return res.status(404).json({ message: "User not found" });
      }
  
      res.status(200).json({
        message: "Profile image uploaded successfully",
        profileImage: filePath,
      });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Server error. Please try again later." });
    }
  };

// Upload company logo
exports.uploadCompanyLogo = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Uploading company logo for userId:", userId);

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = `uploads/company-logos/${req.file.filename}`;

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      console.log("User not found with ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    user.companyLogo = filePath;
    await user.save();

    // Log activity
    await logActivity(
      userId,
      'company_logo_uploaded',
      'Company logo uploaded',
      null,
      { filePath }
    );

    res.status(200).json({
      message: "Company logo uploaded successfully",
      companyLogo: filePath,
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Get bank details
exports.getBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      accountHolderName: user.accountHolderName || '',
      bankName: user.bankName || '',
      iban: user.iban || '',
      bic: user.bic || '',
      sortCode: user.sortCode || '',
      accountNumber: user.accountNumber || '',
      additionalInfo: user.additionalInfo || ''
    });
  } catch (error) {
    console.error("Get bank details error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Update bank details
exports.updateBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      accountHolderName,
      bankName,
      iban,
      bic,
      sortCode,
      accountNumber,
      additionalInfo
    } = req.body;

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update bank details
    user.accountHolderName = accountHolderName || '';
    user.bankName = bankName || '';
    user.iban = iban || '';
    user.bic = bic || '';
    user.sortCode = sortCode || '';
    user.accountNumber = accountNumber || '';
    user.additionalInfo = additionalInfo || '';

    await user.save();

    // Log activity
    await logActivity(
      userId,
      'bank_details_updated',
      'Bank details updated',
      null,
      { bankName, accountHolderName }
    );

    res.status(200).json({
      message: "Bank details updated successfully",
      bankDetails: {
        accountHolderName: user.accountHolderName,
        bankName: user.bankName,
        iban: user.iban,
        bic: user.bic,
        sortCode: user.sortCode,
        accountNumber: user.accountNumber,
        additionalInfo: user.additionalInfo
      }
    });
  } catch (error) {
    console.error("Update bank details error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};
  
  