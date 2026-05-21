const express = require('express');
const adminController = require('../controllers/adminController');
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { adminOnly } = require('../middlewares/adminOnly');

const router = express.Router();

router.use(authMiddleware, adminOnly);

//Users
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

//Analyses
router.get('/analyses', adminController.getAllAnalyses);
router.get('/users/:id/analyses', adminController.getUserAnalyses);

//Stats
router.get('/stats', statsController.getStats);

module.exports = router;