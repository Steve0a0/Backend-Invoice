const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const { safeEncrypt, safeDecrypt } = require("../utils/encryption");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [2, 100],
        msg: "Name must be between 2 and 100 characters"
      },
      notEmpty: {
        msg: "Name is required"
      }
    },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: {
      msg: "Email already exists"
    },
    validate: {
      isEmail: {
        msg: "Please provide a valid email address"
      },
      notEmpty: {
        msg: "Email is required"
      }
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [8, 255],
        msg: "Password must be at least 8 characters long"
      },
      notEmpty: {
        msg: "Password is required"
      }
    },
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [2, 100],
        msg: "Company name must be between 2 and 100 characters"
      },
      notEmpty: {
        msg: "Company name is required"
      }
    },
  },
  profileImage: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  companyLogo: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emailVerificationOTP: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emailVerificationOTPExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Bank details for invoicing
  bankName: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("bankName", safeEncrypt(value, { label: "User.bankName" }));
    },
    get() {
      const raw = this.getDataValue("bankName");
      return safeDecrypt(raw, { returnNull: true, label: "User.bankName" });
    },
  },
  accountHolderName: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("accountHolderName", safeEncrypt(value, { label: "User.accountHolderName" }));
    },
    get() {
      const raw = this.getDataValue("accountHolderName");
      return safeDecrypt(raw, { returnNull: true, label: "User.accountHolderName" });
    },
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("accountName", safeEncrypt(value, { label: "User.accountName" }));
    },
    get() {
      const raw = this.getDataValue("accountName");
      return safeDecrypt(raw, { returnNull: true, label: "User.accountName" });
    },
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("accountNumber", safeEncrypt(value, { label: "User.accountNumber" }));
    },
    get() {
      const raw = this.getDataValue("accountNumber");
      return safeDecrypt(raw, { returnNull: true, label: "User.accountNumber" });
    },
  },
  iban: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("iban", safeEncrypt(value, { label: "User.iban" }));
    },
    get() {
      const raw = this.getDataValue("iban");
      return safeDecrypt(raw, { returnNull: true, label: "User.iban" });
    },
  },
  bic: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("bic", safeEncrypt(value, { label: "User.bic" }));
    },
    get() {
      const raw = this.getDataValue("bic");
      return safeDecrypt(raw, { returnNull: true, label: "User.bic" });
    },
  },
  sortCode: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("sortCode", safeEncrypt(value, { label: "User.sortCode" }));
    },
    get() {
      const raw = this.getDataValue("sortCode");
      return safeDecrypt(raw, { returnNull: true, label: "User.sortCode" });
    },
  },
  swiftCode: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("swiftCode", safeEncrypt(value, { label: "User.swiftCode" }));
    },
    get() {
      const raw = this.getDataValue("swiftCode");
      return safeDecrypt(raw, { returnNull: true, label: "User.swiftCode" });
    },
  },
  routingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("routingNumber", safeEncrypt(value, { label: "User.routingNumber" }));
    },
    get() {
      const raw = this.getDataValue("routingNumber");
      return safeDecrypt(raw, { returnNull: true, label: "User.routingNumber" });
    },
  },
  bankAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    set(value) {
      this.setDataValue("bankAddress", safeEncrypt(value, { label: "User.bankAddress" }));
    },
    get() {
      const raw = this.getDataValue("bankAddress");
      return safeDecrypt(raw, { returnNull: true, label: "User.bankAddress" });
    },
  },
  additionalInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
    set(value) {
      this.setDataValue("additionalInfo", safeEncrypt(value, { label: "User.additionalInfo" }));
    },
    get() {
      const raw = this.getDataValue("additionalInfo");
      return safeDecrypt(raw, { returnNull: true, label: "User.additionalInfo" });
    },
  },
  // Invoice item structure preference
  itemStructure: {
    type: DataTypes.ENUM('hourly', 'fixed_price', 'daily_rate', 'simple'),
    defaultValue: 'hourly',
    allowNull: false,
  },
});

module.exports = User;
