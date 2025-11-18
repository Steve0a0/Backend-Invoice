const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User"); // Import User model

const EmailTemplate = sequelize.define("EmailTemplate", {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "custom", // other types: payment_reminder, overdue_notice, etc.
  },
});

// Define relationship
EmailTemplate.belongsTo(User, { foreignKey: "userId" });
User.hasMany(EmailTemplate, { foreignKey: "userId" });

module.exports = EmailTemplate;
