p5.disableFriendlyErrors = true;

const params = new URLSearchParams(window.location.search);
let globalSeed = Math.floor(Math.random() * 10000);
let isVideo;

function commonSetup(
  canvas,
  name = window.location.pathname.replace(/\//g, ''),
  options = {
    video: false,
  },
) {
  if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }

  setupSeed(name);
  const captor = setupCaptor(canvas, !!options.video);
  setupDownloader(canvas, captor, name);
}

function setupSeed(name) {
  if (params.has('s')) {
    globalSeed = Number.parseInt(params.get('s'));
  }

  randomSeed(globalSeed);
  noiseSeed(globalSeed);

  document.title = `${name} #${globalSeed}`;
  window.history.replaceState(undefined, undefined, `?s=${globalSeed}`);

  document.addEventListener('keyup', (e) => {
    if (e.key !== ' ') return;
    window.location.search = '';
  });
}

function reportDone() {
  setTimeout(() => {
    console.log("Done rendering!");
    if (Notification.permission === "granted") {
      new Notification("Done rendering!");
    } else {
      alert("Done rendering!");
    }
  });
}

function setupDownloader(canvas, captor) {
  document.addEventListener('keyup', (e) => {
    if (e.key === 's') {
      if (isVideo) {
        downloadVideo(captor);
      } else {
        downloadImage(canvas);
      }
    } else if (e.key === 'i') {
      downloadImage(canvas);
    } else if (isVideo && e.key === 'v') {
      downloadVideo(captor);
    }
  });
}

function downloadImage(canvas) {
  saveCanvas(canvas, document.title, 'png');
}

function downloadVideo(captor) {
  captor.stop();
  captor.save((blob) => {
    const a = document.createElement("a");
    document.body.appendChild(a);
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = document.title + ".webm";
    a.click();
    window.URL.revokeObjectURL(url);
    setTimeout(() => a.remove());
  });
}

function setupCaptor(canvas, forceEnable) {
  const params = new URLSearchParams(window.location.search);
  if (forceEnable || params.has('v')) {
    isVideo = true;
  }

  if (!isVideo) return;

  const captor = new CCapture({ format: "webm", framerate: 30 });
  const origDraw = draw;
  draw = function draw() {
    if (frameCount === 1) {
      captor.start();
    }
    origDraw();
    captor.capture(canvas.elt);
  }

  return captor;
}

// contextAttributes override
const proto = p5.Renderer2D.prototype;
p5.Renderer2D = function (elt, pInst, isMainCanvas) {
  p5.Renderer.call(this, elt, pInst, isMainCanvas);
  this.drawingContext = this.canvas.getContext('2d', { willReadFrequently: true });
  this._pInst._setProperty('drawingContext', this.drawingContext);
  return this;
};
p5.Renderer2D.prototype = proto;
