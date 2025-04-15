const sharp = require('sharp');
const https = require('https');
const fs = require('fs');
const path = require('path');

const FAVICON_URL = 'https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/other//favicon.png';
const OUTPUT_DIR = path.join(__dirname, 'public', 'images');
const SIZES = [16, 32, 64, 128, 192, 256, 512];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Download the image
const downloadImage = () => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(OUTPUT_DIR, 'favicon-original.png');
    const file = fs.createWriteStream(outputPath);
    
    https.get(FAVICON_URL, response => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded original favicon to ${outputPath}`);
        resolve(outputPath);
      });
    }).on('error', err => {
      fs.unlink(outputPath, () => {}); // Delete the file if there's an error
      reject(err);
    });
  });
};

// Resize the image to various sizes
const resizeImage = async (inputPath) => {
  try {
    for (const size of SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `favicon-${size}x${size}.png`);
      
      await sharp(inputPath)
        .resize(size, size, { 
          fit: 'contain',
          // Use nearest neighbor for pixel art to keep sharp edges
          kernel: 'nearest'
        })
        .toFile(outputPath);
      
      console.log(`Created ${size}x${size} favicon at ${outputPath}`);
    }
    console.log('All resizing complete!');
  } catch (error) {
    console.error('Error resizing images:', error);
  }
};

// Run the script
(async () => {
  try {
    const originalPath = await downloadImage();
    await resizeImage(originalPath);
  } catch (error) {
    console.error('Error in resize script:', error);
  }
})(); 