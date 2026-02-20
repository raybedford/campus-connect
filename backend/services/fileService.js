const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const FileAttachment = require('../models/FileAttachment');
const Message = require('../models/Message');

const uploadFile = async (messageId, originalFilename, storedFilename, fileSizeBytes, mimeType, totalRecipients) => {
  const file = new FileAttachment({
    message: messageId,
    originalFilename,
    storedFilename,
    fileSizeBytes,
    mimeType,
    totalRecipients
  });

  return file.save();
};

const getDownload = async (fileId, userId) => {
  const file = await FileAttachment.findById(fileId);
  if (!file || file.isDeleted) throw new Error('File not found');

  // Check if already downloaded by this user
  const alreadyDownloaded = file.downloads.some(d => d.user.toString() === userId);
  if (!alreadyDownloaded) {
    file.downloads.push({ user: userId });
    await file.save();
  }

  // Auto-delete logic: check if all recipients have downloaded
  if (file.downloads.length >= file.totalRecipients) {
    await deleteFile(file);
  }

  return file;
};

const deleteFile = async (file) => {
  const filePath = path.join(process.cwd(), config.UPLOAD_DIR, file.storedFilename);
  try {
    await fs.unlink(filePath);
    file.isDeleted = true;
    await file.save();
    console.log(`Deleted file: ${file.storedFilename}`);
  } catch (err) {
    console.error(`Error deleting file ${file.storedFilename}:`, err);
  }
};

const cleanupOldFiles = async () => {
  const maxAgeMs = config.FILE_MAX_AGE_HOURS * 3600000;
  const threshold = new Date(Date.now() - maxAgeMs);

  const expiredFiles = await FileAttachment.find({
    createdAt: { $lt: threshold },
    isDeleted: false
  });

  for (const file of expiredFiles) {
    await deleteFile(file);
  }

  return expiredFiles.length;
};

module.exports = {
  uploadFile,
  getDownload,
  cleanupOldFiles
};
