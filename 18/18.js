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

const circles = [];
const particles = [];
let palette;

const delayedFrameCallbacks = [];
let settleCountdown = 100;

function preload() {
  simShader = loadShader("shader.vert", "sim.frag");
  postShader = loadShader("shader.vert", "post.frag");
}

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1350, 1080);
  commonSetup(canvas, "Experiment");
  dryPaintGraphics = createGraphics(width, height);
  paintGraphics = createGraphics(width, height);
  waterGraphics = createGraphics(width, height);
  flowGraphics = createGraphics(width, height);
  simGraphics = createGraphics(width, height, WEBGL);
  postGraphics = createGraphics(width, height, WEBGL);

  simGraphics.shader(simShader);
  postGraphics.shader(postShader);

  waterGraphics.background(0);

  palette = chroma.scale([
    chroma(floor(random(0xffffff)))
      .set("lch.c", 100)
      .luminance(0.5),
    chroma(floor(random(0xffffff)))
      .set("lch.c", 100)
      .luminance(0.5),
    chroma(floor(random(0xffffff)))
      .set("lch.c", 100)
      .luminance(0.5),
  ]);
}

function initFlowMap(low, high) {
  noiseDetail(3, 2 / 3);
  flowGraphics.background(0);
  flowGraphics.noStroke();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const texture = (0.95 + getTexture(x, y) * 0.05) ** 4;
      const nv = max(0, high - (high - low) * noise(x * 0.06, y * 0.06)) * texture;
      flowGraphics.fill(nv);
      flowGraphics.rect(x, y, 1, 1);
    }
  }
}

function getTexture(x, y) {
  return (sin(x * 0.5 - y * 0.1) + sin(x * 0.1 + y * 0.5)) / 2;
}

function initState() {
  const canvasScale = 0;
  const cellSizeX = 200;
  const cellSizeY = 200;
  for (let cellY = 0; cellY < height; cellY += cellSizeX) {
    for (let cellX = 0; cellX < width; cellX += cellSizeY) {
      const color = palette(random());

      let cx = random(cellX, cellX + cellSizeX * 0.9);
      let cy = random(cellY, cellY + cellSizeY * 0.9);
      const r = max(30, randomGaussian(200, 40));

      cx = lerp(cx, width / 2, canvasScale);
      cy = lerp(cy, height / 2, canvasScale);

      circles.push({
        x: cx,
        y: cy,
        r,
        chirality: round(random()) * 2 - 1,
      });

      const da = 300 / r;
      for (let a = 0; a < 2 * PI; a += max(0, randomGaussian(da, da / 3))) {
        let x =
          randomGaussian(cx, 2) +
          r * sin(a);
        let y =
          randomGaussian(cy, 2) +
          r * cos(a);
        const nx = (noise(x * 0.2, y * 0.2) * 2 - 1) * 12;
        const ny = (noise(x * 0.2, y * 0.2, 100) * 2 - 1) * 12;
        x += nx;
        y += ny;
        const alpha = 1;
        particles.push({ x, y, alpha, color });
      }
    }
  }
}

function updateParticles() {
  noiseDetail(2, 1);
  const noiseScale = 0.001;

  const nf = 60;
  const g = 0;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    const nx = p.x * noiseScale;
    const ny = p.y * noiseScale;
    const nx1 = p.x * noiseScale + 1;
    const ny1 = p.y * noiseScale + 1;
    let dx =
      randomGaussian(0, 0.5) +
      (noise(nx, ny) - noise(nx1, ny)) * nf;
    let dy =
      randomGaussian(0, 0.5) +
      g +
      (noise(nx, ny, 100) - noise(nx, ny1, 100)) * nf;

    for (const c of circles) {
      const centerDist = dist(p.x, p.y, c.x, c.y);
      const surfaceDist = max(0, centerDist - c.r);
      const force = 20 / (10 + surfaceDist * 0.2);
      const angle = atan2(p.y - c.y, p.x - c.x) + PI * 0.6 * c.chirality;
      dx += force * cos(angle);
      dy += force * sin(angle);
    }

    const wetness = lerp(64, 160, 1 - p.alpha / 1);
    watercolor(
      chroma(p.color).alpha(max(p.alpha, 0.008)).hex(),
      constrain(randomGaussian(wetness, 8), 24, 255)
    )
      .noFill()
      .stroke()
      .strokeWeight(1)
      .line(p.x, p.y, p.x + dx, p.y + dy);

    p.x += dx;
    p.y += dy;
    p.alpha *= 0.6;

    if (p.x < 0
      || p.y < 0
      || p.x > width
      || p.y > height
      || hypot(dx, dy) < 0.1) {
      particles.splice(i, 1);
    }
  }
}

function draw() {
  let done = false;

  if (frameCount === 1) {
    initFlowMap(8, 48);
    initState();
  } else if (particles.length > 0 && frameCount < 30) {
    updateParticles();
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
      // margins
      blendMode(BLEND);
      noStroke();
      fill(255);
      rect(0, 0, width, 60);
      rect(0, height - 60, width, 60);
      rect(0, 0, 60, height);
      rect(width - 60, 0, 60, height);

      // canvas color
      blendMode(MULTIPLY);
      noStroke();
      fill("#edebe6");
      rect(0, 0, width, height);

      // noise overlay
      blendMode(OVERLAY);
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const b = 128 + getTexture(x, y) * 3 + (noise(x * 0.05, y * 0.05) * 2 - 1) * 2;
          fill(randomGaussian(b, 11));
          rect(x, y, 1, 1);
        }
      }
    }

    noLoop();
    reportDone();
  }
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
