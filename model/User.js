const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

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
  },
  accountHolderName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  iban: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bic: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sortCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  swiftCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  routingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bankAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  additionalInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Invoice item structure preference
  itemStructure: {
    type: DataTypes.ENUM('hourly', 'fixed_price', 'daily_rate', 'simple'),
    defaultValue: 'hourly',
    allowNull: false,
  },
});

module.exports = User;
