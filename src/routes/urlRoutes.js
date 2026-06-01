import express from 'express';
import { createUrl, deleteUrl, getUrlDetails, getUrls, updateUrl } from '../controllers/urlController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getUrls);
router.post('/', createUrl);
router.get('/:id', getUrlDetails);
router.put('/:id', updateUrl);
router.delete('/:id', deleteUrl);

export default router;
