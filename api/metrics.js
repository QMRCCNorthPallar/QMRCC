let frames = []; // Should sync with your frame store
let banners = []; // Should sync with your banner store
let downloads = 0; // Optional: track downloads

export default function handler(req, res) {
    res.status(200).json({
        totalFrames: frames.length,
        totalBanners: banners.length,
        totalDownloads: downloads,
        topFrame: frames[0]?.url || '-',
    });
}
