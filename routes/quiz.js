const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz');
const verifyToken = require('../middlewares/verifyToken');

// File upload route (no auth required for upload, but processing requires auth)
router.post('/upload', quizController.uploadFile);

// Quiz generation and management routes (require authentication)
router.post('/generate', verifyToken, quizController.generateQuiz);
// Specific routes must come before parameterized routes
router.get('/user/all', verifyToken, quizController.getUserQuizzes);
router.get('/:quizId/attempt', verifyToken, quizController.getQuizAttempt);
router.get('/:quizId', verifyToken, quizController.getQuiz);
router.post('/submit', verifyToken, quizController.submitQuiz);
router.delete('/:quizId', verifyToken, quizController.deleteQuiz);

module.exports = router;

