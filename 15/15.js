/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const LOOP_LENGTH = 300;

let canvas;

let fx, fy, fvx, fvy;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Sine", { video: true });
  fx = randomGaussian(0, width / 6);
  fy = randomGaussian(0, height / 6);
  fvx = randomGaussian(0, 18);
  fvy = (random() * 2 - 1) * 6;
}

function draw() {
  background(0);

  noFill();
  stroke(255);
  strokeWeight(2);

  translate(width / 2, height / 2);
  const maxR = Math.hypot(width / 2, height / 2);

  fvx += -fx * 0.01;
  fvy += -fy * 0.01;
  fvx += randomGaussian(0, 1);
  fvy += randomGaussian(0, 1);
  fx += fvx;
  fy += fvy;
  const fric = sigmoid(8 + (maxR - Math.hypot(fx, fy) * 2) / maxR);
  fvx *= fric;
  fvy *= fric;

  beginShape();
  let a = frameCount * 0.002;
  let r = 0;
  let d = 0;
  while (true) {
    const da = 2 / (1 + r);
    r += da * 4;
    a += da;
    d += da * r;
    const ex = r * sin(a);
    const ey = r * cos(a);
    const df = dist(ex, ey, fx, fy);
    const amp = 8 * sigmoid(1000 / (1 + df) - 4);
    const lr = r + sin(d * 6) * amp;
    const x = lr * sin(a);
    const y = lr * cos(a);
    vertex(x, y);
    if (r > maxR + 20) break;
  }
  endShape();

  if (frameCount >= LOOP_LENGTH) {
    noLoop();
    reportDone();
  }
}

function sigmoid(x) {
  return 1 / (1 + exp(-x));
}