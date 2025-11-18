const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const CustomField = sequelize.define("CustomField", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
  },
  fieldName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "Internal name for the field (e.g., 'po_number', 'tax_id')",
  },
  fieldLabel: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "Display label for the field (e.g., 'PO Number', 'Tax ID')",
  },
  fieldType: {
    type: DataTypes.ENUM('text', 'number', 'date', 'email', 'textarea', 'select', 'checkbox'),
    defaultValue: 'text',
    allowNull: false,
  },
  fieldOptions: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Options for select fields (array of strings)",
  },
  placeholder: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Placeholder text for the field",
  },
  defaultValue: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Default value for the field",
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  showInInvoice: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Show this field in the invoice PDF",
  },
  showInEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Show this field in email templates",
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Display order of the field",
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ["userId", "isActive"],
    },
  ],
});

// Define relationship
CustomField.belongsTo(User, { foreignKey: "userId" });
User.hasMany(CustomField, { foreignKey: "userId" });

module.exports = CustomField;
