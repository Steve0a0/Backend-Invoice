const EmailTemplate = require("../model/EmailTemplate");
const { logActivity } = require("../utils/activityLogger");

// Add a new template
exports.createTemplate = async (req, res) => {
  const { name, subject, content } = req.body;

  if (!name || !subject || !content) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const userId = req.user.id; // Extract from authenticated user
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID not found." });
    }

    const newTemplate = await EmailTemplate.create({ name, subject, content, userId });

    // Log activity
    await logActivity(
      userId,
      'email_template_created',
      `Email template "${name}" created`,
      null,
      { templateName: name, templateId: newTemplate.id }
    );

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error saving template:", error);
    res.status(500).json({ error: "Failed to save template." });
  }
};

// Fetch templates for the logged-in user
const { Op } = require("sequelize");

exports.getTemplates = async (req, res) => {
  try {
    const userId = req.user.id;

    const templates = await EmailTemplate.findAll({
      where: {
        [Op.or]: [
          { userId },
          { isDefault: true },
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates." });
  }
};


// Edit a template
exports.editTemplate = async (req, res) => {
  const { id } = req.params;
  const { name, subject, content } = req.body;

  if (!name || !subject || !content) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const userId = req.user.id;

    const updatedTemplate = await EmailTemplate.update(
      { name, subject, content },
      { where: { id, userId }, returning: true }
    );

    if (!updatedTemplate[0]) {
      return res.status(404).json({ error: "Template not found." });
    }

    // Log activity
    await logActivity(
      userId,
      'email_template_updated',
      `Email template "${name}" updated`,
      null,
      { templateName: name, templateId: id }
    );

    res.status(200).json(updatedTemplate[1][0]); // Return updated template
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template." });
  }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;

    // Find the template
    const template = await EmailTemplate.findOne({ where: { id, userId } });

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    // Prevent deleting default templates
    if (template.isDefault) {
      return res.status(403).json({ error: "Default templates cannot be deleted." });
    }

    // Delete the template
    await EmailTemplate.destroy({ where: { id, userId } });

    // Log activity
    await logActivity(
      userId,
      'email_template_deleted',
      `Email template "${template.name}" deleted`,
      null,
      { templateName: template.name, templateId: id }
    );

    res.status(200).json({ message: "Template deleted successfully." });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template." });
  }
};

