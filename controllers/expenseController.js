const path = require("path");
const Expense = require("../model/Expense");
const { Invoice } = require("../model/Invoice");
const { extractReceiptData } = require("../services/receiptExtractor");
const { logActivity } = require("../utils/activityLogger");

const ALLOWED_STATUSES = new Set(["pending_review", "confirmed", "matched"]);

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

exports.uploadReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Receipt file is required" });
    }

    const relativePath = path
      .join("uploads", "receipts", req.file.filename)
      .replace(/\\/g, "/");

    const extraction = await extractReceiptData(req.file.path);
    const {
      vendor,
      description,
      expenseDate,
      amount,
      currency,
      taxPercent,
      taxAmount,
      category,
      confidenceScore,
      rawExtraction,
    } = extraction || {};

    const payload = {
      userId: req.user.id,
      sourceFileUrl: `/${relativePath}`,
      vendor: req.body.vendor || vendor || null,
      description: req.body.description || description || null,
      expenseDate: req.body.expenseDate || expenseDate || null,
      amount: parseNumber(req.body.amount) ?? amount,
      currency: (req.body.currency || currency || "USD").toUpperCase(),
      taxPercent: parseNumber(req.body.taxPercent) ?? taxPercent,
      taxAmount: parseNumber(req.body.taxAmount) ?? taxAmount,
      category: req.body.category || category || null,
      status: "pending_review",
      confidenceScore: confidenceScore ?? null,
      rawExtraction: rawExtraction || null,
      notes: req.body.notes || null,
    };

    const expense = await Expense.create(payload);

    await logActivity(
      req.user.id,
      "expense_created",
      `Receipt uploaded${expense.vendor ? ` for ${expense.vendor}` : ""}`,
      expense.id,
      {
        vendor: expense.vendor,
        amount: expense.amount,
        currency: expense.currency,
      }
    );

    res.status(201).json(expense);
  } catch (error) {
    console.error("Error uploading receipt:", error);
    res.status(500).json({ message: "Failed to upload receipt" });
  }
};

exports.listExpenses = async (req, res) => {
  try {
    const expenses = await Expense.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Invoice,
          as: "invoice",
          attributes: ["id", "invoiceNumber", "client", "status", "documentType"],
        },
      ],
    });
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
};

exports.getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        {
          model: Invoice,
          as: "invoice",
          attributes: ["id", "invoiceNumber", "client", "status", "documentType"],
        },
      ],
    });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    console.error("Error fetching expense:", error);
    res.status(500).json({ message: "Failed to fetch expense" });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const fields = [
      "vendor",
      "description",
      "expenseDate",
      "category",
      "notes",
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    });

    if (req.body.amount !== undefined) {
      expense.amount = parseNumber(req.body.amount);
    }
    if (req.body.taxPercent !== undefined) {
      expense.taxPercent = parseNumber(req.body.taxPercent);
    }
    if (req.body.taxAmount !== undefined) {
      expense.taxAmount = parseNumber(req.body.taxAmount);
    }
    if (req.body.currency) {
      expense.currency = req.body.currency.toUpperCase();
    }
    if (req.body.status && ALLOWED_STATUSES.has(req.body.status)) {
      expense.status = req.body.status;
    }

    await expense.save();

    await logActivity(
      req.user.id,
      "expense_updated",
      `Expense updated${expense.vendor ? ` for ${expense.vendor}` : ""}`,
      expense.id,
      {
        vendor: expense.vendor,
        amount: expense.amount,
        status: expense.status,
      }
    );

    res.json(expense);
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ message: "Failed to update expense" });
  }
};

exports.linkExpenseToInvoice = async (req, res) => {
  const { invoiceId } = req.body || {};
  try {
    const expense = await Expense.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (invoiceId) {
      const invoice = await Invoice.findOne({
        where: { id: invoiceId, userId: req.user.id },
      });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      expense.invoiceId = invoice.id;
      expense.status = "matched";
    } else {
      expense.invoiceId = null;
      if (expense.status === "matched") {
        expense.status = "confirmed";
      }
    }

    await expense.save();

    await logActivity(
      req.user.id,
      invoiceId ? "expense_linked" : "expense_unlinked",
      invoiceId
        ? `Expense linked to invoice ${invoiceId}`
        : "Expense unlinked from invoice",
      expense.id,
      {
        invoiceId: expense.invoiceId,
        vendor: expense.vendor,
        amount: expense.amount,
      }
    );

    res.json(expense);
  } catch (error) {
    console.error("Error linking expense:", error);
    res.status(500).json({ message: "Failed to update linking" });
  }
};
