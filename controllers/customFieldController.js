const CustomField = require("../model/CustomField");
const { logActivity } = require("../utils/activityLogger");

// Get all custom fields for the user
exports.getCustomFields = async (req, res) => {
  try {
    const userId = req.user.id;

    const customFields = await CustomField.findAll({
      where: { userId },
      order: [["sortOrder", "ASC"], ["createdAt", "ASC"]],
    });

    res.status(200).json(customFields);
  } catch (error) {
    console.error("Error fetching custom fields:", error);
    res.status(500).json({ message: "Failed to fetch custom fields" });
  }
};

// Get active custom fields only
exports.getActiveCustomFields = async (req, res) => {
  try {
    const userId = req.user.id;

    const customFields = await CustomField.findAll({
      where: { userId, isActive: true },
      order: [["sortOrder", "ASC"], ["createdAt", "ASC"]],
    });

    res.status(200).json(customFields);
  } catch (error) {
    console.error("Error fetching active custom fields:", error);
    res.status(500).json({ message: "Failed to fetch custom fields" });
  }
};

// Create a new custom field
exports.createCustomField = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      fieldName,
      fieldLabel,
      fieldType,
      fieldOptions,
      placeholder,
      defaultValue,
      isRequired,
      showInInvoice,
      showInEmail,
      sortOrder,
    } = req.body;

    // Validate required fields
    if (!fieldName || !fieldLabel) {
      return res.status(400).json({ message: "Field name and label are required" });
    }

    // Check if field name already exists for this user
    const existingField = await CustomField.findOne({
      where: { userId, fieldName },
    });

    if (existingField) {
      return res.status(400).json({ message: "A field with this name already exists" });
    }

    const customField = await CustomField.create({
      userId,
      fieldName,
      fieldLabel,
      fieldType: fieldType || 'text',
      fieldOptions,
      placeholder,
      defaultValue,
      isRequired: isRequired || false,
      showInInvoice: showInInvoice !== undefined ? showInInvoice : true,
      showInEmail: showInEmail !== undefined ? showInEmail : true,
      sortOrder: sortOrder || 0,
    });

    await logActivity(
      userId,
      'settings_updated',
      `Custom field "${fieldLabel}" created`,
      null,
      { fieldName, fieldLabel, fieldType }
    );

    res.status(201).json({
      message: "Custom field created successfully",
      customField,
    });
  } catch (error) {
    console.error("Error creating custom field:", error);
    res.status(500).json({ message: "Failed to create custom field" });
  }
};

// Update a custom field
exports.updateCustomField = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      fieldLabel,
      fieldType,
      fieldOptions,
      placeholder,
      defaultValue,
      isRequired,
      isActive,
      showInInvoice,
      showInEmail,
      sortOrder,
    } = req.body;

    const customField = await CustomField.findOne({
      where: { id, userId },
    });

    if (!customField) {
      return res.status(404).json({ message: "Custom field not found" });
    }

    // Update fields
    if (fieldLabel !== undefined) customField.fieldLabel = fieldLabel;
    if (fieldType !== undefined) customField.fieldType = fieldType;
    if (fieldOptions !== undefined) customField.fieldOptions = fieldOptions;
    if (placeholder !== undefined) customField.placeholder = placeholder;
    if (defaultValue !== undefined) customField.defaultValue = defaultValue;
    if (isRequired !== undefined) customField.isRequired = isRequired;
    if (isActive !== undefined) customField.isActive = isActive;
    if (showInInvoice !== undefined) customField.showInInvoice = showInInvoice;
    if (showInEmail !== undefined) customField.showInEmail = showInEmail;
    if (sortOrder !== undefined) customField.sortOrder = sortOrder;

    await customField.save();

    await logActivity(
      userId,
      'settings_updated',
      `Custom field "${customField.fieldLabel}" updated`,
      null,
      { fieldName: customField.fieldName, fieldLabel }
    );

    res.status(200).json({
      message: "Custom field updated successfully",
      customField,
    });
  } catch (error) {
    console.error("Error updating custom field:", error);
    res.status(500).json({ message: "Failed to update custom field" });
  }
};

// Delete a custom field
exports.deleteCustomField = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const customField = await CustomField.findOne({
      where: { id, userId },
    });

    if (!customField) {
      return res.status(404).json({ message: "Custom field not found" });
    }

    const fieldLabel = customField.fieldLabel;
    await customField.destroy();

    await logActivity(
      userId,
      'settings_updated',
      `Custom field "${fieldLabel}" deleted`,
      null,
      { fieldLabel }
    );

    res.status(200).json({ message: "Custom field deleted successfully" });
  } catch (error) {
    console.error("Error deleting custom field:", error);
    res.status(500).json({ message: "Failed to delete custom field" });
  }
};

// Bulk update custom field order
exports.updateCustomFieldOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fieldOrders } = req.body; // Array of { id, sortOrder }

    if (!Array.isArray(fieldOrders)) {
      return res.status(400).json({ message: "fieldOrders must be an array" });
    }

    const updatePromises = fieldOrders.map(({ id, sortOrder }) =>
      CustomField.update(
        { sortOrder },
        { where: { id, userId } }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({ message: "Custom field order updated successfully" });
  } catch (error) {
    console.error("Error updating custom field order:", error);
    res.status(500).json({ message: "Failed to update field order" });
  }
};
