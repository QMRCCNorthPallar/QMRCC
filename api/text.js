import fs from "fs";
import path from "path";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "yourPassword";
const TEXT_FILE = path.join(process.cwd(), "data/frontText.json");

// ensure file exists
if(!fs.existsSync(path.dirname(TEXT_FILE))){
    fs.mkdirSync(path.dirname(TEXT_FILE), { recursive:true });
    fs.writeFileSync(TEXT_FILE, JSON.stringify({text:""}));
}

export default async function handler(req, res){
    if(req.method === "GET"){
        const data = JSON.parse(fs.readFileSync(TEXT_FILE, "utf8"));
        res.status(200).json({ text: data.text });
    } else if(req.method === "POST"){
        const body = await new Promise(resolve => {
            let data="";
            req.on("data", chunk=> data+=chunk);
            req.on("end", ()=> resolve(JSON.parse(data)));
        });
        if(body.password !== ADMIN_PASSWORD){
            return res.status(401).json({success:false, message:"Unauthorized"});
        }
        fs.writeFileSync(TEXT_FILE, JSON.stringify({ text: body.text }));
        res.status(200).json({success:true});
    } else res.status(405).json({ success:false, message:"Method not allowed" });
}
