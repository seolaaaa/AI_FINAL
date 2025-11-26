const multer = require('multer');
const pdf = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');
const Storage = require('../models/Storage');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // More lenient PDF detection - check mimetype and file extension
        const isPDF = file.mimetype === 'application/pdf' || 
                     file.mimetype === 'application/x-pdf' ||
                     file.originalname.toLowerCase().endsWith('.pdf');
        const isText = file.mimetype === 'text/plain' ||
                      file.originalname.toLowerCase().endsWith('.txt');
        
        if (isPDF || isText) {
            cb(null, true);
        } else {
            cb(new Error(`Only PDF and text files are allowed. Received: ${file.mimetype || 'unknown'}`));
        }
    }
}).single('file');

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1'; // Default model, can be changed
const USE_OLLAMA = process.env.USE_OLLAMA !== 'false'; // Default to true, set to 'false' to disable

/**
 * Extract text from PDF
 */
async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}

/**
 * Extract text from text file
 */
async function extractTextFromFile(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf-8');
        return text;
    } catch (error) {
        throw new Error(`Failed to read text file: ${error.message}`);
    }
}

/**
 * Generate quiz from text using Ollama
 */
async function generateQuizFromText(text, numQuestions = 5) {
    if (!USE_OLLAMA) {
        // Fallback: Simple rule-based quiz generation
        return generateSimpleQuiz(text, numQuestions);
    }

    try {
        const prompt = `Based on the following text, generate ${numQuestions} multiple-choice quiz questions. 
Each question should have:
- A clear question
- 4 answer options (A, B, C, D)
- The correct answer marked

Format the response as JSON:
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}

Text:
${text.substring(0, 3000)}`;

        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: "system", content: "You are a quiz generator. Always respond with valid JSON only. Do not include any markdown formatting or code blocks, just the raw JSON." },
                    { role: "user", content: prompt }
                ],
                stream: false,
                options: {
                    temperature: 0.7,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const responseText = data.message?.content?.trim() || '';
        
        if (!responseText) {
            throw new Error('Empty response from Ollama');
        }

        // Try to extract JSON from response (remove markdown code blocks if present)
        let jsonText = responseText;
        // Remove markdown code blocks
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Try to find JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from Ollama');
    } catch (error) {
        console.error('Ollama quiz generation failed, using fallback:', error.message);
        return generateSimpleQuiz(text, numQuestions);
    }
}

/**
 * Simple rule-based quiz generation (fallback)
 */
function generateSimpleQuiz(text, numQuestions) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const questions = [];
    
    for (let i = 0; i < Math.min(numQuestions, sentences.length); i++) {
        const sentence = sentences[i].trim();
        if (sentence.length < 20) continue;
        
        // Create a simple fill-in-the-blank or comprehension question
        const words = sentence.split(' ');
        const blankIndex = Math.floor(words.length / 2);
        const correctWord = words[blankIndex];
        
        questions.push({
            question: sentence.replace(correctWord, '______') + '?',
            options: [
                correctWord,
                words[blankIndex - 1] || 'Option B',
                words[blankIndex + 1] || 'Option C',
                'None of the above'
            ],
            correctAnswer: 0
        });
    }

    return {
        title: "Generated Quiz",
        questions: questions.length > 0 ? questions : [{
            question: "What is the main topic of this text?",
            options: ["Topic A", "Topic B", "Topic C", "Topic D"],
            correctAnswer: 0
        }]
    };
}

/**
 * Upload and process file
 */
exports.uploadFile = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded. Please select a PDF or text file.' });
        }

        try {
            let text;
            const filePath = req.file.path;
            console.log('Processing file:', req.file.originalname, 'Type:', req.file.mimetype, 'Size:', req.file.size);

            // Check if it's a PDF by mimetype or extension
            const isPDF = req.file.mimetype === 'application/pdf' || 
                         req.file.mimetype === 'application/x-pdf' ||
                         req.file.originalname.toLowerCase().endsWith('.pdf');
            
            if (isPDF) {
                console.log('Extracting text from PDF...');
                text = await extractTextFromPDF(filePath);
                console.log('Extracted', text.length, 'characters from PDF');
            } else {
                console.log('Reading text file...');
                text = await extractTextFromFile(filePath);
                console.log('Read', text.length, 'characters from text file');
            }

            if (!text || text.trim().length === 0) {
                throw new Error('No text could be extracted from the file. The file might be empty or corrupted.');
            }

            // Clean up file after extraction
            try {
                await fs.unlink(filePath);
            } catch (unlinkError) {
                console.warn('Could not delete temporary file:', unlinkError.message);
            }

            res.status(200).json({
                message: 'File processed successfully',
                text: text.substring(0, 5000), // Return first 5000 chars
                fullText: text
            });
        } catch (error) {
            console.error('Error processing file:', error);
            // Clean up file on error
            try {
                if (req.file && req.file.path) {
                    await fs.unlink(req.file.path);
                }
            } catch (unlinkError) {
                console.warn('Could not delete file on error:', unlinkError.message);
            }
            res.status(500).json({ error: error.message || 'Failed to process file' });
        }
    });
};

/**
 * Generate quiz from text
 */
