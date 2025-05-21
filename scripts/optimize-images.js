#!/usr/bin/env node

/**
 * Image Optimization Script for Home Gym Guides
 * 
 * This script optimizes and generates responsive image sizes for the website.
 * It processes all images in the assets/images directory and creates multiple
 * sized versions for use with srcset.
 * 
 * Usage: node optimize-images.js
 * 
 * Requirements:
 * - sharp: npm install sharp
 * - glob: npm install glob
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

// Configuration
const config = {
  // Source image directories
  inputDirs: ['assets/images', 'assets/posts'],
  // Output directory (relative to each input directory)
  outputDir: '', // Same as input directory
  // Image sizes to generate
  sizes: [320, 480, 640, 800, 1200],
  // Image quality (1-100)
  quality: 80,
  // File types to process
  fileTypes: ['.jpg', '.jpeg', '.png', '.webp'],
  // Skip files that include these strings
  skipIfIncludes: ['icon', 'logo', '-320', '-480', '-640', '-800', '-1200']
};

// Ensure output directory exists
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Process a single image
async function processImage(inputFile) {
  try {
    const dir = path.dirname(inputFile);
    const ext = path.extname(inputFile);
    const baseName = path.basename(inputFile, ext);
    
    // Skip if the file should be excluded
    if (config.skipIfIncludes.some(skipStr => baseName.includes(skipStr))) {
      console.log(`Skipping ${inputFile} - contains excluded string`);
      return;
    }
    
    // Skip SVG files
    if (ext.toLowerCase() === '.svg') {
      console.log(`Skipping ${inputFile} - SVG format`);
      return;
    }
    
    // Process each size
    for (const size of config.sizes) {
      const outputFile = path.join(dir, `${baseName}-${size}${ext}`);
      
      // Skip if output file already exists and is newer than input file
      if (fs.existsSync(outputFile)) {
        const inputStat = fs.statSync(inputFile);
        const outputStat = fs.statSync(outputFile);
        if (outputStat.mtime > inputStat.mtime) {
          console.log(`Skipping ${outputFile} - already up to date`);
          continue;
        }
      }
      
      console.log(`Processing ${inputFile} -> ${outputFile}`);
      
      let transformer = sharp(inputFile).resize(size, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
      
      // Set quality based on file type
      if (ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg') {
        transformer = transformer.jpeg({ quality: config.quality });
      } else if (ext.toLowerCase() === '.png') {
        transformer = transformer.png({ quality: config.quality });
      } else if (ext.toLowerCase() === '.webp') {
        transformer = transformer.webp({ quality: config.quality });
      }
      
      await transformer.toFile(outputFile);
    }
    
    // Also optimize the original file
    const optimizedOriginal = path.join(dir, `${baseName}-optimized${ext}`);
    
    let transformer = sharp(inputFile);
    
    // Set quality based on file type
    if (ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg') {
      transformer = transformer.jpeg({ quality: config.quality });
    } else if (ext.toLowerCase() === '.png') {
      transformer = transformer.png({ quality: config.quality });
    } else if (ext.toLowerCase() === '.webp') {
      transformer = transformer.webp({ quality: config.quality });
    }
    
    await transformer.toFile(optimizedOriginal);
    
    // Replace original with optimized version
    fs.unlinkSync(inputFile);
    fs.renameSync(optimizedOriginal, inputFile);
    
    console.log(`Optimized original: ${inputFile}`);
  } catch (err) {
    console.error(`Error processing ${inputFile}: ${err.message}`);
  }
}

// Process all images in a directory
async function processDirectory(inputDir) {
  ensureDirectoryExists(inputDir);
  
  // Get all image files
  const fileTypePatterns = config.fileTypes.map(type => `**/*${type}`);
  const files = [];
  
  fileTypePatterns.forEach(pattern => {
    const matches = glob.sync(pattern, { cwd: inputDir, absolute: true });
    files.push(...matches);
  });
  
  console.log(`Found ${files.length} images to process in ${inputDir}`);
  
  // Process each file
  for (const file of files) {
    await processImage(file);
  }
}

// Main function
async function main() {
  console.log('Starting image optimization...');
  
  for (const inputDir of config.inputDirs) {
    await processDirectory(inputDir);
  }
  
  console.log('Image optimization complete!');
}

// Execute the main function
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
