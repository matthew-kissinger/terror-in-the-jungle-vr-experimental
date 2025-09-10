#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../public/assets');
const BACKUP_DIR = path.join(__dirname, '../public/assets/original');

const TEXTURE_CONFIGS = {
  // Terrain textures - need to tile well
  forestfloor: { width: 512, height: 512, quality: 85 },
  
  // Vegetation - can be smaller since they're billboards
  grass: { width: 256, height: 256, quality: 90 },
  tree: { width: 512, height: 512, quality: 90 },
  mushroom: { width: 256, height: 256, quality: 90 },
  
  // Enemies - medium size for detail
  imp: { width: 512, height: 512, quality: 90 },
  attacker: { width: 512, height: 512, quality: 90 },
  
  // Skybox - can be larger but compressed
  skybox: { width: 1024, height: 1024, quality: 85 }
};

async function compressTextures() {
  console.log('🎨 Starting texture compression...\n');
  
  // Create backup directory
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  
  // Get all PNG files
  const files = await fs.readdir(ASSETS_DIR);
  const pngFiles = files.filter(file => file.endsWith('.png'));
  
  for (const file of pngFiles) {
    const basename = path.basename(file, '.png');
    const inputPath = path.join(ASSETS_DIR, file);
    const backupPath = path.join(BACKUP_DIR, file);
    
    try {
      // Get original file size
      const originalStats = await fs.stat(inputPath);
      const originalSize = (originalStats.size / 1024 / 1024).toFixed(2);
      
      // Backup original file
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      if (!backupExists) {
        console.log(`📦 Backing up ${file} to original/`);
        await fs.copyFile(inputPath, backupPath);
      }
      
      // Get config or use defaults
      const config = TEXTURE_CONFIGS[basename] || { width: 512, height: 512, quality: 85 };
      
      // Process image
      console.log(`\n🔨 Processing ${file}:`);
      console.log(`   Original size: ${originalSize} MB`);
      
      await sharp(inputPath)
        .resize(config.width, config.height, {
          kernel: sharp.kernel.nearest, // Preserve pixel art style
          fit: 'cover'
        })
        .png({
          quality: config.quality,
          compressionLevel: 9,
          palette: true, // Use palette-based compression for pixel art
          colors: 256    // Limit colors for better compression
        })
        .toFile(inputPath + '.tmp');
      
      // Replace original with compressed
      await fs.rename(inputPath + '.tmp', inputPath);
      
      // Get new file size
      const newStats = await fs.stat(inputPath);
      const newSize = (newStats.size / 1024 / 1024).toFixed(2);
      const reduction = ((1 - newStats.size / originalStats.size) * 100).toFixed(1);
      
      console.log(`   New size: ${newSize} MB (${config.width}x${config.height})`);
      console.log(`   ✅ Reduced by ${reduction}%`);
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log('\n✨ Texture compression complete!');
  console.log('Original files backed up to public/assets/original/');
}

// Run compression
compressTextures().catch(console.error);