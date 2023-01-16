/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { hypot, sign } = Math;

const fullRender = !new URLSearchParams(window.location.search).has("full");

const cellSize = 30;

let canvas;

// script parameters
let scriptExpandFactor;
let scriptContractFactor;

// pen parameters
let sloppiness;
let tremor;
let tremorNoiseScale;
let waveAmount;
let waveNoiseScale;

const basePenWidth = 10;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "Asemic");
  noiseDetail(2, 1);

  scriptContractFactor = constrain(randomGaussian(0.7, 0.1), 0.5, 0.9);
  scriptExpandFactor = constrain(randomGaussian(map(scriptContractFactor, 0.5, 0.9, 1.2, 1.0), 0.1), 0.7, 1.5);
  console.log({ scriptExpandFactor, scriptContractFactor });

  sloppiness = constrain(randomGaussian(0.1, 0.05), 0, 1);
  tremor = fullRender ? constrain(randomGaussian(0, 0.3), 0, 1) : 0;
  tremorNoiseScale = max(0, randomGaussian(0.05, 0.05));
  waveAmount = randomGaussian(8, 4);
  waveNoiseScale = max(0, randomGaussian(0.005, 0));
}

function draw() {
  background(255);
  writeLine(width * 1 / 4, height / 6, 30);
  writeLine(width * 2 / 4, height / 6, 40);
  writeLine(width * 3 / 4, height / 6, 20);
  noLoop();
}

function writeLine(startX, startY, strokeCount) {
  let x = 0;
  let y = 0;
  let hx = 0;
  let hy = 0;
  let maxY = 0;

  const pen = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: 0,
  };


  let curStrokeSize = 0;

  push();
  translate(startX, startY);

  noFill();
  stroke(0);
  strokeWeight(6);

  initPen(pen, x, y);

  for (let i = 0; i < strokeCount; i++) {
    if (random() >= sigmoid((curStrokeSize - 3) * 6)) {
      let nx = round(randomGaussian(x, scriptExpandFactor) * scriptContractFactor);
      let ny = y
        + (
          nx === x || sign(hx - x) === sign(nx - x)
            ? 1
            : round(randomGaussian(0.6, 0.2))
        );

      let curviness = randomGaussian(1, 0.8) + randomGaussian(-1, 0.8);
      let ccx = curviness < 0 ? x : nx;
      let ccy = curviness < 0 ? ny : y;
      curviness = sign(curviness) * (abs(curviness) + max(0, curviness - 1) * (fullRender ? 6 : 2));
      const cct = 1 - sigmoid(abs(curviness) * 4 - 16) * 0.6;
      ccx = lerp((x + nx) / 2, ccx, cct);
      ccy = lerp((y + ny) / 2, ccy, cct);

      let c1x = lerp(x, ccx, abs(curviness));
      let c1y = lerp(y, ccy, abs(curviness));
      let c2x = lerp(nx, ccx, abs(curviness));
      let c2y = lerp(ny, ccy, abs(curviness));

      if (fullRender) {
        movePen(
          pen,
          applyWave(c1x * cellSize, c1y * cellSize, 0),
          applyWave(c1x * cellSize, c1y * cellSize, 1),
          applyWave(c2x * cellSize, c2y * cellSize, 0),
          applyWave(c2x * cellSize, c2y * cellSize, 1),
          applyWave(nx * cellSize, ny * cellSize, 0),
          applyWave(nx * cellSize, ny * cellSize, 1),
        );
      } else {
        bezier(
          x * cellSize,
          y * cellSize,
          c1x * cellSize,
          c1y * cellSize,
          c2x * cellSize,
          c2y * cellSize,
          nx * cellSize,
          ny * cellSize
        );
      }

      if (abs(nx) <= 1) maxY = max(maxY, ny - abs(nx));
      if (sign(x) !== sign(nx)) maxY = max(maxY, ny);

      if (curStrokeSize === 0 && random() < 0.1) {
        if (nx <= 0) {
          mark(x + 0.5, y);
        } else {
          mark(x - 0.5, y);
        }
      }

      hx = x;
      hy = y;
      x = nx;
      y = ny;
      curStrokeSize++;
    } else {
      if (i === strokeCount - 1) {
        endPen(pen, x, y);
      }

      if (random() < 0.2) {
        if (sign(x - hx) >= 0) {
          mark(x + 0.5, y);
        } else {
          mark(x - 0.5, y);
        }
      }

      y = maxY + 0.5;
      x = 0;
      hx = x;
      hy = y;
      curStrokeSize = 0;

      initPen(pen, x, y);
    }
  }

  pop();
}

