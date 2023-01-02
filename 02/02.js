/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const padding = 50;

let canvas;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "10 minutes");
}

function draw() {
  noFill();
  stroke(255);
  strokeWeight(3);
  let row = 0;
  for (let y = padding; y < height - padding; y += 50) {
    for (let x = padding; x < width - padding; x += 50) {
      const ox = (noise(x * 0.003, y * 0.003) - 0.5) * 100 * row / 20;
      const oy = (noise(x * 0.003, y * 0.003, 200) - 0.5) * 100 * row / 20;
      line(x, y, x + 10 + ox, y + 10 + oy);
    }
    row++;
  }


  noFill();
  stroke(255);
  strokeWeight(1);
  row = 0;
  for (let y = padding; y < height - padding; y += 50) {
    for (let x = padding; x < width - padding; x += 50) {
      const r = (noise(x * 0.003, y * 0.003) - 0.5) * 90 * row / 20;
      circle(x - 20, y + 30, 10 + r);
    }
    row++;
  }

  noLoop();
}
