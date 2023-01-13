/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { E, hypot, log1p, sign } = Math;

const debugWater = new URLSearchParams(window.location.search).has("dw");
const fullRender = debugWater || new URLSearchParams(window.location.search).has("full");

let canvas;
let dryPaintGraphics;
let paintGraphics;
let waterGraphics;
let flowGraphics;
let simGraphics;
let simShader;
let postGraphics;
let postShader;

const delayedFrameCallbacks = [];
let settleCountdown = 50;

function preload() {
  simShader = loadShader("shader.vert", "sim.frag");
  postShader = loadShader("shader.vert", "post.frag");
}

function setup() {
  pixelDensity(1);
  frameRate(30);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "Suprematism");
  dryPaintGraphics = createGraphics(width, height);
  paintGraphics = createGraphics(width, height);
  waterGraphics = createGraphics(width, height);
  flowGraphics = createGraphics(width, height);
  simGraphics = createGraphics(width, height, WEBGL);
  postGraphics = createGraphics(width, height, WEBGL);

  simGraphics.shader(simShader);
  postGraphics.shader(postShader);

  waterGraphics.background(0);

  noiseDetail(3, 2 / 3);
  flowGraphics.background(0);
  flowGraphics.noStroke();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const texAngle = random(2 * PI);
      const texX = cos(texAngle) * x;
      const texY = sin(texAngle) * y;
      const texture = (0.2 + 0.6 * abs(sin(texX * 0.4)) + 0.2 * abs(sin(texY * 0.4)));
      const nv = max(0, 96 - 88 * noise(x * 0.02, y * 0.02)) * texture;
      flowGraphics.fill(nv);
      flowGraphics.rect(x, y, 1, 1);
    }
  }
}

function draw() {
  let done = false;

  if (frameCount === 1) {
    drawShapes();
  } else if (delayedFrameCallbacks.length === 0) {
    if (settleCountdown-- <= 0) {
      dry();
      done = true;
    }
  }

  processDelayedFrameCallbacks();

  if (fullRender) {
    simulate(waterGraphics, flowGraphics, 12);

    waterGraphics.push()
    waterGraphics.reset();
    // exponential evaporation (drier parts evaporate quicker)
    waterGraphics.blendMode(BURN);
    waterGraphics.fill(251, 255);
    waterGraphics.rect(0, 0, width, height);
    // constant evaporation
    waterGraphics.blendMode(BLEND);
    waterGraphics.fill(0, 4);
    waterGraphics.rect(0, 0, width, height);
    waterGraphics.pop();

    simulate(paintGraphics, waterGraphics, 18);
  }

  if (debugWater) {
    background(0);
    image(waterGraphics, 0, 0);
  } else {
    background(255);
    image(dryPaintGraphics, 0, 0);
    image(paintGraphics, 0, 0);
  }

  console.log(frameCount);
  if (done) {
    if (fullRender) {
      // canvas color
      blendMode(MULTIPLY);
      noStroke();
      fill("#e3d5b388");
      rect(0, 0, width, height);

      // noise overlay
      blendMode(OVERLAY);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          fill(randomGaussian(128, 13));
          rect(x, y, 1, 1);
        }
      }
    }

    noLoop();
    reportDone();
  }
}

async function drawShapes() {
  const palette = chroma.scale([
    "#000",
    "#f00",
    "#fc0",
  ], "lch")
    .classes(max(1, floor(randomGaussian(5, 1))));

  const turn = randomGaussian(PI / 6, PI / 8) * (round(random()) * 2 - 1);
  const count = max(2, floor(randomGaussian(4, 2)));
  const span = height / 8 + height / 4 * sigmoid(count * 2 - 3);
  for (let i = 0; i < count; i++) {
    const t = getSequenceT(i, count);

    const cx = width / 2;
    const cy = lerp((height - span) / 2, (height + span) / 2, t);
    const h = span / max(1, count - 1) * max(0.1, randomGaussian(lerp(0.6, 0.2, t), 0.1));
    const w = h * max(1, randomGaussian(0.8 * span / h, 1));
    const r = lerp(turn * 0.1, turn, t);
    watercolor().push()
      .translate(cx, cy)
      .rotate(r)
      .translate(randomGaussian(turn * t * 100, 100), 0);
    const c = palette(random() ** 2).hex();
    await drawRect(-w / 2, -h / 2, w, h, c);
    await drawRect(-w / 2, -h / 2, w, h, c);
    await delayFrames(40);
    watercolor().pop();
    dry();
  }
}

