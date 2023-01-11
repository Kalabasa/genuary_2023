/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const fullRender = new URLSearchParams(window.location.search).has("full");

let canvas;
let paintGraphics;
let waterGraphics;
let flowGraphics;
let simGraphics;
let simShader;

const BRANCH_NODE = "BRANCH_NODE";
const LEAF_NODE = "LEAF_NODE";

let branchInterval;

let leafColor;
let branchColor;

/**
 * @typedef {{x: number, y: number, children: PlantNode[]; parent: PlantNode | null, type: typeof BRANCH_NODE | typeof LEAF_NODE}} PlantNode
 * @type {PlantNode[]}
 */
let roots = [];

/**
 * @type {Array<{frame: number, run: Function}>}
 */
let drawCommands = [];

function preload() {
  simShader = loadShader("shader.vert", "shader.frag");
}

function setup() {
  pixelDensity(1);
  frameRate(30);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Plants");
  paintGraphics = createGraphics(width, height);
  waterGraphics = createGraphics(width, height);
  flowGraphics = createGraphics(width, height);
  simGraphics = createGraphics(width, height, WEBGL);
  simGraphics.shader(simShader);

  waterGraphics.background(0);

  noiseDetail(3, 2 / 3);
  flowGraphics.background(0);
  flowGraphics.noStroke();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nv = noise(x * 0.06, y * 0.06) ** 4 * 12 + 2;
      flowGraphics.fill(nv);
      flowGraphics.rect(x, y, 1, 1);
    }
  }

  branchInterval = constrain(randomGaussian(60, 20), 20, 100);
  roots[0] = createBranch(width / 2, height * 3 / 4, width * 3 / 5, height / 2, width / 2, height / 4);

  leafColor = chroma.hsl(100, constrain(randomGaussian(0.95, 0.1), 0.7, 1), 0.3);
  branchColor = chroma.mix(
    leafColor.darken(0.8),
    '#702000',
    randomGaussian(0.4, 0.3),
    'hsl'
  );

  leafColor = leafColor.alpha(0.1).hex();
  branchColor = branchColor.alpha(0.1).hex();

  for (const root of roots) {
    drawBranch(root);
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {PlantNode["type"]} type
 * @returns {PlantNode}
 */
function createNode(x, y, type) {
  return { x, y, children: [], parent: null, type };
}

function createBranch(startX, startY, controlX, controlY, endX, endY) {
  const root = createNode(startX, startY, BRANCH_NODE);

  const length = dist(startX, startY, endX, endY);

  const t = branchInterval / length;

  const ax = lerp(startX, controlX, t);
  const ay = lerp(startY, controlY, t);

  const bx = lerp(controlX, endX, t);
  const by = lerp(controlY, endY, t);

  const nextX = lerp(ax, bx, t);
  const nextY = lerp(ay, by, t);

  if (branchInterval < length) {
    const next = createBranch(
      nextX,
      nextY,
      bx,
      by,
      endX,
      endY,
    );
    root.children.push(next);
    next.parent = root;

    if (random() < 0.8) {
      const angle = atan2(by - nextY, bx - nextX);
      const deltaAngle = (PI / 3);
      const splitLength = length * 0.2;

      const split = createBranch(
        nextX,
        nextY,
        nextX + cos(angle + deltaAngle * 0.8) * splitLength / 2,
        nextY + sin(angle + deltaAngle * 0.8) * splitLength / 2,
        nextX + cos(angle + deltaAngle) * splitLength,
        nextY + sin(angle + deltaAngle) * splitLength,
      );
      root.children.push(split);
      split.parent = root;
    }
  } else {
    root.type = LEAF_NODE;
  }

  return root;
}

/**
 * @param {PlantNode} root
 */
function drawBranch(root) {
  if (root.parent) {
    const length = dist(root.parent.x, root.parent.y, root.x, root.y);
    if (root.type === BRANCH_NODE) {
      drawCommands.push({
        frame: 1,
        run() {
          const wc = watercolor(branchColor, 128);
          wc.noFill();
          wc.stroke();
          wc.strokeWeight(sigmoid((length - branchInterval) * 44 / branchInterval) * 8 + 2);
          wc.line(root.parent.x, root.parent.y, root.x, root.y);
        }
      });
    } else {
      drawCommands.push({
        frame: 20 + floor(random(60)),
        run() {
          const wc = watercolor(leafColor, 255);
          wc.noStroke();
          wc.fill();
          for (let t = 0; t < length; t += 8) {
            const x = lerp(root.parent.x, root.x, t / length);
            const y = lerp(root.parent.y, root.y, t / length);
            wc.circle(x, y, ((abs(t / length - 0.5) * 2) ** 2 - 1) * 24);
          }
        }
      });
    }
  }

  for (const child of root.children) {
    drawBranch(child);
  }
}

function draw() {
  if (!fullRender) {
    background(255);
    for (const cmd of drawCommands) {
      cmd.run();
    }
    image(paintGraphics, 0, 0);
    noLoop();
    return;
  }

  for (const cmd of drawCommands) {
    if (cmd.frame === frameCount) cmd.run();
  }

  simulate(waterGraphics, flowGraphics, 12);
  simulate(paintGraphics, waterGraphics, 12);
  waterGraphics.blendMode(LIGHTEST);
  waterGraphics.image(flowGraphics, 0, 0);
  waterGraphics.blendMode(BLEND);
  waterGraphics.fill(0, 4);
  waterGraphics.rect(0, 0, width, height);

  background(255);
  image(paintGraphics, 0, 0);

  console.log(frameCount + "%");
  if (frameCount >= 100) {
    noLoop();
    reportDone();
  }
}

/**
 * @returns {p5.Graphics}
 */
function watercolor(color, wetness) {
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
    paintTex.clear();
    paintTex.image(simGraphics, 0, 0, width, height);
  }
}

function sigmoid(x) {
  return 1 / (1 + exp(-x))
}