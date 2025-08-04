// File: src/middleware/multer.js

const multer = require('multer');
const path  = require('path');
const fs    = require('fs');

// —————————————————————————————————
// 1) Your existing "applications" uploader (the default)
const appStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../uploads/applications');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ts = Date.now();
    cb(null, `${file.fieldname}-${ts}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage: appStorage,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5 MB max
});

// —————————————————————————————————
// 2) Your new "profile pictures" uploader
const profileStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../uploads/profilepictures');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ts = Date.now();
    // assumes req.user.id is set by your auth middleware
    cb(null, `avatar-${req.user.id}-${ts}${path.extname(file.originalname)}`);
  }
});
const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }  // 2 MB max
});

// —————————————————————————————————
// 3) Your new "attachments" uploader
const attachmentsStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../uploads/attachments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const uploadAttachments = multer({
  storage: attachmentsStorage,
  limits: { fileSize: 20 * 1024 * 1024 }  // up to 20 MB
});

// —————————————————————————————————
// 4) Attach the extra uploaders as properties on the default export
upload.profile     = uploadProfile;
upload.attachments = uploadAttachments;

// 5) Export the "applications" uploader (with .profile and .attachments attached)
module.exports = upload;
