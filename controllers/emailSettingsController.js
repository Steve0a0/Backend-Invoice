const EmailSettings = require("../model/EmailSettings");
const { logActivity } = require("../utils/activityLogger");

exports.saveEmailSettings = async (req, res) => {
  const { email, appPassword, deliveryMethod = "custom" } = req.body;
  const normalizedMethod = deliveryMethod === "default" ? "default" : "custom";

  if (normalizedMethod === "custom" && (!email || !appPassword)) {
    return res.status(400).json({ error: "Email and app password are required for custom delivery." });
  }

  try {
    const userId = req.user.id; // Ensure the user is authenticated
    console.log("Saving user email settings for User ID:", userId);

    const existingSettings = await EmailSettings.findOne({ where: { userId } });

    const payload = { deliveryMethod: normalizedMethod };

    if (normalizedMethod === "custom") {
      payload.email = email;
      payload.appPassword = appPassword;
    } else {
      if (email) {
        payload.email = email;
      }
      if (appPassword) {
        payload.appPassword = appPassword;
      }
    }

    if (existingSettings) {
      // Update user email and app password only
      await existingSettings.update(payload);

      // Log activity
      await logActivity(
        userId,
        'email_settings_updated',
        normalizedMethod === 'default'
          ? 'Email delivery switched to InvoiceGen default sender'
          : `Email settings updated (${email})`,
        null,
        { email: payload.email || existingSettings.email, deliveryMethod: normalizedMethod }
      );

      console.log("Updated user email settings.");
      return res.status(200).json({
        message: "User email settings updated successfully!",
        settings: {
          email: existingSettings.email,
          appPassword: existingSettings.appPassword,
          deliveryMethod: normalizedMethod,
        },
      });
    }

    // Create new entry if no settings exist
    const newSettings = await EmailSettings.create({
      userId,
      email: payload.email || null,
      appPassword: payload.appPassword || null,
      deliveryMethod: normalizedMethod,
    });

    // Log activity
    await logActivity(
      userId,
      'email_settings_updated',
      normalizedMethod === 'default'
        ? 'Email delivery configured to use InvoiceGen default sender'
        : `Email settings configured (${email})`,
      null,
      { email: payload.email || null, deliveryMethod: normalizedMethod }
    );

    console.log("Saved new user email settings.");
    res.status(201).json({
      message: "User email settings saved successfully!",
      settings: {
        email: newSettings.email,
        appPassword: newSettings.appPassword,
        deliveryMethod: newSettings.deliveryMethod,
      },
    });
  } catch (error) {
    console.error("Error saving user email settings:", error);
    res.status(500).json({ error: "Failed to save user email settings." });
  }
};

exports.getEmailSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await EmailSettings.findOne({ where: { userId } });

    if (!settings) {
      return res.status(404).json({ error: "Email settings not found." });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching email settings:", error);
    res.status(500).json({ error: "Failed to fetch email settings." });
  }
};

exports.savePaypalSettings = async (req, res) => {
  const { paypalClientId, paypalSecret } = req.body;

  if (!paypalClientId || !paypalSecret) {
    return res.status(400).json({ error: "PayPal Client ID and Secret Key are required." });
  }

  try {
    const userId = req.user.id;
    console.log("Saving PayPal settings for User ID:", userId);

    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/paypal/webhook/${userId}`;
    const existingSettings = await EmailSettings.findOne({ where: { userId } });

    if (existingSettings) {
      await existingSettings.update({ paypalClientId, paypalSecret, webhookUrl });

      console.log("Updated PayPal settings.");
      return res.status(200).json({
        message: "PayPal settings updated successfully!",
        settings: { paypalClientId, paypalSecret, webhookUrl },
      });
    }

    const newSettings = await EmailSettings.create({ userId, paypalClientId, paypalSecret, webhookUrl });

    console.log("Saved new PayPal settings.");
    res.status(201).json({
      message: "PayPal settings saved successfully!",
      settings: { paypalClientId, paypalSecret, webhookUrl },
    });
  } catch (error) {
    console.error("Error saving PayPal settings:", error);
    res.status(500).json({ error: "Failed to save PayPal settings." });
  }
};

exports.saveStripeSettings = async (req, res) => {
  const { stripeSecretKey } = req.body;

  if (!stripeSecretKey) {
    return res.status(400).json({ error: "Stripe Secret Key is required." });
  }

  try {
    const userId = req.user.id;
    console.log("Saving Stripe settings for User ID:", userId);

    const existingSettings = await EmailSettings.findOne({ where: { userId } });

    if (existingSettings) {
      await existingSettings.update({ stripeSecretKey });

      console.log("Updated Stripe settings.");
      return res.status(200).json({
        message: "Stripe settings updated successfully!",
        settings: { stripeSecretKey: existingSettings.stripeSecretKey },
      });
    }

    const newSettings = await EmailSettings.create({ userId, stripeSecretKey });

    console.log("Saved new Stripe settings.");
    res.status(201).json({
      message: "Stripe settings saved successfully!",
      settings: { stripeSecretKey: newSettings.stripeSecretKey },
    });
  } catch (error) {
    console.error("Error saving Stripe settings:", error);
    res.status(500).json({ error: "Failed to save Stripe settings." });
  }
};

exports.getStripeSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Fetching Stripe settings for User ID:", userId);

    const settings = await EmailSettings.findOne({ where: { userId } });

    if (!settings || !settings.stripeSecretKey) {
      return res.status(404).json({ error: "Stripe settings not found." });
    }

    res.status(200).json({ stripeSecretKey: settings.stripeSecretKey });
  } catch (error) {
    console.error("Error fetching Stripe settings:", error);
    res.status(500).json({ error: "Failed to fetch Stripe settings." });
  }
};
