const BASE = "https://qmrcc.vercel.app/api";

const UPLOAD_API = `${BASE}/upload`;

document.getElementById("uploadBtn").addEventListener("click", uploadFrame);

async function uploadFrame() {
  const password = document.getElementById("password").value.trim();
  const orientation = document.getElementById("orientation").value;
  const file = document.getElementById("frameFile").files[0];
  const status = document.getElementById("status");

  if (!password || !file) {
    status.textContent = "Password or file missing.";
    return;
  }

  // Convert to Base64
  const base64 = await fileToBase64(file);

  const res = await fetch(`${UPLOAD_API}?orientation=${orientation}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Authorization": `Bearer ${password}`
    },
    body: base64
  });

  const data = await res.json();

  if (data.success) {
    status.textContent = "Frame uploaded successfully!";
  } else {
    status.textContent = "Upload failed: " + (data.error || "Unknown error");
  }
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
