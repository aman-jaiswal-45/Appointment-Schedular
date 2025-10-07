import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: '../uploads/', 
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const localUpload = multer({
    storage: storage,
    limits:{fileSize: 10000000}, 
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
}).single('document'); 

function checkFileType(file, cb){
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb('Error: You can only upload image files!');
    }
}

export default localUpload;
