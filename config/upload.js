const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    // Determine upload path based on file type
    if (req.path.includes('manual')) {
      uploadPath += 'manuals/';
    } else if (req.path.includes('edrawings')) {
      uploadPath += 'drawings/';
    } else {
      uploadPath += 'general/';
    }
    
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    // Sanitize filename: remove special characters and replace spaces with hyphens
    const sanitizedName = name
      .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
      .toLowerCase();           // Convert to lowercase for consistency
    
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'manuals': ['.pdf', '.doc', '.docx'],
    'drawings': ['.dwg', '.dxf', '.pdf', '.jpg', '.jpeg', '.png'],
    'general': ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt']
  };
  
  const ext = path.extname(file.originalname).toLowerCase();
  let allowedExtensions = allowedTypes.general;
  
  if (req.path.includes('manual')) {
    allowedExtensions = allowedTypes.manuals;
  } else if (req.path.includes('edrawings')) {
    allowedExtensions = allowedTypes.drawings;
  }
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size exceeds the maximum limit'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Number of files exceeds the maximum limit'
      });
    }
  }
  
  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: err.message
    });
  }
  
  next(err);
};

module.exports = {
  upload,
  handleMulterError,
  createUploadDir
};