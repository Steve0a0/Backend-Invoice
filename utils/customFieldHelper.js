/**
 * Prepare custom fields for use in templates
 * Converts customFields object into template placeholders
 * Optionally accepts field definitions to use custom placeholders
 */
async function prepareCustomFieldsForTemplate(customFields = {}, userId = null) {
  const prepared = {};
  
  // If userId is provided, fetch custom field definitions to use custom placeholders
  let fieldDefinitions = {};
  if (userId) {
    try {
      const CustomField = require("../model/CustomField");
      const fields = await CustomField.findAll({
        where: { userId, isActive: true },
      });
      
      // Map fieldName to placeholder
      fields.forEach(field => {
        fieldDefinitions[field.fieldName] = field.placeholder || field.fieldName;
      });
    } catch (error) {
      console.error("Error fetching custom field definitions:", error);
    }
  }
  
  // Add each custom field with its custom placeholder (if available)
  Object.keys(customFields).forEach(key => {
    const value = customFields[key];
    
    // Use custom placeholder if available, otherwise use the key
    const placeholderKey = fieldDefinitions[key] || key;
    prepared[placeholderKey] = value;
    
    // Also keep original key for backward compatibility
    if (placeholderKey !== key) {
      prepared[key] = value;
    }
    
    // Convert to camelCase if key is snake_case (for backward compatibility)
    const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    if (camelKey !== key) {
      prepared[camelKey] = value;
    }
    
    // Convert to snake_case if key is camelCase (for backward compatibility)
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (snakeKey !== key) {
      prepared[snakeKey] = value;
    }
  });
  
  return prepared;
}

/**
 * Get formatted custom field value for display
 */
function formatCustomFieldValue(value, fieldType) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  switch (fieldType) {
    case 'date':
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'number':
      return Number(value).toLocaleString();
    case 'checkbox':
      return value ? 'Yes' : 'No';
    default:
      return value.toString();
  }
}

/**
 * Generate placeholder documentation for custom fields
 */
function generateCustomFieldPlaceholders(customFields = []) {
  return customFields.map(field => ({
    placeholder: `{{${field.placeholder || field.fieldName}}}`,
    label: field.fieldLabel,
    type: field.fieldType,
    description: `Custom field: ${field.fieldLabel}`,
  }));
}

module.exports = {
  prepareCustomFieldsForTemplate,
  formatCustomFieldValue,
  generateCustomFieldPlaceholders,
};
