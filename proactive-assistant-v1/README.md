# Proactive AI Assistant with Pieces Copilot

A fully functional proactive AI assistant that daily sends personalized news, code improvements, and MVP ideas based on your work context captured by Pieces for Developers.

## Features

- 🤖 **Automated Daily Briefs**: Generated at 8:00 AM daily using Pieces Copilot
- 💾 **Context-Aware**: Leverages Pieces Long-Term Memory (LTM) and saved assets
- 📰 **Personalized News**: Tech news recommendations based on your interests
- 💡 **Code Improvements**: Proactive suggestions for your recent code
- 🚀 **MVP Ideas**: Project suggestions based on your work + new trends
- 🔒 **Private & Local**: Uses Pieces Copilot (no data sent to cloud APIs)
- 🎨 **Web Dashboard**: React-based UI to view briefs and history

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + Vite (JavaScript)
- **Database**: MongoDB
- **AI**: Pieces Copilot (via @pieces.app/pieces-os-client)
- **News**: NewsAPI
- **Scheduling**: node-cron

## Quick Start

### Prerequisites

1. Pieces OS installed and running (download from [pieces.app](https://pieces.app))
2. Node.js 18+ installed
3. MongoDB running locally or MongoDB Atlas URI

### Installation

1. Clone and setup:
```bash
cd proactive-assistant

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

2. Configure environment:
```bash
cd server
cp .env.example .env
# Edit .env with your configuration
```

3. Start MongoDB (if using local):
```bash
mongod
```

4. Start the server:
```bash
cd server
npm run dev
```

5. Start the client (in new terminal):
```bash
cd client
npm run dev
```

6. Open http://localhost:5173 in your browser

## Configuration

Create `server/.env` with:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/proactive-assistant
NEWS_API_KEY=your_newsapi_key_here
```

## Usage

1. **View Today's Brief**: Dashboard shows today's generated brief
2. **View History**: Access past briefs in history tab
3. **Manual Trigger**: Click "Generate Brief Now" to trigger immediate generation
4. **Assets**: View and search your Pieces assets

## Project Structure

```
proactive-assistant/
├── server/
│   ├── config/          # Database and app configuration
│   ├── models/          # MongoDB models
│   ├── routes/          # Express API routes
│   ├── services/        # Business logic (Pieces, News, Copilot)
│   ├── jobs/           # Scheduled tasks
│   └── server.js       # Express app entry point
├── client/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.jsx      # Main app
│   │   └── main.jsx     # Entry point
│   └── package.json
└── README.md
```

## License

MIT
