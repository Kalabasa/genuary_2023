/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const charMap = [
  ' ', '`', "'", '^',
  ',', ')', '/', 'F',
  '.', '\\', '(', '?',
  '-', '&', 'J', '#',
];

const aspectRatio = 1.67;
const width = Math.round(30 * aspectRatio) * 2;
const height = 30 * 2;
const matrix = Array.from({ length: height }).map(() => Array.from({ length: width }).map(() => 0));

const halfWidth = width / 2;
const halfHeight = height / 2;

let started = !(new URLSearchParams(window.location.search).has("wait"));

let noiseScale;
let noiseAnimScale;
let noiseSwirlX;
let fuzz;
let texY;

function setup() {
  commonSetup(createCanvas(1, 1), "Debug view");
  frameRate(8);
  noiseDetail(2, 1);
  fuzz = constrain(randomGaussian(0.2, 0.1), 0, 1);
  noiseScale = constrain(randomGaussian(0.03, 0.002), 0.01, 0.2);
  noiseAnimScale = constrain(randomGaussian(0, max(0, fuzz * 0.2 - 0.006 / noiseScale)), 0, 0.1);
  noiseSwirlX = constrain(randomGaussian(1, 0.5) ** 16, 0, 0.02 / noiseScale);
  texY = constrain(randomGaussian(0.25, 0.5), 0, 0.75);
}

function start() {
  started = true;
  return "Let's go!";
}

function draw() {
  if (!started) return;

  const rot = frameCount * 5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = sqrt((x - halfWidth) ** 2 + ((y - halfHeight) * aspectRatio) ** 2);
      const rs = (r / halfWidth) ** 4;
      const sy = y + (y - halfHeight) * rs;
      const ax = x + rot + cos(sy / height * 2 * PI + noiseSwirlX * 333 + noise(x * noiseScale, 0)) * noiseSwirlX * 100;
      const sx = ax + (x - halfWidth) * rs;
      const nv = 0.5 * (
        noise(sx * noiseScale, sy * aspectRatio * noiseScale, frameCount * noiseAnimScale)
        + noise(sx * noiseScale, sy * aspectRatio * noiseScale, frameCount * noiseAnimScale + 0.5)
      );
      const v = nv * constrain((halfWidth - r) * 0.12, 0, 1);

      const tex =
        noise(x, (10 + y * 2) + y)
        - 0.5
        + (1 + cos(sy * aspectRatio * PI + texY * 333)) * 0.5 * texY;

      matrix[y][x] = constrain(0.5 + tex * fuzz, 0, 1) < v ? 1 : 0;
    }
  }

  let image = (frameCount % 2 === 0 ? "" : " ") + "\n%c";
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const b0 = matrix[y][x];
      const b1 = matrix[y][x + 1];
      const b2 = matrix[y + 1][x];
      const b3 = matrix[y + 1][x + 2];
      const charIndex = (b0 & 1) | ((b1 << 1) & 2) | ((b2 << 2) & 4) | ((b3 << 3) & 8);
      const char = charMap[charIndex];
      image += char;
    }
    image += "\n";
  }
  console.log(image, "font-weight: bold; text-shadow: 0 0 0.2em currentColor, 0 -0.2em 0.8em currentColor");
}