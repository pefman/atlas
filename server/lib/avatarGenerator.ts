/**
 * Deterministic Pixel Avatar Generator
 * 
 * Generates 32x32 pixel art avatars from role names using a deterministic algorithm.
 * Same input always produces the same avatar - no API calls needed.
 */

import { deflateSync } from 'zlib';
import { createHash } from 'crypto';

// Real names for avatars
const funnyNames = [
  // Male names
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
  'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan',
  'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
  'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry',
  // Female names
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna',
  'Michelle', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
  'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather'
];

// Gender options
const genders = ['male', 'female'];

// Color palettes for different avatar components
const palettes = {
  background: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42'],
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'],
  hair: ['#2c1b16', '#4a2c1f', '#8b4513', '#d2691e', '#f4a460', '#c0392b', '#e67e22', '#f39c12'],
  clothes: ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22', '#16a085', '#2980b9', '#8e44ad'],
  eyes: ['#2c3e50', '#3498db', '#27ae60', '#8e44ad', '#e74c3c', '#f39c12'],
};

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator
 * Same seed always produces same sequence
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Pick a random item from an array using a seed
 */
function pickFrom<T>(array: T[], seed: number): T {
  const index = Math.floor(seededRandom(seed) * array.length);
  return array[index];
}

/**
 * Check if a pixel is part of the face
 */
function isFacePixel(x: number, y: number): boolean {
  // Face in center 16x20 area
  return x >= 8 && x <= 23 && y >= 6 && y <= 26;
}

/**
 * Check if a pixel is part of the hair
 */
function isHairPixel(x: number, y: number): boolean {
  // Hair on top, slightly wider than face
  return x >= 7 && x <= 24 && y >= 2 && y <= 8;
}

/**
 * Check if a pixel is part of the clothes
 */
function isClothesPixel(x: number, y: number): boolean {
  // Shoulders at bottom
  return x >= 6 && x <= 25 && y >= 24 && y <= 31;
}

/**
 * Check if a pixel is an eye
 */
function isEyePixel(x: number, y: number): boolean {
  // Two small rectangles for eyes
  const leftEye = x >= 12 && x <= 15 && y >= 14 && y <= 17;
  const rightEye = x >= 18 && x <= 21 && y >= 14 && y <= 17;
  return leftEye || rightEye;
}

/**
 * Check if a pixel is a mouth
 */
function isMouthPixel(x: number, y: number): boolean {
  // Small line in lower face area
  return x >= 14 && x <= 19 && y >= 21 && y <= 22;
}

/**
 * Generate a 32x32 pixel art avatar from a role name
 * 
 * @param roleName - The role name to generate avatar for
 * @param options - Optional configuration
 * @param options.gender - 'male' or 'female' (random if not specified)
 * @param options.useFunnyNames - Whether to use funny names (default: true)
 * @returns 32x32 grid of hex color strings
 */
export function generateAvatar(roleName: string, options?: { gender?: 'male' | 'female'; useFunnyNames?: boolean }): string[][] {
  if (!roleName || roleName.trim() === '') {
    roleName = 'avatar';
  }

  const useFunnyNames = options?.useFunnyNames ?? true;
  const seed = hashString(roleName);
  const grid: string[][] = [];

  // Pick gender and name
  const gender = options?.gender ?? pickFrom(genders, seed + 5);
  const displayName = useFunnyNames ? pickFrom(funnyNames, seed + 6) : roleName;

  // Pick colors based on seed
  const bgColor = pickFrom(palettes.background, seed);
  const skinColor = pickFrom(palettes.skin, seed + 1);
  const hairColor = pickFrom(palettes.hair, seed + 2);
  const clothesColor = pickFrom(palettes.clothes, seed + 3);
  const eyeColor = pickFrom(palettes.eyes, seed + 4);

  // Generate grid
  for (let y = 0; y < 32; y++) {
    grid[y] = [];
    for (let x = 0; x < 32; x++) {
      if (isEyePixel(x, y)) {
        grid[y][x] = eyeColor;
      } else if (isMouthPixel(x, y)) {
        grid[y][x] = '#000000';
      } else if (isHairPixel(x, y)) {
        grid[y][x] = hairColor;
      } else if (isFacePixel(x, y)) {
        grid[y][x] = skinColor;
      } else if (isClothesPixel(x, y)) {
        grid[y][x] = clothesColor;
      } else {
        grid[y][x] = bgColor;
      }
    }
  }

  // Add gender-specific features
  if (gender === 'female') {
    addFemaleFeatures(grid, hairColor);
  } else {
    addMaleFeatures(grid, hairColor);
  }

  return grid;
}

/**
 * Add female-specific features (longer hair, etc.)
 */
function addFemaleFeatures(grid: string[][], hairColor: string): void {
  // Longer hair that goes down the sides
  for (let y = 8; y <= 14; y++) {
    if (isFacePixel(7, y) || isFacePixel(24, y)) {
      grid[y][7] = hairColor;
      grid[y][24] = hairColor;
    }
  }
}

/**
 * Add male-specific features (shorter hair, etc.)
 */
function addMaleFeatures(grid: string[][], hairColor: string): void {
  // Shorter hair, no side extensions
  // Already handled by base hair shape
}

/**
 * Get the funny name for a role
 */
export function getFunnyName(roleName: string): string {
  if (!roleName || roleName.trim() === '') {
    return 'Unknown';
  }
  const seed = hashString(roleName);
  return pickFrom(funnyNames, seed + 6);
}

/**
 * Get the gender for a role
 */
export function getGender(roleName: string): 'male' | 'female' {
  if (!roleName || roleName.trim() === '') {
    return 'male';
  }
  const seed = hashString(roleName);
  return pickFrom(genders, seed + 5);
}

/**
 * Convert a 32x32 pixel grid to a base64-encoded PNG
 * 
 * @param grid - 32x32 grid of hex color strings
 * @returns Base64-encoded PNG string
 */
export function renderPixelGridToBase64(grid: string[][]): string {
  const SIZE = 32;
  const rawData: number[] = [];

  for (let y = 0; y < SIZE; y++) {
    rawData.push(0); // Filter byte
    for (let x = 0; x < SIZE; x++) {
      const color = grid[y][x];
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      rawData.push(r, g, b);
    }
  }

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(SIZE, 0);
  ihdrData.writeUInt32BE(SIZE, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 2; // Color type (RGB)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  const rawBuffer = Buffer.from(rawData);
  const compressed = deflateSync(rawBuffer);
  const idat = makeChunk('IDAT', compressed);

  const iend = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdr, idat, iend]);
  return png.toString('base64');
}

/**
 * Create a PNG chunk
 */
function makeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/**
 * CRC32 implementation for PNG chunks
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
