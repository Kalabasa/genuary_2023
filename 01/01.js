/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const fullRender = new URLSearchParams(window.location.search).has("full");

const LOOP_LENGTH = 180;

let canvas;
let noiseScale;
let colors;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "Loop", { video: true });
  noiseDetail(2, 1);
  noiseScale = 1 / random(6e2, 8e2);
  colors = chroma.scale(["#c88", "#888"]).gamma(0.01).correctLightness().colors(8);
}

function draw() {
  console.log(`${frameCount}/${LOOP_LENGTH}`);
  const clock = 2 * PI * frameCount / LOOP_LENGTH

  noStroke();

  fill(255);
  rect(0, 0, width, height);

  let i = 0;
  const hillHeight = 350;
  for (let y = 0; y < height + hillHeight; y += 80) {
    for (let x = 0; x < width; x++) {
      const n = hillHeight * abs(
        noise(x * noiseScale, (y + 600 * cos(clock + PI / 2)) * noiseScale, sin(clock))
        + noise(x * noiseScale, (y + 600 * sin(clock + PI / 2)) * noiseScale, 200 + cos(clock))
        - 1
      );

      fill(colors[i % colors.length]);
      rect(x, y - n, 1, 4);
      fill(255);
      rect(x, y - n + 4, 1, height);
    }
    i++;
  }

  if (frameCount >= LOOP_LENGTH) {
    noLoop();
    reportDone();
  }
}
