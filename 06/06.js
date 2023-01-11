/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { SQRT1_2 } = Math;

const fullRender = new URLSearchParams(window.location.search).has("full");

let canvas;
let gradient;
let noiseScale;
let noisiness;
let numLines;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Still");
  noiseDetail(2, 1);

  const baseColor = chroma(floor(random(0xffffff)))
    .set("hsl.s", constrain(randomGaussian(0.2, 0.1), 0.1, 0.4))
    .luminance(constrain(randomGaussian(0.5, 0.1), 0.4, 0.7));
  gradient = chroma
    .scale(shuffle([
      baseColor,
      chroma(baseColor).set("hsl.h", "+180"),
      chroma.mix(
        baseColor,
        chroma
          .blend(baseColor, chroma.temperature(1000), "overlay")
          .set("hsl.h", delta(floor(random(0, 15)))),
        constrain(randomGaussian(0.25, 0.25), 0, 0.5),
      ),
      chroma.mix(
        baseColor,
        chroma
          .blend(baseColor, chroma.temperature(30000), "overlay")
          .set("hsl.h", delta(floor(random(0, 15)))),
        constrain(randomGaussian(0.25, 0.25), 0, 0.5),
      ),
    ]))
    .mode("lab")
    .padding(-0.3);

  noiseScale = constrain(randomGaussian(0.01, 0.01), 0.005, 0.1);
  noisiness = constrain(randomGaussian(0.4, 0.4), 0.2, 1);

  numLines = floor(constrain(randomGaussian(8, 4), 1, 12));
}

function draw() {
  noStroke();

  blendMode(DARKEST);
  for (let x = 0; x < width; x++) {
    fill(columnColor(x));

    const baseWide = max(randomGaussian(noise(x * 0.004) * 200, 10), 1);
    if (fullRender) {
      for (let y = 0; y < height; y++) {
        const localWide = baseWide + noise(x, y * 0.002) * 80;
        rect(x - floor(localWide / 2), y, ceil(localWide), 1);
      }
    } else {
      const localWide = baseWide + 40;
      rect(x - floor(localWide / 2), 0, ceil(localWide), height);
    }
  }

  if (fullRender) {
    blendMode(LIGHTEST);
    for (let x = 0; x < width; x++) {
      fill(columnColor(x));

      for (let y = 0; y < height; y++) {
        if (random() < 0.001 * noise(x * 0.002, y * 0.002, 1) ** 2) {
          const dotX = randomGaussian(x, 20);
          const dotY = randomGaussian(y, 20);
          const dotRadius = max(randomGaussian(1, 3), 0);

          circle(dotX, dotY, dotRadius);
          circle(
            dotX + random(-dotRadius, dotRadius) * SQRT1_2,
            dotY + random(-dotRadius, dotRadius) * SQRT1_2,
            dotRadius * 0.5
          );
        }
      }
    }

    blendMode(OVERLAY);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        fill(randomGaussian(128, 2));
        rect(x, y, 1, 1);
      }
    }
  }

  randomSeed(globalSeed);
  const basePadding = randomGaussian(250, 50);
  for (let i = 0; i < numLines; i++) {
    let x, y, lx, ly, vx, vy;
    const dirPositive = random() < 0.5;
    if (random() < 0.8) {
      x = dirPositive ? 0 : width;
      y = random(height * 0.2, height * 0.8);
      vx = dirPositive ? 10 : -10;
      vy = randomGaussian(0, 5);
    } else {
      x = random(width * 0.2, width * 0.8);
      y = dirPositive ? 0 : height;
      vx = randomGaussian(0, 5);
      vy = dirPositive ? 10 : -10;
    }

    lx = x;
    ly = y;

    let centerPull = randomGaussian(30, 10);
    const padding = basePadding + randomGaussian(0, 20);

    blendMode(OVERLAY);
    while (true) {
      if (x < -50 || y < -50 || x > width + 50 || y > height + 50) break;
      noFill();
      const intensity =
        120
        + 10000 / (200 + dist(x, y, width / 2, height / 2))
        + noise(x * 0.004, y * 0.004) * 60;
      stroke(constrain(intensity, 128, 255));
      strokeWeight(0.2 + noise(x * 0.002, y * 0.002) * 2);
      if (x > padding && y > padding && x < width - padding && y < height - padding) {
        line(lx, ly, x, y);
      }

      if (centerPull > 0) {
        vx += (width / 2 - x) * 0.001;
        vy += (height / 2 - y) * 0.001;
        centerPull--;
      }

      if (random() < 0.004) {
        x += randomGaussian(0, 20);
        y += randomGaussian(0, 20);
        lx = x;
        ly = y;
        vx *= 0.8;
        vy *= 0.8;
      }

      if (x > 200 && y > 200 && x < width - 200 && y < height - 200 && random() < 0.01) {
        const cx = randomGaussian(x, 200);
        const cy = randomGaussian(y, 200);
        const r = randomGaussian(20, 5);
        const step = 0.1;
        const radNoise = constrain(randomGaussian(5, 0.5), 4, 6);
        const radNoiseScale = constrain(randomGaussian(1.5, 0.25), 1, 2);
        const z = random(0, 100);
        for (let a = 0; a <= 2 * PI; a += step) {
          const r1 = r
            + noise(
              (1 + sin(a - step)) * radNoiseScale,
              (1 + cos(a - step)) * radNoiseScale,
              z
            )
            * radNoise;
          const r2 = r
            + noise(
              (1 + sin(a)) * radNoiseScale,
              (1 + cos(a)) * radNoiseScale,
              z
            )
            * radNoise;
          const arcX1 = cx + r1 * sin(a - step);
          const arcY1 = cy + r1 * cos(a - step);
          const arcX2 = cx + r2 * sin(a);
          const arcY2 = cy + r2 * cos(a);
          line(arcX1, arcY1, arcX2, arcY2);
        }
      }

      if (random() < 0.01) {
        fill(128);
        noStroke();
        circle(randomGaussian(x, 2), randomGaussian(y, 2), randomGaussian(0.5, 0.5));
      }

      lx = x;
      ly = y;
      vx += randomGaussian(0, 0.2);
      vy += randomGaussian(0, 0.2);
      x += vx + randomGaussian(0, 0.5);
      y += vy + randomGaussian(0, 0.5);
    }
  }

  noLoop();
}

function columnColor(x) {
  const localNoiseness = noise(x * 0.01) * noisiness;
  const t = (x / width + noise(x * noiseScale) * localNoiseness) / (1 + localNoiseness);
  return gradient(t).hex();
}

function shuffle(arr) {
  for (let i = 0; i < arr.length; i++) {
    const j = floor(random(0, i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function delta(num) {
  if (num < 0) return String(num);
  return "+" + num;
}