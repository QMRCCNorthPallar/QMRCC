export default async function handler(req, res){
    // For demo, we return dummy data
    res.status(200).json({
        totalImages: 123,
        topFrame: "vertical-12345.png",
        totalDownloads: 45
    });
}
