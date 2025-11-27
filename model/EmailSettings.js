const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User"); // Import User model
const { safeEncrypt, safeDecrypt } = require("../utils/encryption");

const EmailSettings = sequelize.define("EmailSettings", {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  appPassword: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("appPassword", safeEncrypt(value, { label: "EmailSettings.appPassword" }));
    },
    get() {
      const raw = this.getDataValue("appPassword");
      return safeDecrypt(raw, { label: "EmailSettings.appPassword" });
    },
  },
  smtpHost: {
    type: DataTypes.STRING,
    allowNull: true, // Optional: for custom SMTP servers
  },
  smtpPort: {
    type: DataTypes.INTEGER,
    allowNull: true, // Optional: for custom SMTP servers
    defaultValue: 587,
  },
  deliveryMethod: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "custom",
    validate: {
      isIn: {
        args: [["custom", "default"]],
        msg: "Delivery method must be either custom or default",
      },
    },
  },
  paypalClientId: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("paypalClientId", safeEncrypt(value, { label: "EmailSettings.paypalClientId" }));
    },
    get() {
      const raw = this.getDataValue("paypalClientId");
      return safeDecrypt(raw, { label: "EmailSettings.paypalClientId" });
    },
  },
  paypalSecret: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("paypalSecret", safeEncrypt(value, { label: "EmailSettings.paypalSecret" }));
    },
    get() {
      const raw = this.getDataValue("paypalSecret");
      return safeDecrypt(raw, { label: "EmailSettings.paypalSecret" });
    },
  },
  stripeSecretKey: {
    type: DataTypes.STRING,
    allowNull: true,
    set(value) {
      this.setDataValue("stripeSecretKey", safeEncrypt(value, { label: "EmailSettings.stripeSecretKey" }));
    },
    get() {
      const raw = this.getDataValue("stripeSecretKey");
      return safeDecrypt(raw, { label: "EmailSettings.stripeSecretKey" });
    },
  },
});

// Define relationship
EmailSettings.belongsTo(User, { foreignKey: "userId" });
User.hasOne(EmailSettings, { foreignKey: "userId" });

module.exports = EmailSettings;
