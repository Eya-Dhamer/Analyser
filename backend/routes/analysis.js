const express = require('express');
const analysisController = require('../controllers/analysisController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const upload = require('../config/multer');

const router = express.Router();

router.post('/guest', analysisController.guestAnalysis);

router.post('/guest-file', upload.single('configFile'), analysisController.guestAnalysisFile);

router.post('/submit', authMiddleware, analysisController.submitAnalysis);

router.post('/submit-file', authMiddleware, upload.single('configFile'), analysisController.submitAnalysisFile);

router.get('/shared/:token', analysisController.getSharedAnalysis);

router.get('/', authMiddleware, analysisController.getUserAnalyses);

router.get('/:id/export', authMiddleware, analysisController.exportAnalysis);

router.get('/:id', authMiddleware, analysisController.getAnalysis);

router.post('/:id/share', authMiddleware, analysisController.shareAnalysis);

router.delete('/:id', authMiddleware, analysisController.deleteAnalysis);

module.exports = router;