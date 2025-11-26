
# Quiz Generator Web App

A full-stack web application that converts PDFs and text notes into interactive quizzes using AI-powered question generation.

## Features

- 📄 **PDF Upload & Processing**: Upload PDF files and extract text automatically
- 📝 **Text Note Input**: Paste or type notes directly into the app
- 🤖 **AI-Powered Quiz Generation**: Automatically generates multiple-choice questions from content
- ✅ **Interactive Quiz Taking**: Take quizzes with a beautiful, user-friendly interface
- 📊 **Instant Results**: Get immediate feedback with detailed score breakdown
- 💾 **Quiz Management**: Save, view, and manage all your generated quizzes
- 🔐 **User Authentication**: Secure signup/login with JWT tokens

## Tech Stack

### Backend
- Node.js + Express.js
- MongoDB with Mongoose
- JWT Authentication
- PDF parsing (pdf-parse)
- Ollama 3.1 

### Frontend
- Vanilla JavaScript (no framework dependencies)
- Modern CSS with gradients and animations
- Responsive design for mobile and desktop

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Server Configuration
PORT=3000

# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/dbstorage

# JWT & Session Secrets
JWT_SECRET=YOUR_ACCESS_SECRET_KEY
REFRESH_SECRET=YOUR_REFRESH_SECRET_KEY
SECRETKEY=YOUR_EXPRESS_SESSION_SECRET

# Ollama Configuration
USE_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Special Operations
CLEAR_ALL_KEY=YOUR_SECRET_PASSWORD_TO_CLEAR_DB
```


### 3. Start the Server

```bash
npm start
```

The app will be available at `http://localhost:3000`

## Usage

### 1. Sign Up / Login
- Create a new account or login with existing credentials
- All users automatically get access to the quiz-app namespace

### 2. Create a Quiz

**Option A: Upload PDF**
- Click "Create New Quiz"
- Choose a PDF file
- Set quiz title and number of questions
- Click "Generate Quiz"

**Option B: Paste Notes**
- Click "Create New Quiz"
- Paste your notes in the text area
- Set quiz title and number of questions
- Click "Generate Quiz"

### 3. Take Quiz
- View all your quizzes on the dashboard
- Click on any quiz to start taking it
- Answer all questions
- Click "Submit Quiz" to see results

### 4. View Results
- See your score percentage
- Review correct and incorrect answers
- View detailed feedback for each question

## API Endpoints

### Quiz Endpoints

- `POST /quiz/upload` - Upload PDF or text file
- `POST /quiz/generate` - Generate quiz from text (requires auth)
- `GET /quiz/:quizId` - Get quiz by ID (requires auth)
- `GET /quiz/user/all` - Get all user's quizzes (requires auth)
- `POST /quiz/submit` - Submit quiz answers (requires auth)
- `DELETE /quiz/:quizId` - Delete quiz (requires auth)

### Authentication Endpoints

- `POST /auth/signup` - Create new account
- `POST /auth/signin` - Login
- `POST /auth/refreshtoken` - Refresh access token

## File Structure

```
quizgen/
├── public/              # Frontend web app
│   ├── index.html      # Main HTML file
│   ├── styles.css      # Styling
│   └── app.js          # Frontend JavaScript
├── controllers/
│   └── quiz.js         # Quiz controller logic
├── routes/
│   └── quiz.js         # Quiz routes
├── models/
│   └── Storage.js      # Database model (used for quizzes)
└── server.js           # Express server
```

## Quiz Generation

**AI-Powered with Ollama 3.1**

- Runs a local model on your machine

- Generates clear multiple-choice questions

- No cloud service needed



## Data Storage

Quizzes are stored using the existing Storage model with the following structure:
- `app`: "quiz-app"
- `collectionName`: "quizzes" or "attempts"
- `collectionKey`: Unique quiz/attempt ID
- `key`: "data"
- `value`: Quiz/attempt data object

## Security Features

- JWT-based authentication
- Token refresh mechanism
- Rate limiting on all endpoints
- Helmet.js security headers
- File upload validation
- User permission checks

## Troubleshooting

### Quiz generation fails
- Check if your Ollama service runs on localhost
- Confirm the model name matches your .env file
- Ensure the text has at least 100 characters

### File upload issues
- Ensure file is under 10MB
- Only PDF and text files are supported
- Check uploads directory permissions

### Authentication errors
- Tokens expire after 15 minutes (access) or 7 days (refresh)
- App automatically refreshes tokens when needed
- Clear localStorage and login again if issues persist

## Future Enhancements

Potential improvements:
- Support for more file formats (Word, images with OCR)
- Different question types (true/false, short answer)
- Quiz sharing and collaboration
- Quiz analytics and progress tracking
- Export quizzes to PDF
- Custom quiz templates


