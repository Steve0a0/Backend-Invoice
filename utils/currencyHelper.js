// Currency helper functions

/**
 * Get currency symbol from currency code
 * @param {string} currencyCode - Currency code (USD, EUR, GBP, etc.)
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currencyCode) {
  const symbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
    CHF: "Fr",
    SEK: "kr",
    NZD: "NZ$"
  };
  
  return symbols[currencyCode] || currencyCode;
}

module.exports = {
  getCurrencySymbol
};
