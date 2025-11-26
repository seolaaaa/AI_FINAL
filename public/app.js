// API Configuration
const API_BASE_URL = window.location.origin;
let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

// State Management
let currentUser = null;
let currentQuiz = null;
let currentQuizId = null;

// Initialize App
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        checkAuth();
    });
} else {
    // DOMContentLoaded already fired, run immediately
    setupEventListeners();
    checkAuth();
}

// Check Authentication Status
function checkAuth() {
    // Always show auth first, then check token
    if (accessToken) {
        // Verify token is still valid by trying to load dashboard
        showDashboard();
        loadUserQuizzes();
    } else {
        showAuth();
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Auth Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);

    // Navigation
    document.getElementById('dashboardLink').addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });
    document.getElementById('createLink').addEventListener('click', (e) => {
        e.preventDefault();
        showCreateQuiz();
    });
    document.getElementById('logoutLink').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
    
    // User menu dropdown
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserDropdown();
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenuBtn && userDropdown && !userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            closeUserDropdown();
        }
    });
    document.getElementById('newQuizBtn').addEventListener('click', showCreateQuiz);
    document.getElementById('backToDashboardBtn').addEventListener('click', showDashboard);
    document.getElementById('backFromCreateBtn').addEventListener('click', showDashboard);

    // Quiz Creation
    document.getElementById('pdfFile').addEventListener('change', handleFileSelect);
    document.getElementById('choosePdfBtn').addEventListener('click', () => {
        document.getElementById('pdfFile').click();
    });
    document.getElementById('generateQuizBtn').addEventListener('click', handleGenerateQuiz);

    // Quiz Taking
    document.getElementById('submitQuizBtn').addEventListener('click', handleSubmitQuiz);
}

// Tab Switching
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.toggle('active', t.id === `${tab}Tab`);
    });
    clearErrors();
}

// Show Sections
function showAuth() {
    hideAllSections();
    hideUserMenu();
    document.body.classList.add('login-page-active');
    const authSection = document.getElementById('authSection');
    if (authSection) {
        authSection.style.display = 'flex';
        authSection.style.visibility = 'visible';
        authSection.style.opacity = '1';
    }
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = 'none';
    }
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.style.display = 'flex';
    }
}

function showDashboard() {
    hideAllSections();
    document.body.classList.remove('login-page-active');
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('navLinks').style.display = 'flex';
    updateUsernameDisplay();
    showUserMenu();
    loadUserQuizzes();
}

function showCreateQuiz() {
    hideAllSections();
    document.body.classList.remove('login-page-active');
    document.getElementById('createSection').style.display = 'block';
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('navLinks').style.display = 'flex';
    showUserMenu();
    // Reset form
    document.getElementById('pdfFile').value = '';
    document.getElementById('notesText').value = '';
    document.getElementById('quizTitle').value = '';
    document.getElementById('numQuestions').value = '5';
    document.getElementById('pdfFileName').textContent = '';
    clearStatus();
}

async function showQuiz(quizId) {
    hideAllSections();
    document.body.classList.remove('login-page-active');
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('navLinks').style.display = 'flex';
    showUserMenu();
    
    // Check if there's a previous attempt for this quiz - show results if available
    try {
        const response = await apiCall(`/quiz/${quizId}/attempt`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.score && data.results) {
                // Show results screen if attempt exists
                showResults(data.score, data.results);
                return;
            }
        }
    } catch (error) {
        // No attempt found - will show answer key below
        console.log('No previous attempt found for quiz:', quizId);
    }
    
    // No attempt found, show answer key
    try {
        const statusEl = document.getElementById('quizStatus');
        if (statusEl) {
            statusEl.textContent = 'Loading quiz...';
            statusEl.className = 'status-message info show';
        }
        
        const response = await apiCall(`/quiz/${quizId}`);
        const data = await response.json();

        if (response.ok) {
            if (!data.quiz) {
                throw new Error('Quiz data is missing');
            }
            currentQuiz = data.quiz;
            currentQuizId = quizId;
            // Show answer key (all correct answers)
            displayAnswerKey(data.quiz);
            
            if (statusEl) {
                statusEl.classList.remove('show');
            }
        } else {
            throw new Error(data.error || 'Failed to load quiz');
        }
    } catch (error) {
        console.error('Error loading quiz:', error);
        const statusEl = document.getElementById('quizStatus');
        if (statusEl) {
            statusEl.textContent = error.message || 'Error loading quiz';
            statusEl.className = 'status-message error show';
        }
        setTimeout(() => {
            showDashboard();
        }, 2000);
    }
}

