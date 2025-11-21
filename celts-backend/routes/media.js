// routes/media.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

// Directories 
const adminUploadDir = path.join(__dirname, "../uploads/audio");
const studentUploadDir = path.join(__dirname, "../uploads/studentSubmission");

// Make sure directories exist
for (const dir of [adminUploadDir, studentUploadDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Allowed MIME types 
const allowedMimes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",  // mov
  "video/x-matroska"  // mkv
]);

// Multer storage factory 
function createUploader(destinationFolder) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destinationFolder),
      filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
      if (!allowedMimes.has(file.mimetype)) {
        const err = new Error("Invalid file type. Audio & video only.");
        err.code = "INVALID_FILE_TYPE";
        return cb(err);
      }
      cb(null, true);
    },
  });
}

const adminUpload = createUploader(adminUploadDir);
const studentUpload = createUploader(studentUploadDir);


// Admin/Faculty upload 
router.post("/upload", protect, restrictTo(["faculty", "admin"]), adminUpload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/audio/${req.file.filename}`;
    res.json({ message: "Audio uploaded successfully", url: fileUrl });
  } catch (err) {
    console.error("Admin upload error:", err);
    res.status(500).json({ message: "Error uploading audio" });
  }
}
);



// Student upload (audio/video)
router.post("/upload/student", protect, restrictTo(["student"]), studentUpload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/studentSubmission/${req.file.filename}`;
    res.json({ message: "Student submission saved", url: fileUrl });
  } catch (err) {
    console.error("Student upload error:", err);
    res.status(500).json({ message: "Error uploading student submission" });
  }
}
);


// Multer error handler
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
