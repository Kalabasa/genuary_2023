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

const flowers = [];
let flowerPalette;

const delayedFrameCallbacks = [];
let settleCountdown = 50;

function preload() {
  simShader = loadShader("shader.vert", "sim.frag");
  postShader = loadShader("shader.vert", "post.frag");
}

function setup() {
  pixelDensity(1);
  frameRate(30);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Flowerpaint", { video: true });
  dryPaintGraphics = createGraphics(width, height);
  paintGraphics = createGraphics(width, height);
  waterGraphics = createGraphics(width, height);
  flowGraphics = createGraphics(width, height);
  simGraphics = createGraphics(width, height, WEBGL);
  postGraphics = createGraphics(width, height, WEBGL);

  simGraphics.shader(simShader);
  postGraphics.shader(postShader);

  waterGraphics.background(0);

  flowerPalette = chroma.scale([
    randomFlowerColor(0.9),
    randomFlowerColor(0.7),
    randomFlowerColor(0.6),
    randomFlowerColor(0.5),
  ], "lab")
    .gamma(0.8);

  makeFlowers();
}

function initFlowMap(low, high) {
  noiseDetail(3, 2 / 3);
  flowGraphics.background(0);
  flowGraphics.noStroke();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const texAngle = random(2 * PI);
      const texX = cos(texAngle) * x;
      const texY = sin(texAngle) * y;
      const texture = (0.2 + 0.6 * abs(sin(texX * 0.4)) + 0.2 * abs(sin(texY * 0.4)));
      const nv = max(0, high - (high - low) * noise(x * 0.06, y * 0.06)) * texture;
      flowGraphics.fill(nv);
      flowGraphics.rect(x, y, 1, 1);
    }
  }
}

function randomFlowerColor(saturation) {
  return chroma.hsl(random(180, 60 + 360) % 360, randomGaussian(saturation, 0.1), 0.5).set("lab.l", 75);
}

function draw() {
  let done = false;

  if (frameCount === 1) {
    initFlowMap(232, 240);
    drawDirty();
  } else if (frameCount === 30) {
    initFlowMap(32, 48);
    dry();
    drawAllFlowers();
  } else if (frameCount > 30 && delayedFrameCallbacks.length === 0) {
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
    waterGraphics.fill(250, 8);
    waterGraphics.rect(0, 0, width, height);
    // constant evaporation
    if (frameCount % 8 === 0) {
      waterGraphics.blendMode(DIFFERENCE);
      waterGraphics.fill(1, 255);
      waterGraphics.rect(0, 0, width, height);
    }
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
      fill("#e8e7dc88");
      rect(0, 0, width, height);

      // noise overlay
      blendMode(OVERLAY);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          fill(randomGaussian(128, 7));
          rect(x, y, 1, 1);
        }
      }
    }

    noLoop();
    reportDone();
  }
}

function drawDirty() {
  for (const f of flowers) {
    if (random() < 0.3) continue;

    const range = max(1, randomGaussian(f.r * 0.4, 4));

    const baseColor = chroma(flowerPalette(random())).set("lch.c", 12);

    for (let i = 0; i < range * 60; i++) {
      watercolor(baseColor.alpha(random(0.002)).hex(), random(32, 64)).noStroke().fill()
        .circle(randomGaussian(f.x, range), randomGaussian(f.y, range), randomGaussian(4, 1));
    }
  }
}

function makeFlowers() {
  const pageMargin = 20;
  const flowerMargin = -5;

  const flowerCount = floor(randomGaussian(100, 10));

  const tries = flowerCount * 100;
  makeFlowers: for (let i = 0; i < tries && flowers.length < flowerCount; i++) {
    const t = max(flowers.length / flowerCount, getSequenceT(i, tries));
    const x = randomGaussian(width / 2, lerp(width / 10, width / 2, t));
    const y = randomGaussian(height / 2, lerp(width / 20, height / 2, t));
    const r = max(20, randomGaussian(lerp(200, 50, t), 20));

    if (x - r < pageMargin || x + r > width - pageMargin || y - r < pageMargin || y + r > height - pageMargin)
      continue;

    for (const f of flowers) {
      if (dist(x, y, f.x, f.y) < r + f.r + flowerMargin) {
        continue makeFlowers;
      }
    }

    flowers.push({ x, y, r });
  }
}

