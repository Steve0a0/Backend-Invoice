const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User"); // Import User model

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
  paypalClientId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paypalSecret: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stripeSecretKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// Define relationship
EmailSettings.belongsTo(User, { foreignKey: "userId" });
User.hasOne(EmailSettings, { foreignKey: "userId" });

module.exports = EmailSettings;
