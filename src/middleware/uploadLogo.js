import multer from "multer";
import path from "path";

// configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/logos/"); // save logos here (make sure folder exists)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `logo_${Date.now()}${ext}`);
    },
});

export const uploadLogo = multer({ storage });