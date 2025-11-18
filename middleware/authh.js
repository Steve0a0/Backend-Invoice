const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded JWT Payload in middleware:", decoded); // Debugging output
    req.user = decoded; // Attach the payload to req.user

    if (!req.user.id) {
      console.log("JWT does not include user ID");
      return res.status(401).json({ error: "Unauthorized: User ID not found." });
    }

    next();
  } catch (error) {
    console.error("JWT Verification Error in middleware:", error); // Debugging output
    res.status(400).json({ message: "Invalid token." });
  }
};
