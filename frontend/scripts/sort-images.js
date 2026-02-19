const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const root = process.cwd();
const assetsDir = path.join(root, 'assets', 'images');

const folders = ['chef','blog','gallery','dish','brands','misc'];
folders.forEach(f => {
  const p = path.join(assetsDir, f);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const exts = ['.jpg','.jpeg','.png','.gif','.webp','.svg','.avif'];

function isImage(name) {
  return exts.includes(path.extname(name).toLowerCase());
}

const files = fs.readdirSync(root).filter(f => {
  const full = path.join(root, f);
  return fs.existsSync(full) && fs.statSync(full).isFile() && isImage(f);
});

if (files.length === 0) {
  console.log('No image files found in project root.');
  process.exit(0);
}

files.forEach(file => {
  const lower = file.toLowerCase();
  let target = 'misc';

  if (/faizul|chef|headshot|cook/.test(lower)) {
    target = 'chef';
  } else if (/^blog|blog-|blog_|article|post/.test(lower)) {
    target = 'blog';
  } else if (/gallery|gallery-|gallery_/.test(lower)) {
    target = 'gallery';
  } else if (/brand|brands|partner|logo|company/.test(lower)) {
    target = 'brands';
  } else if (/dish|food|biryani|chicken|pancake|omelette|paratha|butter|tandoori|curry|mutton|rogan|sushi|burger|pizza/.test(lower)) {
    target = 'dish';
  } else {
    try {
      const dims = sizeOf(path.join(root, file));
      if (dims && dims.width >= 1000) target = 'gallery';
      else if (dims && dims.width <= 600) target = 'dish';
      else target = 'gallery';
    } catch (e) {
      target = 'misc';
    }
  }

  const destFolder = path.join(assetsDir, target);
  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

  const parsed = path.parse(file);
  let baseName = parsed.name.replace(/\s+/g, '_');
  const ext = parsed.ext || '';
  let destName = baseName + ext;
  let destPath = path.join(destFolder, destName);
  let i = 1;
  while (fs.existsSync(destPath)) {
    destName = `${baseName}-${i}${ext}`;
    destPath = path.join(destFolder, destName);
    i++;
  }

  try {
    fs.renameSync(path.join(root, file), destPath);
    console.log(`Moved ${file} -> ${path.relative(root, destPath)}`);
  } catch (err) {
    console.error(`Failed to move ${file}: ${err.message}`);
  }
});

console.log('Done.');
