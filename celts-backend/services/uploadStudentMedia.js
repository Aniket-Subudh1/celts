// services/uploadStudentMedia.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads", "student-media");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || ".webm";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const uploadStudentMedia = multer({
  storage,
  // Optional: basic filter
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype || "";
    if (
      mime.startsWith("audio/") ||
      mime.startsWith("video/") ||
      mime === "application/octet-stream"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio/video files are allowed for speaking tests."));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

module.exports = uploadStudentMedia;
