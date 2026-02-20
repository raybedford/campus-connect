const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const auth = require('../middleware/auth');
const fileService = require('../services/fileService');
const config = require('../config');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE }
});

// Upload encrypted file blob
router.post('/upload', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const { originalFilename, fileSizeBytes, mimeType, totalRecipients, messageId } = req.body;

    const file = await fileService.uploadFile(
      messageId,
      originalFilename || req.file.originalname,
      req.file.filename,
      fileSizeBytes || req.file.size,
      mimeType || req.file.mimetype,
      parseInt(totalRecipients)
    );

    res.status(201).json(file);
  } catch (err) {
    next(err);
  }
});

// Download file (tracks recipient)
router.get('/:id/download', auth, async (req, res, next) => {
  try {
    const file = await fileService.getDownload(req.params.id, req.user.id);
    const filePath = path.join(process.cwd(), config.UPLOAD_DIR, file.storedFilename);
    res.download(filePath, file.originalFilename);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
