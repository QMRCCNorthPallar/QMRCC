// public/js/app.js
(() => {
  const CANVAS_V = { w: 1080, h: 1350 };
  const CANVAS_L = { w: 1920, h: 1080 }; // 16:9 for landscape (we will scale down for preview)
  const canvas = document.getElementById('photoFrameCanvas');
  const ctx = canvas.getContext('2d');

  // DOM
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('photoFrameImage');
  const fileName = document.getElementById('fileName');
  const croppieModal = document.getElementById('croppieModal');
  const croppieContainer = document.getElementById('croppieContainer');
  const croppieCancelBtn = document.getElementById('croppieCancelBtn');
  const croppieApplyBtn = document.getElementById('croppieApplyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const metricUses = document.getElementById('metricUses');
  const metricDownloads = document.getElementById('metricDownloads');

  // Admin elements (if present)
  const orientationSelect = document.getElementById('orientationSelect');
  const frameFile = document.getElementById('frameFile');
  const uploadForm = document.getElementById('uploadForm');
  const metricsBox = document.getElementById('metricsBox');
  const currentFrames = document.getElementById('currentFrames');

  // State
  let orientation = 'vertical';
  let frames = { vertical: null, landscape: null };
  let userImg = null;
  let croppie = null;

  // Fetch frames & metrics at load
  async function fetchFrames() {
    try {
      const res = await fetch('/api/frames');
      frames = await res.json();
      await updateCanvas();
    } catch (e) {
      console.error('Failed to fetch frames', e);
    }
  }

  async function fetchMetrics() {
    try {
      const r = await fetch('/api/metrics');
      const m = await r.json();
      if (metricUses) metricUses.textContent = 'Uses: ' + (m.uses ?? 0);
      if (metricDownloads) metricDownloads.textContent = 'Downloads: ' + (m.downloads ?? 0);
      if (metricsBox) {
        document.getElementById('m-uploads').textContent = m.uploads ?? 0;
        document.getElementById('m-uses').textContent = m.uses ?? 0;
        document.getElementById('m-downloads').textContent = m.downloads ?? 0;
        document.getElementById('m-orient-v').textContent = (m.orientationBreakdown?.vertical ?? 0);
        document.getElementById('m-orient-l').textContent = (m.orientationBreakdown?.landscape ?? 0);
        document.getElementById('m-last').textContent = m.lastUploadAt ?? '—';
      }
      if (currentFrames) {
        currentFrames.innerHTML = '';
        const v = frames.vertical ? `<div class="frame-item"><p>Vertical</p><img src="${frames.vertical}" alt="vertical"></div>` : '<p>Vertical — none</p>';
        const l = frames.landscape ? `<div class="frame-item"><p>Landscape</p><img src="${frames.landscape}" alt="landscape"></div>` : '<p>Landscape — none</p>';
        currentFrames.innerHTML = `<div style="display:flex;gap:0.5rem;align-items:center">${v}${l}</div>`;
      }
    } catch (e) {
      console.error('fetch metrics failed', e);
    }
  }

  // Initialize
  document.querySelectorAll('.btn-orientation').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      document.querySelectorAll('.btn-orientation').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      orientation = btn.dataset.orientation;
      updateCanvas();
      // count use of that orientation for analytics
      sendMetric('use', orientation);
    });
  });

  // Upload button wired to hidden input
  if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', handleFile);

  if (croppieCancelBtn) croppieCancelBtn.addEventListener('click', () => {
    croppieModal.classList.remove('active');
    if (croppie) { croppie.destroy(); croppie = null; }
    fileInput.value = '';
    if (fileName) fileName.textContent = '';
  });

  if (croppieApplyBtn) croppieApplyBtn.addEventListener('click', async ()=>{
    if (!croppie) return;
    const result = await croppie.result({ type:'base64', format:'png', size: { width: orientation==='vertical' ? CANVAS_V.w : CANVAS_L.w, height: orientation==='vertical' ? CANVAS_V.h : CANVAS_L.h } });
    const img = new Image();
    img.onload = () => {
      userImg = img;
      croppieModal.classList.remove('active');
      croppie.destroy(); croppie = null;
      updateCanvas();
    };
    img.src = result;
    // report a 'use'
    sendMetric('use', orientation);
  });

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (fileName) fileName.textContent = file.name;
    // HEIC conversion
    if (file.type === 'image/heic' || file.name.match(/\.heic$/i)) {
      try {
        const converted = await heic2any({ blob: file, toType: 'image/png', quality: 0.95 });
        const reader = new FileReader();
        reader.onload = (ev) => openCroppie(ev.target.result);
        reader.readAsDataURL(converted);
        return;
      } catch (err) {
        alert('Failed to convert HEIC. Try another image.');
        console.error(err);
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = (ev) => openCroppie(ev.target.result);
    reader.readAsDataURL(file);
  }

  function openCroppie(src) {
    croppieModal.classList.add('active');
    // destroy existing
    if (croppie) { croppie.destroy(); croppie = null; }
    // viewport ratio should match orientation
    const vw = orientation === 'vertical' ? 324 : 480;
    const vh = orientation === 'vertical' ? 405 : 270;
    croppie = new Croppie(croppieContainer, {
      viewport: { width: vw, height: vh, type: 'square' },
      boundary: { width: vw + 20, height: vh + 60 },
      enableOrientation: true,
      enableZoom: true
    });
    croppie.bind({ url: src });
  }

  // Render canvas
  function clearCanvas(w, h) {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,w,h);
  }

  async function updateCanvas() {
    // set canvas resolution to chosen orientation for final output, but scale down for preview if too large
    const dims = orientation === 'vertical' ? CANVAS_V : CANVAS_L;
    // for on-screen preview scale down to max width 1080 while keeping aspect ratio
    const previewMaxW = 1080;
    const scale = Math.min(1, previewMaxW / dims.w);
    clearCanvas(dims.w * scale, dims.h * scale);

    // draw user image (centered cover)
    if (userImg) {
      try {
        ctx.drawImage(userImg, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.error('draw user image failed', e);
      }
    } else {
      // placeholder background
      ctx.fillStyle = '#f6fff6';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#e7f5e7';
      ctx.fillRect(12*scale,12*scale,canvas.width-24*scale,canvas.height-24*scale);
    }

    // draw frame if available
    const frameUrl = orientation === 'vertical' ? frames.vertical : frames.landscape;
    if (frameUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); } catch (e) { console.error(e) }
      };
      img.src = frameUrl;
    }
  }

  // Download (export at native resolution)
  downloadBtn?.addEventListener('click', async ()=>{
    if (!userImg) {
      alert('Please upload and crop a photo first.');
      return;
    }
    // get dims
    const dims = orientation === 'vertical' ? CANVAS_V : CANVAS_L;
    // create temp canvas at full dims
    const tmp = document.createElement('canvas');
    tmp.width = dims.w;
    tmp.height = dims.h;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#fff';
    tctx.fillRect(0,0,dims.w,dims.h);
    tctx.drawImage(userImg, 0, 0, dims.w, dims.h);
    // draw frame at full dims
    const frameUrl = orientation === 'vertical' ? frames.vertical : frames.landscape;
    if (frameUrl) {
      const fimg = new Image();
      fimg.crossOrigin = 'anonymous';
      fimg.onload = () => {
        tctx.drawImage(fimg, 0, 0, dims.w, dims.h);
        tmp.toBlob(blob => {
          const link = document.createElement('a');
          link.download = `qmrcc-frame-${orientation}.png`;
          link.href = URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          link.remove();
          // free URL
          URL.revokeObjectURL(link.href);
        }, 'image/png', 1);
      };
      fimg.src = frameUrl;
    } else {
      tmp.toBlob(blob=>{
        const link = document.createElement('a');
        link.download = `qmrcc-frame-${orientation}.png`;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
      }, 'image/png', 1);
    }
    // report download metric
    sendMetric('download', orientation);
  });

  // Metric reporting
  async function sendMetric(key, orientation) {
    try {
      await fetch('/api/metrics/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, orientation })
      });
      // refresh metrics display
      await fetchMetrics();
    } catch (e) { /* ignore metrics errors */ }
  }

  // Admin upload handler (if admin elements exist)
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!frameFile.files[0]) { alert('Choose a file'); return; }
      const fo = new FormData();
      fo.append('frame', frameFile.files[0]);
      fo.append('orientation', orientationSelect.value);
      try {
        const res = await fetch('/admin/upload', { method: 'POST', body: fo });
        if (!res.ok) {
          if (res.status === 401) return alert('Authentication required. Access /admin in browser and login first.');
          const text = await res.text(); return alert('Upload failed: ' + text);
        }
        const data = await res.json();
        alert('Upload ok: ' + data.path);
        fetchFrames(); fetchMetrics();
      } catch (e) {
        alert('Upload failed: ' + e.message);
      }
    });
  }

  // initial load
  fetchFrames();
  fetchMetrics();

  // refresh metrics periodically
  setInterval(fetchMetrics, 15000);
  // also refresh frames occasionally
  setInterval(fetchFrames, 60000);
})();
