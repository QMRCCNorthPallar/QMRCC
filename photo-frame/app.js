const BASE = "https://qmrcc.vercel.app/api";

const FRAME_API = `${BASE}/frame`;
const METRICS_UPDATE_API = `${BASE}/metrics-update`;

const uploadInput = document.getElementById("upload");
const orientationSelect = document.getElementById("orientation");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadBtn = document.getElementById("downloadBtn");

let userImage = null;
let frameImage = null;

// Default sizes:
const VERTICAL = { w: 1080, h: 1350 };
const LANDSCAPE = { w: 1920, h: 1080 };

// When orientation changes → load frame
orientationSelect.addEventListener("change", loadFrame);

// When user uploads photo
uploadInput.addEventListener("change", handleUpload);

// Download button
downloadBtn.addEventListener("click", downloadImage);

// Initial load
loadFrame();

async function loadFrame() {
  const o = orientationSelect.value;

  const url = `${FRAME_API}?orientation=${o}`;
  frameImage = await loadImage(url);

  await updateMetrics("change");
  draw();
}

async function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    userImage = await loadImage(evt.target.result);
    draw();
  };
  reader.readAsDataURL(file);
}

function draw() {
  if (!frameImage) return;

  const o = orientationSelect.value;
  const size = o === "vertical" ? VERTICAL : LANDSCAPE;

  canvas.width = size.w;
  canvas.height = size.h;

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.w, size.h);

  // User image
  if (userImage) {
    ctx.drawImage(userImage, 0, 0, size.w, size.h);
  }

  // Frame overlay
  ctx.drawImage(frameImage, 0, 0, size.w, size.h);
}

async function downloadImage() {
  if (!userImage) {
    alert("Upload a photo first.");
    return;
  }

  // Update metrics
  await updateMetrics("download");

  const a = document.createElement("a");
  a.download = "qmrcc-frame.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.src = url;
  });
}

async function updateMetrics(type) {
  try {
    await fetch(`${METRICS_UPDATE_API}?type=${type}`, { method: "POST" });
  } catch {}
}
