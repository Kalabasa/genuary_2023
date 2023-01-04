/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
const { log2 } = Math;

let canvas;

let colorScale;
let numBubbles;
let bubbleMeanSize;
let inverseModeThreshold;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "Intersections");
  noiseDetail(1, 1);

  colorScale = chroma.scale([
    chroma(floor(random(0, 0xffffff))).luminance(0.1).set("lch.c", 40),
    chroma(floor(random(0, 0xffffff))).luminance(0.1).set("lch.c", 60),
  ]).colors(5);

  numBubbles = constrain(ceil(randomGaussian(500, 3000)), 30, 3000);
  bubbleMeanSize = min(width, height) * 3 / log2(numBubbles - 28);
  console.log(numBubbles, bubbleMeanSize);
  inverseModeThreshold = numBubbles * constrain(randomGaussian(0.6, 0.4), 0, 1);
}

function draw() {
  background(chroma(colorScale[0]).desaturate(1).hex());
  noStroke();
  const noiseScale = 0.004;
  for (let i = 0; i < numBubbles; i++) {
    const mode = i < inverseModeThreshold ? EXCLUSION : DIFFERENCE;
    const x = randomGaussian(width / 2, width / 2);
    const y = randomGaussian(height / 2, height / 2);
    const r = randomGaussian(
      bubbleMeanSize * (noise(x * noiseScale, y * noiseScale) ** 2),
      bubbleMeanSize * 0.1
    );

    const colorNoise = randomGaussian(noise(x * noiseScale / 2, y * noiseScale / 2, 2) * 2, 0.2);
    let color = colorScale[constrain(floor(colorNoise * colorScale.length), 0, colorScale.length - 1)];
    if (mode === DIFFERENCE) {
      color = chroma(color).set("hsl.h", "+180").hex();
    }

    blendMode(mode);
    fill(color);
    circle(x, y, r);
  }
  noLoop();
}
