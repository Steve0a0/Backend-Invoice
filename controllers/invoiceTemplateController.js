const InvoiceTemplate = require("../model/InvoiceTemplate");

exports.createTemplate = async (req, res) => {
  try {
    const { title, description, category, currency, templateHTML } = req.body;
    const template = await InvoiceTemplate.create({
      userId: req.user.id,
      title,
      description,
      category,
      currency,
      templateHTML,
    });

    res.status(201).json({ message: "Template saved successfully", template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserTemplates = async (req, res) => {
  try {
    const templates = await InvoiceTemplate.findAll({ where: { userId: req.user.id } });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
    try {
      const { templateHTML } = req.body;
      const { id } = req.params;
  
      // Find the template by ID
      const template = await InvoiceTemplate.findOne({ where: { id } });
  
      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }
  
      // Update the template HTML
      template.templateHTML = templateHTML;
      await template.save();
  
      res.json({ message: "Template updated successfully", template });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };


  exports.deleteTemplate = async (req, res) => {
    try {
      const { id } = req.params;
      
      const template = await InvoiceTemplate.findOne({ where: { id } });
  
      if (!template) {
        return res.status(404).json({ error: "Template not found." });
      }
  
      await template.destroy(); // Delete the template
      res.json({ message: "Template deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };