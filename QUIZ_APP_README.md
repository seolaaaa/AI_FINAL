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
- OpenAI API integration (optional, with fallback)

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

# OpenAI API (Optional - for better quiz generation)
OPENAI_API_KEY=your_openai_api_key_here

# Special Operations
CLEAR_ALL_KEY=YOUR_SECRET_PASSWORD_TO_CLEAR_DB
```

**Note**: The app works without OpenAI API key, but will use a simpler rule-based quiz generation. For best results, add your OpenAI API key.

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
dbstorage/
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

The app uses two methods for quiz generation:

1. **AI-Powered (with OpenAI API)**: 
   - Uses GPT-3.5-turbo to generate contextual, intelligent questions
   - Better understanding of content and context
   - More natural question phrasing

2. **Rule-Based Fallback (without API)**:
   - Simple fill-in-the-blank style questions
   - Works without external API
   - Good for basic use cases

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
- Check if OpenAI API key is set (optional)
- Ensure text content is sufficient (at least 100 characters recommended)
- Check server logs for detailed error messages

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

## License

ISC