async function drawAllFlowers() {
  for (const f of flowers) {
    await delayFrames(1);
    await drawFlower(f.x, f.y, f.r);
    await delayFrames(10);
    dry();
  }
}

async function drawFlower(x, y, radius) {
  const wateriness = constrain(randomGaussian(48, 8), 32, 255);

  const colorIndex = random();
  const petalColor = flowerPalette(colorIndex);
  const seedColor = chroma.blend(flowerPalette(randomGaussian(colorIndex + 1, 0.05) % 1), "#c84", "multiply");

  const faceBiasX = randomGaussian(0, radius * 0.2);
  const faceBiasY = randomGaussian(radius * -0.6, radius * 0.2); // facing up

  const seedRadius = max(4, radius * randomGaussian(0.1, 0.05));
  const seedSpace = randomGaussian(3, 0.5);

  // seeds
  const mainSeedColor = chroma(seedColor).alpha(0.6).hex();
  const seedLayers = floor(max(1, randomGaussian(2.5, 0.5)));
  const seedCount = floor(max(2, (random() * 2) * radius * 0.2) / seedLayers);
  for (let i = 0; i < seedCount; i++) {
    const a = 2 * PI * (i / seedCount);
    const t = getSequenceT(i, seedCount);
    for (let j = 0; j < seedLayers; j++) {
      const r = seedRadius * (j + 1) / seedLayers;
      const sx = randomGaussian(sin(a) * r, r * 0.15) + faceBiasX * 0.1 + abs(t * 2 - 1) * faceBiasX * 0.1;
      const sy = randomGaussian(cos(a) * r, r * 0.15) + faceBiasY * 0.1 + abs(t * 2 - 1) * faceBiasY * 0.05;
      const size = randomGaussian(log1p(seedRadius) * 1.2, 1);
      watercolor(mainSeedColor, random(24)).noStroke().fill()
        .circle(x + sx, y + sy, size)
        .circle(x + randomGaussian(sx, 0.5), y + randomGaussian(sy, 0.5), size);
      await delayFrames(1);
    }
  }

  await delayFrames(5);

  watercolor(chroma(seedColor).alpha(0.2).hex(), 16).noStroke().fill()
    .circle(x, y, seedRadius * 1.5)
    .circle(randomGaussian(x, 5), randomGaussian(y, 5), seedRadius)
    .circle(randomGaussian(x, 5), randomGaussian(y, 5), seedRadius)
    .circle(randomGaussian(x, 5), randomGaussian(y, 5), seedRadius);

  await delayFrames(5);

  // petals
  noiseDetail(2, 1);
  const petalFiberAngleBias = randomGaussian(1.1, 0.1);
  const petalShape = random();
  const petalCurl = constrain(randomGaussian(0.5 - petalFiberAngleBias * 0.2, 0.2), 0.3, 0.7);
  const petalFibrousness = constrain(randomGaussian(0.5, 0.25), 0, 1);
  const petalCount = floor(max(5, randomGaussian(10 - 2 * petalFiberAngleBias, 2)));
  const petalArcWidth = 2 * PI / petalCount * 0.5;
  const angleOffset = random(0, 2 * PI);
  for (let i = 0; i < petalCount; i++) {
    const petalAngle = angleOffset + 2 * PI * (i / petalCount);

    const strokeCount = 3 + floor(max(0, randomGaussian(0.5 + petalFibrousness * 1.5, 1))) * 2;
    const strokeOrder = Array.from({ length: strokeCount }).map((_, idx) => idx);
    for (const j of shuffle(strokeOrder)) {
      const petalArcLength = petalArcWidth * radius;

      const jt = getSequenceT(j, strokeCount);
      const edgeFactor = abs(jt * 2 - 1);

      const angleOffset = edgeFactor ** 0.2 * sign(jt - 0.5) * petalArcWidth * petalFiberAngleBias + randomGaussian(0, 0.04) * petalArcWidth;
      const strokeStartDistance = seedRadius + seedSpace;
      const strokeEndDistance = randomGaussian(radius * (1 - 0.1 * max(0, edgeFactor - petalShape)), radius * 0.02 * edgeFactor);

      const startX = sin(petalAngle + angleOffset * 0.5) * strokeStartDistance + randomGaussian(0, petalArcLength * 0.02);
      const startY = cos(petalAngle + angleOffset * 0.5) * strokeStartDistance + randomGaussian(0, petalArcLength * 0.02);
      const controlX = sin(petalAngle + angleOffset * (petalShape * 0.8 + 0.4)) * lerp(strokeStartDistance, radius, 0.2 + petalShape * 0.6) + randomGaussian(faceBiasX * (1 - petalCurl), petalArcLength * 0.03);
      const controlY = cos(petalAngle + angleOffset * (petalShape * 0.8 + 0.4)) * lerp(strokeStartDistance, radius, 0.2 + petalShape * 0.6) + randomGaussian(faceBiasY * (1 - petalCurl), petalArcLength * 0.03);
      const endX = sin(petalAngle + angleOffset * (0.4 - 0.2 * petalShape)) * strokeEndDistance + faceBiasX * petalCurl;
      const endY = cos(petalAngle + angleOffset * (0.4 - 0.2 * petalShape)) * strokeEndDistance + faceBiasY * petalCurl;

      let strokeSize = petalArcLength * lerp(1.0 / log(E + strokeCount * 0.4), 0.02, edgeFactor ** 0.2);
      let strokeSteps = floor(max(2, radius * 1.2 / log(E + strokeSize)));
      if (!fullRender) {
        strokeSteps *= 1.2; // simulate the smooth render by having more steps
        strokeSize += 8; // simulate paint spread
      }

      let work = 0;
      let lastSx = null;
      let lastSy = null;

      for (let k = 0; k < strokeSteps; k++) {
        const kt = getSequenceT(k, strokeSteps);

        const ax = lerp(startX, controlX, kt);
        const ay = lerp(startY, controlY, kt);

        const bx = lerp(controlX, endX, kt);
        const by = lerp(controlY, endY, kt);

        let sx = lerp(ax, bx, kt);
        let sy = lerp(ay, by, kt);

        const wavyX = (noise(x + sx * 0.01, y + sy * 0.01) * 2 - 1) * radius * 0.06;
        const wavyY = (noise(x + sx * 0.01, y + sy * 0.01, 100) * 2 - 1) * radius * 0.06;
        sx += randomGaussian(wavyX, 0.4);
        sy += randomGaussian(wavyY, 0.4);

        const size = strokeSize * (1 - abs(kt * 2 - 1)) ** (1.75 - petalShape * 1.5);

        const nv = noise(x + i, y + kt * 2, jt * 3);
        let alpha = lerp(0.15 * nv ** 2, 1, (1 - kt) ** 16);
        if (!fullRender) alpha *= 0.2;

        const sr = size * (nv ** 0.25);

        watercolor(chroma(petalColor).alpha(alpha).hex(), wateriness * lerp(0.4, 1, kt ** 0.5))
          .noStroke().fill()
          .circle(x + sx, y + sy, sr);

        work += lastSx != null && lastSy != null
          ? dist(sx, sy, lastSx, lastSy) * log1p(sr ** 2)
          : 1;
        lastSx = sx;
        lastSy = sy;
        work = await delayForWork(work);
      }
      await delayFrames(5);
    }
  }

  // spills
  while (random() < 0.4) {
    const sx = randomGaussian(x, radius);
    const sy = randomGaussian(y, radius);
    watercolor(chroma(petalColor).alpha(constrain(randomGaussian(0.04, 0.04), 0, 1)).hex(), 255)
      .noStroke().fill()
      .circle(sx, sy, randomGaussian(1, 0.5))
      .circle(randomGaussian(sx, 0.2), randomGaussian(sy, 0.2), randomGaussian(0.5, 0.25));
  }

  await delayFrames(5);
}

/**
 * @returns {p5.Graphics}
 */
function watercolor(color, wetness) {
  waterGraphics.blendMode(LIGHTEST);
  const api = new Proxy(Object.create(null), {
    get(target, prop, receiver) {
      if (prop === "fill" || prop === "stroke") {
        return () => {
          paintGraphics[prop](color);
          waterGraphics[prop](wetness);
          return api;
        };
      }

      if (typeof paintGraphics[prop] !== "function") return;

      return (...args) => {
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
  waterGraphics.blendMode(BLEND);
  waterGraphics.background(0);
  waterGraphics.pop();
}

function getSequenceT(i, count) {
  return count === 1 ? 0.5 : i / (count - 1);
}

async function delayForWork(work) {
  const unitsPerFrame = 60;
  const frames = floor(work / unitsPerFrame);
  if (frames > 0) await delayFrames(frames);
  return work - frames * unitsPerFrame;
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
