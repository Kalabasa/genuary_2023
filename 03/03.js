/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

let canvas;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "");
}

function draw() {
}