async function showQuizForTaking(quizId) {
    hideAllSections();
    document.body.classList.remove('login-page-active');
    document.getElementById('quizSection').style.display = 'block';
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('navLinks').style.display = 'flex';
    showUserMenu();
    // Load quiz for taking (not review mode)
    try {
        const statusEl = document.getElementById('quizStatus');
        if (statusEl) {
            statusEl.textContent = 'Loading quiz...';
            statusEl.className = 'status-message info show';
        }
        
        const response = await apiCall(`/quiz/${quizId}`);
        const data = await response.json();

        if (response.ok) {
            if (!data.quiz) {
                throw new Error('Quiz data is missing');
            }
            currentQuiz = data.quiz;
            currentQuizId = quizId;
            // Show quiz for taking (not review mode)
            displayQuizForTaking(data.quiz);
            
            if (statusEl) {
                statusEl.classList.remove('show');
            }
        } else {
            throw new Error(data.error || 'Failed to load quiz');
        }
    } catch (error) {
        console.error('Error loading quiz:', error);
        const statusEl = document.getElementById('quizStatus');
        if (statusEl) {
            statusEl.textContent = error.message || 'Error loading quiz';
            statusEl.className = 'status-message error show';
        }
    }
}

function showResults(score, results) {
    hideAllSections();
    document.body.classList.remove('login-page-active');
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('navLinks').style.display = 'flex';
    showUserMenu();
    displayResults(score, results);
}

function hideAllSections() {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => {
        s.style.display = 'none';
    });
    // Hide login page
    const authSection = document.getElementById('authSection');
    if (authSection) {
        authSection.style.display = 'none';
    }
}

// Authentication Functions
async function handleSignup(e) {
    e.preventDefault();
    clearErrors();

    const id = document.getElementById('signupId').value;
    const password = document.getElementById('signupPassword').value;
    const email = document.getElementById('signupEmail').value.trim();

    // Build contact array only if email is provided
    const contact = email ? [{ name: 'email', value: email }] : [];

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                password,
                contact,
                access: [['quiz-app', null, null, ['get', 'set', 'remove']]]
            })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('signupError', 'Signup successful! Please login.', 'success');
            setTimeout(() => switchTab('login'), 2000);
        } else {
            showError('signupError', data.message || 'Signup failed');
        }
    } catch (error) {
        showError('signupError', 'Network error. Please try again.');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearErrors();

    const id = document.getElementById('loginId').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });

        const data = await response.json();

        if (response.ok) {
            accessToken = data.accessToken;
            refreshToken = data.refreshToken;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            currentUser = data.user;
            updateUsernameDisplay();
            showDashboard();
        } else {
            showError('authError', data.message || 'Login failed');
        }
    } catch (error) {
        showError('authError', 'Network error. Please try again.');
    }
}

function handleLogout() {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    currentUser = null;
    closeUserDropdown();
    hideUserMenu();
    showAuth();
}

// User Menu Functions
function showUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu && accessToken) {
        userMenu.style.display = 'block';
    }
}

function hideUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.style.display = 'none';
    }
    closeUserDropdown();
}

function toggleUserDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
        const isOpen = userDropdown.classList.contains('show');
        if (isOpen) {
            closeUserDropdown();
        } else {
            openUserDropdown();
        }
    }
}

function openUserDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
        userMenuBtn.classList.add('active');
        userDropdown.classList.add('show');
    }
}

function closeUserDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
        userMenuBtn.classList.remove('active');
        userDropdown.classList.remove('show');
    }
}

