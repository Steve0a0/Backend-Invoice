const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const InvoiceTemplate = sequelize.define("InvoiceTemplate", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  category: { type: DataTypes.STRING, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false },
  templateHTML: { type: DataTypes.TEXT, allowNull: false }, // Store full HTML
}, { timestamps: true });

InvoiceTemplate.belongsTo(User, { foreignKey: "userId" });
User.hasMany(InvoiceTemplate, { foreignKey: "userId" });

module.exports = InvoiceTemplate;
