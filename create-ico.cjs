const fs = require('fs');
const path = require('path');

const srcPng = 'C:\\Users\\jrussell\\.gemini\\antigravity-ide\\brain\\f4a2d488-7b1e-49fe-9d77-b43745da5730\\media__1782116733674.png';
const destPng = path.join(__dirname, 'icon.png');
const destIco = path.join(__dirname, 'icon.ico');

console.log('1. Copying PNG...');
try {
  fs.copyFileSync(srcPng, destPng);
  console.log(`Copied icon PNG to: ${destPng}`);
} catch (err) {
  console.error('Failed to copy source PNG:', err.message);
  process.exit(1);
}

console.log('2. Converting PNG to ICO...');
try {
  const pngBuffer = fs.readFileSync(destPng);
  const pngSize = pngBuffer.length;

  // Create 22-byte ICO header
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0);     // Reserved
  icoHeader.writeUInt16LE(1, 2);     // Type: Icon
  icoHeader.writeUInt16LE(1, 4);     // Image count: 1

  icoHeader.writeUInt8(0, 6);        // Width (0 means 256)
  icoHeader.writeUInt8(0, 7);        // Height (0 means 256)
  icoHeader.writeUInt8(0, 8);        // Color count: 0 (no palette)
  icoHeader.writeUInt8(0, 9);        // Reserved
  icoHeader.writeUInt16LE(1, 10);    // Color planes: 1
  icoHeader.writeUInt16LE(32, 12);   // Bits per pixel: 32

  icoHeader.writeUInt32LE(pngSize, 14); // Size of PNG data
  icoHeader.writeUInt32LE(22, 18);      // Offset to PNG data (22)

  // Combine header and PNG data
  const icoBuffer = Buffer.concat([icoHeader, pngBuffer]);
  fs.writeFileSync(destIco, icoBuffer);
  console.log(`Successfully generated ICO file at: ${destIco}`);
} catch (err) {
  console.error('Failed to generate ICO:', err.message);
  process.exit(1);
}