exports.generateQuiz = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { text, numQuestions = 5, quizTitle } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const quiz = await generateQuizFromText(text, parseInt(numQuestions));
        
        if (quizTitle) {
            quiz.title = quizTitle;
        }

        // Normalize correctAnswer values to ensure they are numbers
        if (quiz.questions && Array.isArray(quiz.questions)) {
            quiz.questions = quiz.questions.map((q, index) => {
                if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
                    const normalized = parseInt(q.correctAnswer);
                    if (isNaN(normalized) || normalized < 0 || (q.options && normalized >= q.options.length)) {
                        console.warn(`Invalid correctAnswer for question ${index}, defaulting to 0`);
                        q.correctAnswer = 0;
                    } else {
                        q.correctAnswer = normalized;
                    }
                } else if (q.options && q.options.length > 0) {
                    // Default to first option if correctAnswer is missing
                    console.warn(`Missing correctAnswer for question ${index}, defaulting to 0`);
                    q.correctAnswer = 0;
                }
                return q;
            });
        }

        // Save quiz to database using Storage model
        const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const userId = req.user.userId || req.user.id;

        // Save quiz data
        await Storage.findOneAndUpdate(
            {
                app: 'quiz-app',
                collectionName: 'quizzes',
                collectionKey: quizId,
                key: 'data'
            },
            {
                app: 'quiz-app',
                collectionName: 'quizzes',
                collectionKey: quizId,
                key: 'data',
                value: {
                    ...quiz,
                    userId: userId,
                    createdAt: new Date(),
                    sourceText: text.substring(0, 500) // Store preview
                }
            },
            { upsert: true }
        );

        res.status(200).json({
            message: 'Quiz generated successfully',
            quizId: quizId,
            quiz: quiz
        });
    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get quiz by ID
 */
exports.getQuiz = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { quizId } = req.params;

        const quizData = await Storage.findOne({
            app: 'quiz-app',
            collectionName: 'quizzes',
            collectionKey: quizId,
            key: 'data'
        });

        if (!quizData) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.status(200).json({
            quizId: quizId,
            quiz: quizData.value
        });
    } catch (error) {
        console.error('Error getting quiz:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all quizzes for user
 */
exports.getUserQuizzes = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const userId = req.user.userId || req.user.id;

        const quizzes = await Storage.find({
            app: 'quiz-app',
            collectionName: 'quizzes',
            key: 'data',
            'value.userId': userId
        });

        // Sort by createdAt in memory (MongoDB nested field sorting can be unreliable)
        const quizList = quizzes
            .map(q => ({
                quizId: q.collectionKey,
                title: q.value.title || 'Untitled Quiz',
                createdAt: q.value.createdAt || q.createdAt || new Date(),
                questionCount: q.value.questions?.length || 0,
                sourceText: q.value.sourceText
            }))
            .sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB - dateA; // Sort descending (newest first)
            });

        res.status(200).json({ quizzes: quizList });
    } catch (error) {
        console.error('Error getting user quizzes:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit quiz answers and get score
 */
exports.submitQuiz = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { quizId, answers } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ error: 'Answers array is required' });
        }

        const quizData = await Storage.findOne({
            app: 'quiz-app',
            collectionName: 'quizzes',
            collectionKey: quizId,
            key: 'data'
        });

        if (!quizData) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const quiz = quizData.value;
        const questions = quiz.questions || [];
        
        let correctCount = 0;
        const results = questions.map((q, index) => {
            const userAnswer = parseInt(answers[index]);
            const correctAnswer = parseInt(q.correctAnswer);
            // Ensure both are valid numbers before comparison
            const isCorrect = !isNaN(userAnswer) && !isNaN(correctAnswer) && userAnswer === correctAnswer;
            if (isCorrect) correctCount++;
            
            return {
                questionIndex: index,
                question: q.question,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                options: q.options
            };
        });

        const score = {
            total: questions.length,
            correct: correctCount,
            percentage: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
        };

        // Save quiz attempt
        const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await Storage.findOneAndUpdate(
            {
                app: 'quiz-app',
                collectionName: 'attempts',
                collectionKey: attemptId,
                key: 'data'
            },
            {
                app: 'quiz-app',
                collectionName: 'attempts',
                collectionKey: attemptId,
                key: 'data',
                value: {
                    quizId: quizId,
                    userId: req.user.userId || req.user.id,
                    score: score,
                    results: results,
                    submittedAt: new Date()
                }
            },
            { upsert: true }
        );

        res.status(200).json({
            message: 'Quiz submitted successfully',
            score: score,
            results: results
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get latest quiz attempt for a quiz
 */
exports.getQuizAttempt = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { quizId } = req.params;
        const userId = req.user.userId || req.user.id;

        // Find the latest attempt for this quiz by this user
        const attempts = await Storage.find({
            app: 'quiz-app',
            collectionName: 'attempts',
            key: 'data',
            'value.quizId': quizId,
            'value.userId': userId
        }).sort({ 'value.submittedAt': -1 }).limit(1);

        if (attempts.length === 0) {
            return res.status(404).json({ error: 'No attempts found for this quiz' });
        }

        const attempt = attempts[0].value;
        res.status(200).json({
            score: attempt.score,
            results: attempt.results,
            submittedAt: attempt.submittedAt
        });
    } catch (error) {
        console.error('Error getting quiz attempt:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete quiz
 */
exports.deleteQuiz = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { quizId } = req.params;
        const userId = req.user.userId || req.user.id;

        const quizData = await Storage.findOne({
            app: 'quiz-app',
            collectionName: 'quizzes',
            collectionKey: quizId,
            key: 'data'
        });

        if (!quizData) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Check if user owns the quiz
        if (quizData.value.userId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to delete this quiz' });
        }

        // Delete quiz and related attempts
        await Storage.deleteMany({
            app: 'quiz-app',
            collectionKey: quizId
        });

        res.status(200).json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error('Error deleting quiz:', error);
        res.status(500).json({ error: error.message });
    }
};

