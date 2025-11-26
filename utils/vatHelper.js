const VAT_FIELD_KEY = "_systemVat";

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return fallback;
};

const roundCurrency = (value) => {
  return Number(normalizeNumber(value).toFixed(2));
};

const sanitizeVatDetails = (rawVat = {}) => {
  if (!rawVat || typeof rawVat !== "object") {
    return { enabled: false, rate: 0, number: "" };
  }

  return {
    enabled: Boolean(rawVat.enabled),
    rate: normalizeNumber(rawVat.rate, 0),
    number: rawVat.number || "",
  };
};

const calculateVatAmount = (subtotal, vatDetails) => {
  if (!vatDetails.enabled || vatDetails.rate <= 0) {
    return 0;
  }
  return roundCurrency((subtotal * vatDetails.rate) / 100);
};

const sumTaskTotals = (tasks = []) => {
  return roundCurrency(
    tasks.reduce((sum, task) => {
      const taskTotal = task?.total;
      if (taskTotal === undefined || taskTotal === null) {
        return sum;
      }
      return sum + normalizeNumber(taskTotal, 0);
    }, 0)
  );
};

const buildFinancialSummary = (
  tasks = [],
  customFields = {},
  invoiceTotalAmount = null
) => {
  const subtotal = sumTaskTotals(tasks);
  const vatDetails = sanitizeVatDetails(customFields?.[VAT_FIELD_KEY]);
  const vatAmount = calculateVatAmount(subtotal, vatDetails);
  const totalWithVat = roundCurrency(subtotal + vatAmount);

  const updatedCustomFields = { ...(customFields || {}) };
  if (vatDetails.enabled && vatDetails.rate > 0) {
    updatedCustomFields[VAT_FIELD_KEY] = {
      enabled: true,
      rate: vatDetails.rate,
      number: vatDetails.number || "",
      amount: vatAmount,
      subtotal,
    };
  } else if (updatedCustomFields[VAT_FIELD_KEY]) {
    delete updatedCustomFields[VAT_FIELD_KEY];
  }

  const fallbackTotal =
    invoiceTotalAmount !== null && invoiceTotalAmount !== undefined
      ? roundCurrency(invoiceTotalAmount)
      : subtotal;
  const finalTotal = vatDetails.enabled ? totalWithVat : fallbackTotal;

  return {
    subtotal,
    vatDetails,
    vatAmount,
    totalWithVat: finalTotal,
    updatedCustomFields,
  };
};

const extractVatDetails = (customFields = {}) => {
  const vat = customFields?.[VAT_FIELD_KEY];
  return {
    enabled: Boolean(vat?.enabled),
    rate: normalizeNumber(vat?.rate, 0),
    number: vat?.number || "",
    amount: normalizeNumber(vat?.amount, 0),
    subtotal: vat?.subtotal !== undefined ? normalizeNumber(vat?.subtotal, 0) : null,
  };
};

module.exports = {
  VAT_FIELD_KEY,
  buildFinancialSummary,
  extractVatDetails,
  sumTaskTotals,
};
