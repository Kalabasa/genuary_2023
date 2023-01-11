/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { log1p, tanh } = Math;

const fullRender = new URLSearchParams(window.location.search).has("full");

const LOOP_LENGTH = 180;

let canvas;
let gradient;
let palette;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(fullRender ? 1080 : 108, fullRender ? 1080 : 108);
  canvas.elt.style.width = canvas.elt.style.height = "1080px";
  commonSetup(canvas, "Signed distance functions", { video: true });
  noiseDetail(2, 1);
  noiseScale = 1 / random(6e2, 8e2);
  gradient = chroma.scale([
    "#FF75A0",
    "#FCE38A",
    "#EAFFD0",
    "#95E1D3",
    "#FF75A0",
  ], "lab");
  palette = chroma.scale(gradient.colors(10)).padding([0.2, 0]).classes(8);
}

function draw() {
  console.log(`${frameCount}/${LOOP_LENGTH}`);

  noStroke();

  fill(255);
  rect(0, 0, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      const v =
        + f1(nx, ny)
        + f2(nx, ny)
        + f3(nx, ny)
        + f4(nx, ny)
        - frameCount / LOOP_LENGTH;
      const t = (v + 100) % 1;
      fill((((x + y) & 16) === 0 ? gradient : palette)(t).hex());
      rect(x, y, 1, 1);
    }
  }

  if (frameCount >= LOOP_LENGTH * 3) {
    noLoop();
    reportDone();
  }
}

function f1(x, y) {
  return (1 + sin(clock() * 2) * 0.5) * softplus(sqrt(
    (0.5 + sin(clock()) * 0.2 - x) ** 2
    + (0.5 + cos(clock()) * 0.2 - y) ** 2
  ));
}

function f2(x, y) {
  return -2 * softplus(sqrt(
    (0.5 - x) ** 2
    + (0.5 - y) ** 2
  ));
}

function f3(x, y) {
  return (0.1 + cos(clock() * 3) * 0.05) * sigmoid(sin(clock() * -3 + x * 12) * cos(clock() * 2 + y * 12));
}

function f4(x, y) {
  return 1 * softplus(
    (0.5 - x) ** 2
    + (1 - y) ** 2
  );
}

function sigmoid(x) {
  return tanh(x);
}

function softplus(x) {
  return log1p(exp(x * 16 - 4)) / 12;
}

function clock() {
  return 2 * PI * frameCount / LOOP_LENGTH;
}