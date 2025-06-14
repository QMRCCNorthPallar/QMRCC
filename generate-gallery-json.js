const fs = require('fs');
const path = require('path');

const galleryDir = path.join(__dirname, 'images', 'gallery');
const outputFile = path.join(galleryDir, 'gallery.json');
const supportedExtensions = /\.(jpe?g|png|gif|webp)$/i;

fs.readdir(galleryDir, (err, files) => {
  if (err) {
    console.error('Error reading gallery directory:', err);
    process.exit(1);
  }
  const images = files.filter(file => supportedExtensions.test(file));
  fs.writeFile(outputFile, JSON.stringify(images, null, 2), err => {
    if (err) {
      console.error('Error writing gallery.json:', err);
      process.exit(1);
    }
    console.log(`gallery.json updated with ${images.length} images.`);
  });
});