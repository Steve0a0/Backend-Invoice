const fs = require("fs");
const path = require("path");

/**
 * Convert image file to base64 data URI for embedding in PDFs
 * @param {string} imagePath - Path to the image file
 * @returns {string|null} - Base64 data URI or null if file doesn't exist
 */
function imageToBase64(imagePath) {
  try {
    if (!imagePath) return null;
    
    // Construct full path
    const fullPath = path.join(__dirname, "..", imagePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine MIME type from file extension
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/png'; // default
    
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.png') {
      mimeType = 'image/png';
    } else if (ext === '.svg') {
      mimeType = 'image/svg+xml';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    }
    
    // Return data URI
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

module.exports = {
  imageToBase64
};
