// routes/media.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

// --- Local storage config ---
const uploadDir = path.join(__dirname, "../uploads/audio");

// make sure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// configure multer to store files locally
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const allowedMimes = new Set([
  "audio/mpeg",   // mp3
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm"
]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit (adjust as needed)
  fileFilter: (req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
      // reject with multer-style error
      const err = new Error("Only audio files are allowed (mp3, wav, m4a, ogg, webm).");
      err.code = "INVALID_FILE_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
});

// --- Upload route: POST /media/upload ---
router.post(
  "/upload",
  protect,
  restrictTo(["faculty", "admin"]),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      // build local URL for development (ensure your server serves /uploads statically)
      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/audio/${req.file.filename}`;

      return res.json({
        message: "Audio uploaded successfully",
        url: fileUrl,
      });
    } catch (err) {
      console.error("Audio upload error:", err);
      return res.status(500).json({ message: "Error uploading audio" });
    }
  }
);

// Multer error handler for this router (optional, but helpful)
router.use((err, req, res, next) => {
  if (err) {
    console.error("Media route error:", err);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 20MB)" });
    }
    if (err.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ message: err.message || "Invalid file type" });
    }
    return res.status(500).json({ message: err.message || "Upload error" });
  }
  next();
});

module.exports = router;
