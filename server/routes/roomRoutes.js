const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Where to save files and what name to give
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Timestamp + original name to avoid duplicates
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Block dangerous file types
const fileFilter = (req, file, cb) => {
  const blockedTypes = ['.exe', '.sh', '.bat', '.cmd'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (blockedTypes.includes(ext)) {
    return cb(new Error('This file type is not allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// File upload endpoint
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    const fileInfo = {
      name: req.file.originalname,
      url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
      size: req.file.size,
      type: req.file.mimetype,
      uploadedBy: req.body.userName,
      roomId: req.body.roomId
    };

    // Notify everyone in the room about the new file
    req.app.get('io').to(req.body.roomId).emit('file-shared', fileInfo);

    res.json({ success: true, file: fileInfo });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;