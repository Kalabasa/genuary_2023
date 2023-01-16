/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { E, hypot, log1p, sign } = Math;

const debugWater = new URLSearchParams(window.location.search).has("dw");
const fullRender = true || debugWater || new URLSearchParams(window.location.search).has("full");

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
  commonSetup(canvas, "Tessellation");
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
      const texture = (0.1 + 0.7 * abs(sin(texX * 0.4)) + 0.2 * abs(sin(texY * 0.4)));
      const nv = max(0, 36 - 32 * noise(x * 0.02, y * 0.02)) * texture;
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
    simulate(waterGraphics, flowGraphics, 18);

    waterGraphics.push()
    waterGraphics.reset();
    // exponential evaporation (drier parts evaporate quicker)
    waterGraphics.blendMode(BURN);
    waterGraphics.fill(250, 255);
    waterGraphics.rect(0, 0, width, height);
    // constant evaporation
    waterGraphics.blendMode(BLEND);
    waterGraphics.fill(0, 8);
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
      fill("#f7f7f0ff");
      rect(0, 0, width, height);

      // noise overlay
      blendMode(OVERLAY);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          fill(randomGaussian(128, 22));
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
    chroma(floor(random(0xffffff))).luminance(0.6),
    chroma(floor(random(0xffffff))).luminance(0.6),
    chroma(floor(random(0xffffff))).luminance(0.6),
  ], "lab")
    .classes(max(1, floor(randomGaussian(4, 1))));

  const pad = 15;
  const s = 60;
  const thick = max(1, randomGaussian(4, 1));
  const rad = max(5, randomGaussian(s, s));
  for (let x = pad; x < width - pad - s * 0.5; x += s) {
    let j = 0;
    for (let y = pad; y < height - pad; y += s * sqrt(3) / 2) {
      j++;
      const cx = x + (s / 2) + (j & 1) * (s / 2);
      const cy = y + (s / 2);
      const nw = lerp(64, 255, noise(x * 0.001, y * 0.001, 200) ** 2);
      watercolor(palette(random()).alpha(0.6).hex(), nw)
        .push()
        .noFill().stroke()
        .strokeWeight(thick)
        .circle(cx, cy, rad)
        .pop();
      if (random() < 0.05) await delayFrames(floor(random(1, 10)));
    }
  }
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