function mark(x, y) {
  if (fullRender) {
    const pen = {};
    initPen(pen, x, y);
    pen.w = basePenWidth * 0.5;
    pen.x -= 2;
    pen.y -= 3;
    movePen(
      pen,
      x * cellSize + randomGaussian(0, 2),
      y * cellSize + randomGaussian(0, 2),
      x * cellSize + randomGaussian(0, 2),
      y * cellSize + randomGaussian(0, 2),
      x * cellSize + 2,
      y * cellSize + 3
    );
  } else {
    circle(x * cellSize, y * cellSize, 0);
  }
}

function applyWave(x, y, dim) {
  return [x, y][dim] + (noise(x * waveNoiseScale, y * waveNoiseScale, dim * 100) * 2 - 1) * waveAmount;
}

function initPen(pen, x, y) {
  pen.x = x * cellSize;
  pen.y = y * cellSize;
  pen.vx = 0;
  pen.vy = 0;
  pen.w = 0;
}

function endPen(pen, x, y) {
  movePen(
    pen,
    x * cellSize,
    y * cellSize + pen.vy * 20,
    x * cellSize + pen.vx * 20,
    y * cellSize + pen.vy * 20,
    x * cellSize + pen.vx * 40,
    y * cellSize - 20 + pen.vy * 40,
    true
  );
}

function movePen(pen, c1x, c1y, c2x, c2y, x, y, endStroke = false) {
  const startX = pen.x;
  const startY = pen.y;
  let targetX = startX;
  let targetY = startY;

  const leash = lerp(4, 8, sloppiness);
  const acc = lerp(0.6, 0.2, sloppiness);
  const friction = lerp(0.2, 0.8, sloppiness);

  let t = 0;
  move: for (let i = 0; i < 1000; i++) {
    while (dist(pen.x, pen.y, targetX, targetY) < leash) {
      t += 0.01;
      if (t >= 1) break move;

      // cubic bezier
      const ax = lerp(startX, c1x, t);
      const ay = lerp(startY, c1y, t);
      const bx = lerp(c2x, x, t);
      const by = lerp(c2y, y, t);
      const cx = lerp(ax, bx, t);
      const cy = lerp(ay, by, t);

      const dx = lerp(ax, cx, t);
      const dy = lerp(ay, cy, t);
      const ex = lerp(cx, bx, t);
      const ey = lerp(cy, by, t);

      targetX = lerp(dx, ex, t);
      targetY = lerp(dy, ey, t);
    }

    pen.vx += (targetX - pen.x) * acc;
    pen.vy += (targetY - pen.y) * acc;
    const dw = endStroke
      ? -pen.w * 0.1
      : (basePenWidth - pen.w) * (1 - acc * 0.5) - hypot(pen.vx, pen.vy) * 0.2;
    const nextW = max(0, pen.w + dw);
    drawPen(pen.x, pen.y, pen.x + pen.vx, pen.y + pen.vy, pen.w, nextW);
    pen.x += pen.vx;
    pen.y += pen.vy;
    pen.vx *= friction;
    pen.vy *= friction;
    pen.w = nextW;
    if (endStroke && pen.w <= 0.5) break;
  }
}

function drawPen(x1, y1, x2, y2, w1, w2) {
  noFill();
  stroke(0);
  strokeWeight(2);

  const step = 1 / dist(x1, y1, x2, y2);

  for (let t = 0; t <= 1; t += step) {
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t);
    const w = lerp(w1, w2, t);

    pointPen(x, y, w);
  }

  pointPen(x2, y2, w2);
}

function pointPen(x, y, width) {
  const tipAngle = -PI / 6 + (noise(x * 0.01, y * 0.01) * 2 - 1) * PI / 18;
  const dx = width * 0.5 * sin(tipAngle);
  const dy = width * 0.5 * cos(tipAngle);
  const sx = (noise(x * tremorNoiseScale, y * tremorNoiseScale, 150) * 2 - 1) * tremor;
  const sy = (noise(x * tremorNoiseScale, y * tremorNoiseScale, 250) * 2 - 1) * tremor;
  const px = x + sx;
  const py = y + sy;
  line(px - dx, py - dy, px + dx, py + dy);
}

// dot product
function dot(x1, y1, x2, y2) {
  return x1 * x2 + y1 * y2;
}

function sigmoid(x) {
  return 1 / (1 + exp(-x));
}