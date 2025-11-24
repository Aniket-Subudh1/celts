const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { uploadToS3, deleteFromS3, isS3Configured } = require("../config/s3");
const { isS3Url, getStorageProvider } = require("../utils/s3Utils");

const router = express.Router();

const adminUploadDir = path.join(__dirname, "../uploads/audio");
const studentUploadDir = path.join(__dirname, "../uploads/studentSubmission");

for (const dir of [adminUploadDir, studentUploadDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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
  "video/quicktime", 
  "video/x-matroska"  
]);

// Multer storage factory 
function createUploader(destinationFolder) {
  return multer({
    storage: multer.memoryStorage(), 
    limits: { fileSize: 20 * 1024 * 1024 }, 
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

// Flag to determine if S3 should be used (based on environment variables)
const useS3 = isS3Configured;

console.log(`Media storage configured: ${useS3 ? 'Amazon S3 (Cloud)' : 'Local Server'}`);
if (useS3) {
  console.log(`S3 Bucket: ${process.env.S3_BUCKET_NAME}`);
  console.log(`S3 Region: ${process.env.AWS_REGION || 'us-east-1'}`);
}

// Admin/Faculty upload 
router.post("/upload", protect, restrictTo(["faculty", "admin"]), adminUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    if (useS3) {
      try {
        const fileName = req.file.originalname || 'audio_file';
        const s3Url = await uploadToS3(req.file.buffer, fileName, req.file.mimetype, 'audio');
        
        console.log('Audio uploaded to S3 successfully:', s3Url);
        return res.json({ 
          message: "Audio uploaded successfully to S3", 
          url: s3Url,
          provider: 'S3'
        });
      } catch (s3Error) {
        console.error('S3 upload failed, falling back to local storage:', s3Error);
      }
    }

    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(req.file.originalname) || '.mp3';
    const filename = `${unique}${ext}`;
    const filepath = path.join(adminUploadDir, filename);
    
    fs.writeFileSync(filepath, req.file.buffer);
    
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/audio/${filename}`;
    res.json({ 
      message: "Audio uploaded successfully", 
      url: fileUrl,
      provider: 'local'
    });
  } catch (err) {
    console.error("Admin upload error:", err);
    res.status(500).json({ message: "Error uploading audio" });
  }
});



// Student upload (audio/video)
router.post("/upload/student", protect, restrictTo(["student"]), studentUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    if (useS3) {
      // Upload to S3
      try {
        const fileName = req.file.originalname || 'student_submission';
        const s3Url = await uploadToS3(req.file.buffer, fileName, req.file.mimetype, 'student-submissions');
        
        console.log('Student submission uploaded to S3 successfully:', s3Url);
        return res.json({ 
          message: "Student submission saved to S3", 
          url: s3Url,
          provider: 'S3'
        });
      } catch (s3Error) {
        console.error('S3 upload failed for student, falling back to local storage:', s3Error);
        // Fall back to local storage if S3 fails
      }
    }

    // Fallback to local storage (original implementation)
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(req.file.originalname) || '.webm';
    const filename = `${unique}${ext}`;
    const filepath = path.join(studentUploadDir, filename);
    
    // Write buffer to file
    fs.writeFileSync(filepath, req.file.buffer);
    
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/studentSubmission/${filename}`;
    res.json({ 
      message: "Student submission saved", 
      url: fileUrl,
      provider: 'local'
    });
  } catch (err) {
    console.error("Student upload error:", err);
    res.status(500).json({ message: "Error uploading student submission" });
  }
});

// Delete audio file (for admin/faculty)
router.delete("/delete", protect, restrictTo(["faculty", "admin"]), async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    // Check if it's an S3 URL
    if (isS3Url(url)) {
      await deleteFromS3(url);
      return res.json({ message: "File deleted successfully from S3" });
    }

    // Handle local file deletion
    const filename = path.basename(url);
    const filepath = path.join(adminUploadDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return res.json({ message: "File deleted successfully from local storage" });
    } else {
      return res.status(404).json({ message: "File not found" });
    }
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ message: "Error deleting file" });
  }
});

// Get storage configuration info (for admin/faculty)
router.get("/config", protect, restrictTo(["faculty", "admin"]), (req, res) => {
  res.json({
    storageProvider: useS3 ? 'S3' : 'Local',
    description: useS3 ? 'Amazon S3 (Cloud)' : 'Local Server Storage',
    bucketName: useS3 ? process.env.S3_BUCKET_NAME : null,
    region: useS3 ? (process.env.AWS_REGION || 'us-east-1') : null
  });
});

// Serve static files (for backward compatibility with local storage)
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