function updateUsernameDisplay() {
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) {
        if (currentUser && currentUser.id) {
            usernameDisplay.textContent = currentUser.id;
        } else if (accessToken) {
            // Try to get username from token or use a default
            usernameDisplay.textContent = 'User';
        } else {
            usernameDisplay.textContent = 'User';
        }
    }
}

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Try to refresh token
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${accessToken}`;
                return fetch(url, { ...options, headers });
            } else {
                handleLogout();
                throw new Error('Session expired');
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
}

async function refreshAccessToken() {
    if (!refreshToken) return false;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/refreshtoken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: refreshToken })
        });

        const data = await response.json();

        if (response.ok) {
            accessToken = data.accessToken;
            refreshToken = data.refreshToken;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Quiz Functions
async function loadUserQuizzes() {
    try {
        const response = await apiCall('/quiz/user/all');
        const data = await response.json();

        if (response.ok) {
            displayQuizzes(data.quizzes || []);
        }
    } catch (error) {
        console.error('Error loading quizzes:', error);
    }
}

function displayQuizzes(quizzes) {
    const container = document.getElementById('quizzesList');
    
    if (quizzes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No quizzes yet. Create your first quiz!</p>';
        return;
    }

    container.innerHTML = quizzes.map(quiz => `
        <div class="quiz-card" data-quiz-id="${quiz.quizId}">
            <h3>${quiz.title || 'Untitled Quiz'}</h3>
            <p>${quiz.questionCount} questions</p>
            <div class="quiz-meta">
                <span>${quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                <button type="button" class="btn btn-secondary delete-quiz-btn" data-quiz-id="${quiz.quizId}">Delete</button>
            </div>
        </div>
    `).join('');

    // Add event listeners for quiz cards and delete buttons
    container.querySelectorAll('.quiz-card').forEach(card => {
        const quizId = card.dataset.quizId;
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (!e.target.closest('.delete-quiz-btn')) {
                showQuiz(quizId);
            }
        });
    });

    container.querySelectorAll('.delete-quiz-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const quizId = btn.dataset.quizId;
            deleteQuiz(quizId);
        });
    });
}


function displayAnswerKey(quiz) {
    if (!quiz) {
        throw new Error('Quiz data is invalid');
    }

    document.body.classList.remove('login-page-active');
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('navLinks').style.display = 'flex';
    showUserMenu();
    document.getElementById('quizTitleDisplay').textContent = (quiz.title || 'Quiz') + ' - Answer Key';
    const container = document.getElementById('quizQuestions');
    const quizSection = document.getElementById('quizSection');
    if (quizSection) {
        quizSection.style.display = 'block';
    }
    
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        container.innerHTML = '<div class="question-card"><p style="color: var(--error-color);">This quiz has no questions. It may have been corrupted.</p></div>';
        return;
    }
    
    container.innerHTML = quiz.questions.map((q, index) => {
        if (!q.question || !q.options || !Array.isArray(q.options)) {
            return `<div class="question-card"><p style="color: var(--error-color);">Question ${index + 1} is invalid.</p></div>`;
        }
        
        // Ensure correctAnswer is a number and valid
        let correctAnswer = null;
        if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
            correctAnswer = parseInt(q.correctAnswer);
            // Validate that correctAnswer is within valid range
            if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer >= q.options.length) {
                console.warn(`Invalid correctAnswer for question ${index + 1}:`, q.correctAnswer, 'Options:', q.options.length);
                correctAnswer = null;
            }
        }
        
        return `
        <div class="question-card">
            <h3>Question ${index + 1}</h3>
            <p>${q.question}</p>
            <ul class="options-list">
                ${q.options.map((option, optIndex) => {
                    // Strict comparison: only mark as correct if optIndex exactly matches correctAnswer
                    const isCorrect = correctAnswer !== null && optIndex === correctAnswer;
                    return `
                    <li class="option-item ${isCorrect ? 'correct-answer' : ''}">
                        <label style="cursor: default;">
                            <input type="radio" name="question${index}" value="${optIndex}" ${isCorrect ? 'checked' : ''} disabled>
                            ${option}
                            ${isCorrect ? '<span class="correct-badge">✓ Correct Answer</span>' : ''}
                        </label>
                    </li>
                `;
                }).join('')}
            </ul>
        </div>
    `;
    }).join('');
    
    // Hide submit button
    const submitBtn = document.getElementById('submitQuizBtn');
    if (submitBtn) {
        submitBtn.style.display = 'none';
    }
    
    // Add "Take This Quiz" button
    const containerEl = document.getElementById('quizQuestions');
    if (containerEl) {
        // Remove existing button if any
        const existingBtn = document.getElementById('takeQuizBtn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        const takeQuizBtn = document.createElement('button');
        takeQuizBtn.id = 'takeQuizBtn';
        takeQuizBtn.className = 'btn btn-primary btn-large';
        takeQuizBtn.textContent = 'Take This Quiz';
        takeQuizBtn.style.marginTop = '1rem';
        const currentQuizIdForBtn = currentQuizId; // Capture current quiz ID
        takeQuizBtn.onclick = () => {
            showQuizForTaking(currentQuizIdForBtn);
        };
        containerEl.parentNode.insertBefore(takeQuizBtn, containerEl.nextSibling);
    }
}

function displayQuiz(quiz, showAnswers = true) {
    if (!quiz) {
        throw new Error('Quiz data is invalid');
    }

    document.getElementById('quizTitleDisplay').textContent = quiz.title || 'Quiz';
    const container = document.getElementById('quizQuestions');
    
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        container.innerHTML = '<div class="question-card"><p style="color: var(--error-color);">This quiz has no questions. It may have been corrupted.</p></div>';
        return;
    }
    
    // If showAnswers is false, display quiz for taking
    if (!showAnswers) {
        displayQuizForTaking(quiz);
        return;
    }
    
    // Store original quiz for retaking
    window.originalQuiz = quiz;
    window.isReviewMode = true;
    
    container.innerHTML = quiz.questions.map((q, index) => {
        if (!q.question || !q.options || !Array.isArray(q.options)) {
            return `<div class="question-card"><p style="color: var(--error-color);">Question ${index + 1} is invalid.</p></div>`;
        }
        
        const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : null;
        
        return `
        <div class="question-card">
            <h3>Question ${index + 1}</h3>
            <p>${q.question}</p>
            <ul class="options-list">
                ${q.options.map((option, optIndex) => {
                    const isCorrect = correctAnswer !== null && optIndex === correctAnswer;
                    return `
                    <li class="option-item ${isCorrect ? 'correct-answer' : ''}">
                        <label style="cursor: default;">
                            <input type="radio" name="question${index}" value="${optIndex}" ${isCorrect ? 'checked' : ''} disabled>
                            ${option}
                            ${isCorrect ? '<span class="correct-badge">✓ Correct Answer</span>' : ''}
                        </label>
                    </li>
                `;
                }).join('')}
            </ul>
        </div>
    `;
    }).join('');
    
    // Hide submit button and add "Take Quiz" button
    const submitBtn = document.getElementById('submitQuizBtn');
    if (submitBtn) {
        submitBtn.style.display = 'none';
    }
    
    // Remove existing take quiz button if any
    const existingBtn = document.getElementById('takeQuizBtn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Add "Take Quiz" button
    const containerEl = document.getElementById('quizQuestions');
    if (containerEl) {
        const takeQuizBtn = document.createElement('button');
        takeQuizBtn.id = 'takeQuizBtn';
        takeQuizBtn.className = 'btn btn-primary btn-large';
        takeQuizBtn.textContent = 'Take This Quiz';
        takeQuizBtn.style.marginTop = '1rem';
        takeQuizBtn.onclick = () => {
            window.isReviewMode = false;
            displayQuizForTaking(quiz);
        };
        containerEl.parentNode.insertBefore(takeQuizBtn, containerEl.nextSibling);
    }
}

function displayQuizForTaking(quiz) {
    document.getElementById('quizTitleDisplay').textContent = quiz.title || 'Quiz';
    const container = document.getElementById('quizQuestions');
    
    container.innerHTML = quiz.questions.map((q, index) => {
        if (!q.question || !q.options || !Array.isArray(q.options)) {
            return `<div class="question-card"><p style="color: var(--error-color);">Question ${index + 1} is invalid.</p></div>`;
        }
        
        return `
        <div class="question-card">
            <h3>Question ${index + 1}</h3>
            <p>${q.question}</p>
            <ul class="options-list">
                ${q.options.map((option, optIndex) => `
                    <li class="option-item">
                        <label>
                            <input type="radio" name="question${index}" value="${optIndex}" required>
                            ${option}
                        </label>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    }).join('');
    
    // Show submit button and hide take quiz button
    const submitBtn = document.getElementById('submitQuizBtn');
    if (submitBtn) {
        submitBtn.style.display = 'block';
    }
    
    const takeQuizBtn = document.getElementById('takeQuizBtn');
    if (takeQuizBtn) {
        takeQuizBtn.remove();
    }
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('pdfFileName').textContent = `Selected: ${file.name}`;
    }
}

async function handleGenerateQuiz() {
    const pdfFile = document.getElementById('pdfFile').files[0];
    const notesText = document.getElementById('notesText').value;
    const quizTitle = document.getElementById('quizTitle').value;
    const numQuestions = parseInt(document.getElementById('numQuestions').value) || 5;

    if (!pdfFile && !notesText.trim()) {
        showStatus('generateStatus', 'Please upload a PDF or enter notes', 'error');
        return;
    }

    showStatus('generateStatus', 'Processing...', 'info');
    document.getElementById('generateQuizBtn').disabled = true;

    try {
        let text = '';

        if (pdfFile) {
            // Upload and extract text from PDF
            const formData = new FormData();
            formData.append('file', pdfFile);

            const uploadResponse = await fetch(`${API_BASE_URL}/quiz/upload`, {
                method: 'POST',
                body: formData
                // Don't set Content-Type header - let browser set it with boundary for FormData
            });

            let uploadData;
            try {
                uploadData = await uploadResponse.json();
            } catch (parseError) {
                const text = await uploadResponse.text();
                throw new Error(`Server error: ${text || 'Failed to process file'}`);
            }

            if (!uploadResponse.ok) {
                throw new Error(uploadData.error || `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
            }
            text = uploadData.fullText || uploadData.text;
        } else {
            text = notesText;
        }

        // Generate quiz
        const response = await apiCall('/quiz/generate', {
            method: 'POST',
            body: JSON.stringify({
                text,
                numQuestions,
                quizTitle: quizTitle || undefined
            })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('generateStatus', 'Quiz generated successfully!', 'success');
            setTimeout(() => {
                // Show newly generated quiz for taking (not review mode)
                showQuizForTaking(data.quizId);
            }, 1500);
        } else {
            showStatus('generateStatus', data.error || 'Failed to generate quiz', 'error');
        }
    } catch (error) {
        showStatus('generateStatus', error.message || 'Error generating quiz', 'error');
    } finally {
        document.getElementById('generateQuizBtn').disabled = false;
    }
}

