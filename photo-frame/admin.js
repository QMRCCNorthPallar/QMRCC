// API Endpoints
const FRAME_API = "https://qmrcc.vercel.app/api/frame";
const UPLOAD_API = "https://qmrcc.vercel.app/api/upload";
const TEXT_API = "https://qmrcc.vercel.app/api/text";
const METRICS_API = "https://qmrcc.vercel.app/api/metrics";

// DOM Elements
const loginSection = document.getElementById("login-section");
const frameSection = document.getElementById("frame-section");
const bannerSection = document.getElementById("banner-section");
const textSection = document.getElementById("text-section");
const metricsSection = document.getElementById("metrics-section");

const adminPasswordInput = document.getElementById("adminPassword");
const loginBtn = document.getElementById("loginBtn");

const frameUpload = document.getElementById("frameUpload");
const frameOrientation = document.getElementById("frameOrientation");
const uploadFrameBtn = document.getElementById("uploadFrameBtn");
const frameList = document.getElementById("frameList");

const bannerUpload = document.getElementById("bannerUpload");
const uploadBannerBtn = document.getElementById("uploadBannerBtn");
const bannerList = document.getElementById("bannerList");

const frontText = document.getElementById("frontText");
const updateTextBtn = document.getElementById("updateTextBtn");

const metricsContainer = document.getElementById("metricsContainer");

// Store password after login
let adminPassword = "";

// --- Login ---
loginBtn.addEventListener("click", () => {
    const pass = adminPasswordInput.value.trim();
    if (!pass) return alert("Enter password!");
    adminPassword = pass; // store it for API calls

    // Show all sections
    loginSection.style.display = "none";
    frameSection.style.display = "block";
    bannerSection.style.display = "block";
    textSection.style.display = "block";
    metricsSection.style.display = "block";

    loadFrames();
    loadBanners();
    loadFrontText();
    loadMetrics();
});

// --- Frames ---
async function loadFrames() {
    frameList.innerHTML = "Loading...";
    try {
        const res = await fetch(FRAME_API);
        const frames = await res.json();
        frameList.innerHTML = "";
        frames.forEach(f => {
            const div = document.createElement("div");
            div.className = "frame-preview";
            div.innerHTML = `<img src="${f.url}" alt="frame">`;
            frameList.appendChild(div);
        });
    } catch (err) {
        frameList.innerHTML = "Error loading frames.";
    }
}

uploadFrameBtn.addEventListener("click", async () => {
    const file = frameUpload.files[0];
    if (!file) return alert("Select a frame file!");
    const orientation = frameOrientation.value;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", adminPassword);
    formData.append("orientation", orientation);

    try {
        const res = await fetch(`${UPLOAD_API}?type=frame`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            alert("Frame uploaded!");
            loadFrames();
        } else alert(data.message || "Upload failed!");
    } catch (err) {
        alert("Upload error: " + err);
    }
});

// --- Banners ---
async function loadBanners() {
    bannerList.innerHTML = "Loading...";
    try {
        const res = await fetch(FRAME_API + "?type=banner");
        const banners = await res.json();
        bannerList.innerHTML = "";
        banners.forEach(b => {
            const div = document.createElement("div");
            div.className = "banner-preview";
            div.innerHTML = `<img src="${b.url}" alt="banner">`;
            bannerList.appendChild(div);
        });
    } catch (err) {
        bannerList.innerHTML = "Error loading banners.";
    }
}

uploadBannerBtn.addEventListener("click", async () => {
    const file = bannerUpload.files[0];
    if (!file) return alert("Select a banner file!");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", adminPassword);

    try {
        const res = await fetch(`${UPLOAD_API}?type=banner`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            alert("Banner uploaded!");
            loadBanners();
        } else alert(data.message || "Upload failed!");
    } catch (err) {
        alert("Upload error: " + err);
    }
});

// --- Front Text ---
async function loadFrontText() {
    try {
        const res = await fetch(TEXT_API);
        const data = await res.json();
        frontText.value = data.text || "";
    } catch (err) {
        frontText.value = "";
    }
}

updateTextBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(TEXT_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: frontText.value, password: adminPassword })
        });
        const data = await res.json();
        if (data.success) alert("Text updated!");
        else alert(data.message || "Update failed!");
    } catch (err) {
        alert("Error updating text.");
    }
});

// --- Metrics ---
async function loadMetrics() {
    metricsContainer.innerHTML = "Loading...";
    try {
        const res = await fetch(METRICS_API);
        const data = await res.json();
        metricsContainer.innerHTML = `
            <div>Total Frames: ${data.totalFrames || 0}</div>
            <div>Total Banners: ${data.totalBanners || 0}</div>
            <div>Total Downloads: ${data.totalDownloads || 0}</div>
            <div>Top Frame: ${data.topFrame || '-'}</div>
        `;
    } catch (err) {
        metricsContainer.innerHTML = "Error loading metrics.";
    }
}
