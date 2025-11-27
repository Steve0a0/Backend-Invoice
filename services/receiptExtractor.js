/**
 * Stubbed receipt extraction service.
 * In production this should call an OCR/LLM provider (e.g. Azure Form Recognizer).
 */
const path = require("path");

async function extractReceiptData(filePath) {
  // TODO: replace with real provider; for now return placeholder data.
  const fileName = path.basename(filePath || "");
  return {
    vendor: "Unknown Vendor",
    description: `Auto-extracted from ${fileName}`,
    expenseDate: new Date(),
    amount: null,
    currency: "USD",
    taxPercent: null,
    taxAmount: null,
    category: "Uncategorized",
    confidenceScore: 0.5,
    rawExtraction: {
      placeholder: true,
      source: fileName,
    },
  };
}

module.exports = {
  extractReceiptData,
};
