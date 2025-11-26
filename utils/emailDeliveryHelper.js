const DEFAULT_METHOD = "default";

const DEFAULT_SENDER_CONFIG = {
  email: process.env.DEFAULT_DELIVERY_EMAIL || process.env.EMAIL_USER,
  password: process.env.DEFAULT_DELIVERY_PASSWORD || process.env.EMAIL_PASSWORD,
  fromAddress:
    process.env.DEFAULT_DELIVERY_FROM ||
    process.env.EMAIL_FROM ||
    process.env.DEFAULT_DELIVERY_EMAIL ||
    process.env.EMAIL_USER ||
    null,
  host: process.env.DEFAULT_DELIVERY_HOST || process.env.EMAIL_HOST,
  port: process.env.DEFAULT_DELIVERY_PORT || process.env.EMAIL_PORT,
  service: process.env.DEFAULT_DELIVERY_SERVICE || process.env.EMAIL_SERVICE,
  secure: process.env.DEFAULT_DELIVERY_SECURE || process.env.EMAIL_SECURE,
};

const buildCustomTransporterConfig = (emailSettings) => {
  const transporterConfig = {
    auth: {
      user: emailSettings.email,
      pass: emailSettings.appPassword,
    },
  };

  const emailDomain = emailSettings.email?.split("@")[1]?.toLowerCase() || "";

  if (emailDomain.includes("gmail")) {
    transporterConfig.service = "Gmail";
  } else if (
    emailDomain.includes("outlook") ||
    emailDomain.includes("hotmail") ||
    emailDomain.includes("live")
  ) {
    transporterConfig.host = "smtp-mail.outlook.com";
    transporterConfig.port = 587;
    transporterConfig.secure = false;
    transporterConfig.tls = { ciphers: "SSLv3" };
  } else if (emailDomain.includes("office365.com")) {
    transporterConfig.host = "smtp.office365.com";
    transporterConfig.port = 587;
    transporterConfig.secure = false;
    transporterConfig.tls = { ciphers: "SSLv3" };
  } else {
    transporterConfig.host = emailSettings.smtpHost || "smtp.office365.com";
    transporterConfig.port = emailSettings.smtpPort || 587;
    transporterConfig.secure = false;
    transporterConfig.tls = { ciphers: "SSLv3" };
  }

  return transporterConfig;
};

const buildDefaultTransporterConfig = () => {
  const defaultEmail = DEFAULT_SENDER_CONFIG.email;
  const defaultPassword = DEFAULT_SENDER_CONFIG.password;

  if (!defaultEmail || !defaultPassword) {
    return null;
  }

  if (DEFAULT_SENDER_CONFIG.host) {
    return {
      transporterConfig: {
        host: DEFAULT_SENDER_CONFIG.host,
        port: DEFAULT_SENDER_CONFIG.port ? Number(DEFAULT_SENDER_CONFIG.port) : 587,
        secure: DEFAULT_SENDER_CONFIG.secure === "true",
        auth: {
          user: defaultEmail,
          pass: defaultPassword,
        },
      },
      fromAddress: DEFAULT_SENDER_CONFIG.fromAddress || defaultEmail,
    };
  }

  return {
    transporterConfig: {
      service: DEFAULT_SENDER_CONFIG.service || "Gmail",
      auth: {
        user: defaultEmail,
        pass: defaultPassword,
      },
    },
    fromAddress: DEFAULT_SENDER_CONFIG.fromAddress || defaultEmail,
  };
};

const buildDeliveryContext = (emailSettings, user) => {
  if (!emailSettings) {
    return {
      ready: false,
      reason: "missing-settings",
      errorMessage: "Email settings not found. Please configure them first.",
    };
  }

  const method = emailSettings.deliveryMethod === DEFAULT_METHOD ? DEFAULT_METHOD : "custom";

  if (method === DEFAULT_METHOD) {
    const defaultTransport = buildDefaultTransporterConfig();
    if (!defaultTransport) {
      return {
        ready: false,
        reason: "missing-default-env",
        errorMessage: "Default email delivery is unavailable. Please contact support.",
      };
    }

    const replyToAddress = user?.email || emailSettings.email || DEFAULT_SENDER_CONFIG.email || null;

    return {
      ready: true,
      useDefaultSender: true,
      transporterConfig: defaultTransport.transporterConfig,
      fromAddress: defaultTransport.fromAddress,
      replyToAddress,
      ccAddress: replyToAddress,
      deliveryMethod: method,
    };
  }

  if (!emailSettings.email || !emailSettings.appPassword) {
    return {
      ready: false,
      reason: "missing-custom-credentials",
      errorMessage: "Email settings not found or incomplete. Please configure them first.",
    };
  }

  return {
    ready: true,
    useDefaultSender: false,
    transporterConfig: buildCustomTransporterConfig(emailSettings),
    fromAddress: emailSettings.email,
    replyToAddress: null,
    ccAddress: null,
    deliveryMethod: method,
  };
};

module.exports = {
  buildDeliveryContext,
};
