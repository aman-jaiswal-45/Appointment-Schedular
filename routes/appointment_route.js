import { Router } from 'express';
import { parseTextController, parseDocumentController } from '../controllers/appointment_controller.js';
import upload from '../middleware/upload.js'; 

const router = Router();

router.post('/parse/text', parseTextController);
router.post('/parse/document', upload, parseDocumentController);

export default router;