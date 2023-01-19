/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { sign } = Math;

const record = new URLSearchParams(window.location.search).has("r");

let canvas;

let grid = [];
const gridWidth = 9;
let gridHeight;
let rowOffset = 0;
let globalRowOffset = 0;
let cellSize;

function setup() {
  setupFrameRate(16);
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "Art Deco", { video: record });
  noiseDetail(2, 1);

  // half width because output is mirrored
  cellSize = (width / 2) / gridWidth;
  gridHeight = ceil(height / cellSize);
}

function draw() { 
  resetMatrix();
  translate(
    (noise(frameCount * 0.04, 100) * 2 - 1) * 12,
    (noise(frameCount * 0.12) * 2 - 1) * 12
  );

  const intRowOffset = floor(rowOffset);
  while (grid.length <= intRowOffset + 1) {
    grid[grid.length] = Array.from({ length: gridWidth })
      .map((_, i) => {
        let row = globalRowOffset + grid.length;
        if (i > row) return null;
        if (i === gridWidth - 1) return { dx: 0, dy: 1 };
        if (i === row) return { dx: 1, dy: 1 };

        const intro = i >= row - 1;

        let mirrorRow = row;
        const mirrorSpan = floor(lerp(15, 25, noise(row * 0.001)));
        for (let k = row - 1; k >= row - mirrorSpan; k--) {
          const mn = noise(k * 0.1);
          const lmn = noise((k + 1) * 0.1);
          if (mn < 0.4 && lmn >= 0.4) {
            mirrorRow = k;
          }
        }

        const mirror = mirrorRow < row;
        if (mirror) {
          row = row - (row - mirrorRow - 0.5) * 2;
        }

        const nexp = lerp(0, 1, noise(row * 0.02));
        const weight = noise(row * 0.03);
        const nsx = (row - i) * lerp(0, 0.1, weight) ** 0.5;
        const nsy = (row + i) * lerp(0, 0.1, 1 - weight) ** 0.5;
        const nx = noise(nsx, nsy);
        const ny = noise(nsx, nsy, 100);

        let nv1w = nx * 3 - 1;
        nv1w = sign(nv1w) * abs(nv1w) ** nexp;

        let dx = constrain(round(nv1w), -1, 1);
        let dy = dx === 0
          ? round(ny) * 2 - 1
          : constrain(round(ny), 0, 1);

        if (mirror) dy = -dy;

        if (intro) dy = 1;
        if (i === gridWidth - 2) {
          dy = 1;
          if (random() < 0.8) dx = 0;
        }

        return { dx, dy };
      });
  }

  blendMode(BLEND);
  background("#140c07cc");
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i];
    for (let j = 0; j < gridWidth; j++) {
      const cell = row[j];
      if (cell) {
        const { dx, dy } = cell;
        const x = j * cellSize;
        const y = height + ((i - rowOffset) * cellSize);
        noFill();
        stroke("#f2c25a");
        strokeWeight(3);
        strokeCap(SQUARE);
        line(width / 2 + x, y, width / 2 + x + dx * cellSize, y + dy * cellSize);
        line(width / 2 - x, y, width / 2 - x - dx * cellSize, y + dy * cellSize);
      }
    }
  }

  if (grid.length > gridHeight * 1.2) {
    const cullLength = floor(gridHeight * 0.2);
    grid = grid.slice(cullLength);
    rowOffset -= cullLength;
    globalRowOffset += cullLength;
  }

  rowOffset += 0.3;

  if (record) {
    if (frameCount > 1 + frameRate() * 50) {
      noLoop();
      reportDone();
    }
  }
}
