const fs = require('fs');
const path = require('path');

/**
 * Utility to fix legacy filenames that have URL-encoded characters
 * This script will rename files to have proper, clean filenames
 */

const sanitizeFilename = (filename) => {
  // Get name and extension
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  
  // Decode any URL encoding first
  let decodedName = name;
  try {
    decodedName = decodeURIComponent(name);
  } catch (e) {
    // If decode fails, use original
    decodedName = name;
  }
  
  // Sanitize: remove special chars and replace spaces with hyphens
  const sanitizedName = decodedName
    .replace(/[^\w\s-]/g, '')  // Remove special chars except word chars, spaces, hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .toLowerCase();            // Convert to lowercase
  
  return sanitizedName + ext;
};

const fixUploadedFiles = (uploadsDir = 'uploads') => {
  console.log('🔧 Fixing legacy filenames...\n');
  
  const folders = ['manuals', 'drawings', 'general'];
  let totalFixed = 0;
  
  folders.forEach(folder => {
    const folderPath = path.join(uploadsDir, folder);
    
    // Check if folder exists
    if (!fs.existsSync(folderPath)) {
      console.log(`⏭️  Skipping ${folder}/ (doesn't exist)`);
      return;
    }
    
    const files = fs.readdirSync(folderPath);
    console.log(`\n📁 Processing ${folder}/ (${files.length} files)`);
    
    files.forEach(file => {
      const oldPath = path.join(folderPath, file);
      const newFilename = sanitizeFilename(file);
      const newPath = path.join(folderPath, newFilename);
      
      // Skip if filename is already clean
      if (file === newFilename) {
        console.log(`  ✓ ${file} (already clean)`);
        return;
      }
      
      // Check if target filename already exists
      if (fs.existsSync(newPath)) {
        console.log(`  ⚠️  ${file} -> ${newFilename} (target exists, skipping)`);
        return;
      }
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`  ✅ ${file}`);
        console.log(`     -> ${newFilename}`);
        totalFixed++;
      } catch (error) {
        console.log(`  ❌ Failed to rename ${file}: ${error.message}`);
      }
    });
  });
  
  console.log(`\n✨ Done! Fixed ${totalFixed} files.`);
};

// Run the script
if (require.main === module) {
  fixUploadedFiles();
}

module.exports = { fixUploadedFiles, sanitizeFilename };
