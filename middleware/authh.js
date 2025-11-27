const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach the payload to req.user

    if (!req.user.id) {
      return res.status(401).json({ error: "Unauthorized: User ID not found." });
    }

    next();
  } catch (error) {
    console.error("JWT Verification Error in middleware:", error); // Debugging output
    res.status(400).json({ message: "Invalid token." });
  }
};
