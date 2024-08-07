import multer from 'multer';
import { fileURLToPath } from 'url';  
import { dirname } from 'path';       

// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use __dirname to construct the path
        cb(null, `${__dirname}/public/temp`);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

export const upload = multer({ storage });