async function handleSubmitQuiz() {
    const questions = currentQuiz.questions;
    const answers = [];

    // Collect answers
    for (let i = 0; i < questions.length; i++) {
        const selected = document.querySelector(`input[name="question${i}"]:checked`);
        if (!selected) {
            showStatus('generateStatus', 'Please answer all questions', 'error');
            return;
        }
        answers.push(parseInt(selected.value));
    }

    try {
        const response = await apiCall('/quiz/submit', {
            method: 'POST',
            body: JSON.stringify({
                quizId: currentQuizId,
                answers
            })
        });

        const data = await response.json();

        if (response.ok) {
            showResults(data.score, data.results);
        } else {
            showStatus('generateStatus', data.error || 'Failed to submit quiz', 'error');
        }
    } catch (error) {
        showStatus('generateStatus', error.message || 'Error submitting quiz', 'error');
    }
}

function displayResults(score, results) {
    const scoreDisplay = document.getElementById('scoreDisplay');
    scoreDisplay.innerHTML = `
        <h2>${score.percentage}%</h2>
        <p>You got ${score.correct} out of ${score.total} questions correct</p>
    `;

    const resultsDetails = document.getElementById('resultsDetails');
    resultsDetails.innerHTML = results.map((result, index) => `
        <div class="result-item ${result.isCorrect ? 'correct' : 'incorrect'}">
            <h4>Question ${index + 1}</h4>
            <p>${result.question}</p>
            <div class="result-answer ${result.isCorrect ? 'correct' : 'incorrect'}">
                ${result.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.9rem;">
                <strong>Your answer:</strong> ${result.options[result.userAnswer]}<br>
                ${!result.isCorrect ? `<strong>Correct answer:</strong> ${result.options[result.correctAnswer]}` : ''}
            </div>
        </div>
    `).join('');
}

async function deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
        const response = await apiCall(`/quiz/${quizId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Show success message
            const container = document.getElementById('quizzesList');
            const tempMsg = document.createElement('div');
            tempMsg.style.cssText = 'text-align: center; padding: 1rem; background: #d1fae5; color: #065f46; border-radius: 8px; margin-bottom: 1rem;';
            tempMsg.textContent = 'Quiz deleted successfully!';
            container.insertBefore(tempMsg, container.firstChild);
            
            // Reload quizzes
            await loadUserQuizzes();
            
            // Remove success message after a moment
            setTimeout(() => {
                if (tempMsg.parentNode) {
                    tempMsg.remove();
                }
            }, 2000);
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to delete quiz');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting quiz: ' + (error.message || 'Unknown error'));
    }
}

// Utility Functions
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.add('show');
}

function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type} show`;
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
    });
}

function clearStatus() {
    document.getElementById('generateStatus').classList.remove('show');
}

// Make functions available globally
window.showQuiz = showQuiz;
window.deleteQuiz = deleteQuiz;