async function drawRect(x, y, w, h, color) {
  let wc = watercolor(chroma(color).alpha(0.1).hex(), 64).noStroke().fill();

  // fill
  let slope = random(0.5, 1 / 0.5);
  const padding = 5;
  const step = 10;
  const stepSd = 5;
  let px = x + padding;
  let py = y + padding;
  let qx, qy;
  let dir = 1;
  while (true) {
    const curStepSize = max(0, randomGaussian(step, stepSd));
    if (dir > 0) {
      const topIntercept = px + (py - (y + padding)) / slope;
      if (topIntercept < x + w - padding) {
        qx = topIntercept + curStepSize;
        qy = y + padding;
      } else {
        const rightIntercept = py + (px - (x + w - padding)) * slope;
        if (rightIntercept > y + h - padding) break;
        qx = x + w - padding;
        qy = rightIntercept + curStepSize;
      }
      dir = -dir;
    } else {
      const bottomIntercept = px + (py - (y + h - padding)) / slope;
      if (bottomIntercept >= x + w - padding) break;
      if (bottomIntercept >= x + padding) {
        qx = bottomIntercept + curStepSize;
        qy = y + h - padding;
      } else {
        const leftIntercept = py + (px - (x + padding)) * slope;
        qx = x + padding;
        qy = leftIntercept + curStepSize;
      }
      dir = -dir;
    }
    await drawLine(wc, px, py, qx, qy, 15, 8);
    px = qx;
    py = qy;
    slope *= random(0.94, 1.06);
    slope = constrain(slope, 0.02, 1 / 0.02);
  }

  // outline
  wc = watercolor(chroma(color).alpha(0.06).hex(), 48).noStroke().fill();
  await drawLine(wc, x, y, x + w, y, 10, 5);
  await drawLine(wc, x + w, y, x + w, y + h, 10, 5);
  await drawLine(wc, x + w, y + h, x, y + h, 10, 5);
  await drawLine(wc, x, y + h, x, y, 10, 5);

  // blur (apply colorless water)
  wc = watercolor("#8880", 16).noStroke().fill();
  wc.rect(x + 10, y + 10, w - 10 * 2, h - 10 * 2);
}

async function drawLine(wc, x1, y1, x2, y2, width, step) {
  const dis = dist(x1, y1, x2, y2);
  if (dis > 0) {
    const ts = step / dis;
    let speed = 0;
    for (let t = 0; t < 1; t += ts) {
      wc.circle(
        randomGaussian(lerp(x1, x2, t), 0.4),
        randomGaussian(lerp(y1, y2, t), 0.4),
        width,
      );
      speed += step;
      speed = await delayForSpeed(speed);
    }
  }
  wc.circle(
    randomGaussian(x2, 0.4),
    randomGaussian(y2, 0.4),
    width,
  );
  await delayFrames(1);
}

async function delayForSpeed(speed) {
  const unitsPerFrame = 100;
  const frames = floor(speed / unitsPerFrame);
  if (frames > 0) await delayFrames(frames);
  return speed - frames * unitsPerFrame;
}

/**
 * @returns {p5.Graphics & {applyWetness: Function}}
 */
function watercolor(color, wetness) {
  const prep = [
    () => waterGraphics.blendMode(LIGHTEST),
  ];
  const api = new Proxy(Object.create(null), {
    get(target, prop, receiver) {
      if (prop === "applyWetness") {
        return (applyWetness) => {
          wetness = applyWetness(wetness);
          return api;
        };
      }

      if (prop === "fill" || prop === "stroke") {
        return () => {
          prep.push(() => {
            paintGraphics[prop](color);
            waterGraphics[prop](wetness);
          });
          return api;
        };
      }

      if (typeof paintGraphics[prop] !== "function") return;

      return (...args) => {
        for (const p of prep) p();
        paintGraphics[prop](...args);
        waterGraphics[prop](...args);
        return api;
      };
    },
  });

  return api;
}

function simulate(paintTex, waterTex, sigma, commit = true) {
  simShader.setUniform("texelSize", [1 / width, 1 / height]);
  simShader.setUniform("paintTex", paintTex);
  simShader.setUniform("waterTex", waterTex);
  simShader.setUniform("sigma2", sigma ** 2);
  simGraphics.rect(0, 0, width, height);

  if (commit) {
    paintTex.push();
    paintTex.reset();
    paintTex.clear();
    paintTex.image(simGraphics, 0, 0, width, height);
    paintTex.pop();
  }
}

function dry() {
  postShader.setUniform("paintTex", paintGraphics);
  postGraphics.rect(0, 0, width, height);
  dryPaintGraphics.blendMode(MULTIPLY);
  dryPaintGraphics.image(postGraphics, 0, 0);

  paintGraphics.push();
  paintGraphics.reset();
  paintGraphics.clear();
  paintGraphics.pop();

  waterGraphics.push();
  waterGraphics.reset();
  waterGraphics.background(0);
  waterGraphics.pop();
}

function delayFrames(frames) {
  if (!fullRender) return Promise.resolve();

  return new Promise(resolve => {
    delayedFrameCallbacks.push([frameCount + frames, resolve]);
  });
}

function processDelayedFrameCallbacks() {
  for (let i = 0; i < delayedFrameCallbacks.length; i++) {
    const [f, cb] = delayedFrameCallbacks[i];
    if (frameCount >= f) {
      cb();
      delayedFrameCallbacks[i] = null;
    }
  }

  for (let i = delayedFrameCallbacks.length - 1; i >= 0; i--) {
    if (delayedFrameCallbacks[i] == null) {
      delayedFrameCallbacks.splice(i, 1);
    }
  }
}

function getSequenceT(i, count) {
  return count === 1 ? 0.5 : i / (count - 1);
}

function sigmoid(x) {
  return 1 / (1 + exp(-x))
}
