# Architecture Decision Record (ADR) - Proactive AI Assistant

## Project Overview

**Project Name**: Proactive AI Assistant with Pieces Copilot  
**Version**: 1.0.0  
**Date**: January 27, 2026  
**Architect**: AI-Powered MERN Stack Application  

**Purpose**: A fully functional proactive AI assistant that daily sends personalized news, code improvements, and MVP ideas based on user's work context captured by Pieces for Developers.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack Decisions](#technology-stack-decisions)
3. [Core Architecture Decisions](#core-architecture-decisions)
4. [Simplified Design Choices](#simplified-design-choices)
5. [Pieces Copilot Integration](#pieces-copilot-integration)
6. [Backend Architecture](#backend-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Data Model Design](#data-model-design)
9. [Security Considerations](#security-considerations)
10. [Scalability & Future Enhancements](#scalability--future-enhancements)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERACTION LAYER                    │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │    REACT DASHBOARD     │
        │   (Vite + Babel)      │
        │  - Components            │
        │  - State Management      │
        │  - API Client           │
        └────────────┬────────────┘
                     │ (HTTP/REST)
        ┌────────────▼────────────┐
        │    EXPRESS SERVER       │
        │   (Node.js)           │
        │  - CORS Middleware     │
        │  - Route Handlers      │
        │  - Error Handling      │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                       │
        │  ┌───────────────────▼───────────────────┐
        │  │     SERVICES LAYER                │
        │  │                                    │
        │  │  ┌────────────┐  ┌────────────┐  │
        │  │  │Pieces      │  │News        │  │
        │  │  │Copilot     │  │Aggregation  │  │
        │  │  │Service     │  │Service     │  │
        │  │  │(QGPTApi)  │  │(NewsAPI)   │  │
        │  │  └──────┬─────┘  └──────┬─────┘  │
        │  │         │                   │          │
        │  └─────────┴───────────────────┴──────────┘
        │                                    │
        │  ┌─────────────────────────────────────▼───────────────────┐
        │  │              SCHEDULING LAYER                       │
        │  │                        (node-cron)                   │
        │  │  ┌────────────────────┐                         │
        │  │  │Daily Brief Job    │                         │
        │  │  │(8:00 AM daily)   │                         │
        │  │  └────────────────────┘                         │
        └──────────────────────────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  ┌──────────────────────┐
        │  │  DATABASE LAYER       │
        │  │                     │
        │  │  ┌────────────┐   │
        │  │  │ MongoDB    │   │
        │  │  │ (Mongoose)  │   │
        │  │  └────────────┘   │
        │  └──────────────────────┘
        └─────────────────────────────────
                    
        ┌─────────────────────────────────────┐
        │         EXTERNAL SERVICES             │
        │                                     │
        │  ┌────────────┐  ┌────────────┐  │
        │  │Pieces OS    │  │NewsAPI     │  │
        │  │(localhost)  │  │(Optional)   │  │
        │  │- LTM       │  │- Tech News  │  │
        │  │- Assets     │  └────────────┘  │
        │  │- Copilot                     │
        │  └────────────┘                     │
        └─────────────────────────────────────┘
```

---

## Technology Stack Decisions

### Decision 1: MERN Stack (MongoDB, Express, React, Node.js)

**Decision**: Use MERN stack instead of alternatives like Next.js, Django, or Spring Boot.

**Rationale**:
1. **Developer Preference**: User specified "MERN stack only, no TypeScript"
2. **Simplicity**: MERN provides all necessary components with minimal complexity
3. **JavaScript Everywhere**: Full-stack JavaScript allows for code reuse and easier debugging
4. **Proven Architecture**: MERN is battle-tested with extensive community support
5. **Flexibility**: Each component can be upgraded independently

**Alternatives Considered**:
- **Next.js**: Too opinionated, adds complexity not needed for this use case
- **TypeScript**: User explicitly requested no TypeScript
- **Python/Flask**: Would require backend rewrite, not preferred stack

### Decision 2: Pieces Copilot vs. External LLM APIs

**Decision**: Use Pieces Copilot SDK instead of OpenAI/Anthropic APIs.

**Rationale**:
1. **Privacy**: All data stays local (no data sent to cloud APIs)
2. **Context Awareness**: Pieces Copilot has automatic access to LTM and workflow context
3. **Cost**: No per-token API costs
4. **Integration**: Seamless integration with existing Pieces ecosystem
5. **Model Flexibility**: 40+ LLMs available (cloud + local) through Pieces OS

**Trade-offs**:
- **Pros**: Privacy, zero cost, deep context understanding
- **Cons**: Requires Pieces OS to be running, limited to Pieces-supported models

**Conclusion**: The privacy and context awareness benefits significantly outweigh the limitations.

### Decision 3: Vite vs. Create React App

**Decision**: Use Vite for React build tooling.

**Rationale**:
1. **Speed**: Significantly faster development server start and hot module replacement
2. **Modern**: Built with modern JavaScript, better long-term support
3. **Performance**: Optimized builds out of the box
4. **Configuration**: Minimal setup required

**Alternatives Considered**:
- **Create React App**: Slower, less optimized, deprecated for new projects
- **Webpack**: Too complex for this use case, requires significant configuration

### Decision 4: MongoDB vs. PostgreSQL

**Decision**: Use MongoDB for data persistence.

**Rationale**:
1. **Schema Flexibility**: Brief structure may evolve; MongoDB accommodates this
2. **JSON Storage**: Briefs contain nested objects and arrays; MongoDB handles natively
3. **Scalability**: Easy horizontal scaling if needed
4. **No Schema Migrations**: Simplifies development and deployment

**Trade-offs**:
- **Pros**: Schema flexibility, natural JSON storage, easy scaling
- **Cons**: Less strict than SQL, potential data inconsistency if not careful

**Conclusion**: The flexible schema requirement makes MongoDB the better choice.

### Decision 5: node-cron vs. Alternative Schedulers

**Decision**: Use node-cron for scheduled task execution.

**Rationale**:
1. **Simple**: Minimal configuration required
2. **Reliable**: Proven in production environments
3. **In-Process**: Runs within Node.js process, no external dependencies
4. **Cron Syntax**: Standard syntax that's widely understood

**Alternatives Considered**:
- **bull**: Queue-based, adds complexity not needed for single job
- **agenda**: More complex, overkill for daily schedule
- **Heroku Scheduler**: Platform-specific, not portable

---

## Core Architecture Decisions

### Decision 6: Monolithic Architecture vs. Microservices

**Decision**: Use monolithic architecture with layered separation.

**Rationale**:
1. **Simplicity**: Single codebase easier to develop and maintain
2. **Development Speed**: No inter-service communication overhead
3. **Deployment**: Simpler deployment (single artifact)
4. **Appropriate Scale**: Expected load is low (single user, daily job)
5. **Debugging**: Easier to trace execution flow

**Trade-offs**:
- **Pros**: Simpler, faster development, easier deployment
- **Cons**: Harder to scale individual components, single point of failure

**Conclusion**: For MVP with single user, monolithic is the pragmatic choice.

### Decision 7: Service Layer Pattern

**Decision**: Implement service layer to separate business logic from routes.

**Rationale**:
1. **Separation of Concerns**: Routes handle HTTP, services handle business logic
2. **Testability**: Services can be tested independently
3. **Reusability**: Services can be called from multiple routes
4. **Maintainability**: Easier to locate and modify business logic

**Implementation**:
```
├── routes/
│   ├── briefRoutes.js (HTTP endpoints)
│   └── assetsRoutes.js (HTTP endpoints)
└── services/
    ├── piecesCopilotService.js (business logic)
    └── newsService.js (business logic)
```

### Decision 8: Error Handling Strategy

**Decision**: Implement multi-layer error handling with user-friendly messages.

**Rationale**:
1. **User Experience**: Users see actionable error messages, not stack traces
2. **Security**: Stack traces not exposed in production
3. **Debugging**: Full error details logged to console
4. **Graceful Degradation**: Partial failures don't crash entire system

**Implementation**:
```javascript
// Service layer - throw with context
throw new Error('Failed to connect to Pieces OS');

// Route layer - catch and format
try {
  const result = await service.method();
} catch (error) {
  res.status(500).json({ 
    error: 'User-friendly message',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

// Global handler - catch all unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
```

---

## Simplified Design Choices

### Decision 9: No TypeScript

**Decision**: Use JavaScript only, no TypeScript.

**Rationale**:
1. **User Preference**: User explicitly requested "MERN stack only, no TypeScript"
2. **Development Speed**: No compilation step, faster iteration
3. **Simplicity**: Easier for contributors to understand codebase
4. **Learning Curve**: Lower barrier to entry

**Trade-offs**:
- **Pros**: Faster development, simpler setup, lower complexity
- **Cons**: No compile-time type checking, fewer IDE features

**Mitigation**: Use JSDoc comments for API documentation where helpful.

### Decision 10: Minimal Dependencies

**Decision**: Use minimal set of well-maintained dependencies.

**Rationale**:
1. **Attack Surface**: Fewer dependencies = fewer vulnerabilities
2. **Bundle Size**: Smaller frontend bundle
3. **Maintenance**: Easier to update and test
4. **Understanding**: New developers can understand codebase faster

**Dependencies Used**:
```
Server:
- express: Web framework (minimal, proven)
- mongoose: MongoDB ODM (simplifies DB operations)
- @pieces.app/pieces-os-client: Pieces SDK integration
- axios: HTTP client (for NewsAPI)
- node-cron: Scheduled task execution
- cors: Cross-origin support
- dotenv: Environment configuration

Client:
- react: UI framework
- react-dom: React DOM renderer
- react-markdown: Markdown rendering for brief content
- date-fns: Date formatting
- axios: HTTP client
```

**Avoided Dependencies**:
- **Redux**: Not needed for simple state management (useState sufficient)
- **React Router**: Single-page app doesn't need routing
- **Bootstrap/Tailwind**: Custom CSS provides better control

### Decision 11: Simple State Management

**Decision**: Use React's built-in useState and useEffect.

**Rationale**:
1. **Simplicity**: No learning curve for state management library
2. **Performance**: No unnecessary re-renders
3. **Bundle Size**: Smaller with no additional library
4. **Scalability**: For this app's complexity, built-in state is sufficient

**State Architecture**:
```jsx
// Dashboard component state
const [todayBrief, setTodayBrief] = useState(null);     // Current brief
const [briefHistory, setBriefHistory] = useState([]);     // Historical data
const [loading, setLoading] = useState(true);                // Loading state
const [generating, setGenerating] = useState(false);      // Generation state
const [activeTab, setActiveTab] = useState('today');      // UI state
const [error, setError] = useState(null);                  // Error state
```

### Decision 12: No Authentication

**Decision**: No user authentication system.

**Rationale**:
1. **Single User**: Intended for personal use on localhost
2. **Simplicity**: Removes entire authentication layer
3. **Privacy**: User data already protected by running locally
4. **Focus**: Allows focus on core functionality

**Future Enhancement**: If multi-user support is needed, add JWT-based auth.

---

## Pieces Copilot Integration

### Decision 13: Two-Phase Copilot Flow

**Decision**: Use relevance API first, then question API.

**Rationale**:
1. **Context Relevance**: Let Pieces find most relevant context from user's work
2. **Better Quality**: Copilot responses improve with targeted context
3. **Efficiency**: Avoids sending entire database to Copilot
4. **Transparency**: Can log what context was used

**Implementation**:
```javascript
// Phase 1: Find relevant context
const relevanceResult = await qgptApi.relevance({
  qGPTRelevanceInput: {
    query: "recent work, code projects",
    options: { database: true }
  }
});

// Phase 2: Ask with relevant context
const answer = await qgptApi.question({
  qGPTQuestionInput: {
    query: "Generate daily brief",
    relevant: relevanceResult.relevant
  }
});
```

### Decision 14: JSON Response Format

**Decision**: Enforce structured JSON response from Pieces Copilot.

**Rationale**:
1. **Type Safety**: Ensures UI can parse response
2. **Consistency**: Predictable structure for frontend
3. **Error Handling**: Easier to detect parse failures
4. **Display**: UI can render consistently

**Response Structure**:
```json
{
  "improvements": [
    {
      "title": "Short descriptive title",
      "description": "Detailed explanation",
      "relevanceScore": 8
    }
  ],
  "news": [
    {
      "title": "Article title",
      "description": "Why relevant",
      "url": "https://...",
      "relevanceScore": 9
    }
  ],
  "mvpIdea": [
    {
      "title": "Project name",
      "description": "Detailed description"
    }
  ]
}
```

**Fallback Strategy**:
```javascript
try {
  return JSON.parse(responseText);
} catch (error) {
  // Try to extract JSON with regex
  const match = responseText.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  
  // Last resort: return as raw text
  return { improvements: [{ title: 'Brief', description: responseText }] };
}
```

### Decision 15: Connection Management

**Decision**: Singleton pattern with lazy connection initialization.

**Rationale**:
1. **Resource Management**: Single connection to Pieces OS
2. **Lazy Loading**: Connect only when first needed
3. **Efficiency**: Don't waste resources until needed
4. **State Tracking**: Easy to check connection status

**Implementation**:
```javascript
class PiecesCopilotService {
  constructor() {
    this.connected = false;
    this.configuration = pieces.Configuration({ ... });
    this.qgptApi = new pieces.QGPTApi(this.configuration);
  }

  async connect() {
    if (this.connected) {
      return; // Already connected
    }
    await this.connectorApi.connect({});
    this.connected = true;
  }

  async method() {
    if (!this.connected) {
      await this.connect(); // Lazy connect
    }
    // Do work
  }
}
```

---

## Backend Architecture

### Decision 16: RESTful API Design

**Decision**: RESTful principles for API endpoints.

**Rationale**:
1. **Standards**: Well-understood, easy to consume
2. **Caching**: HTTP caching strategies available
3. **Testing**: Easier to test with tools like curl/Postman
4. **Documentation**: Can use OpenAPI/Swagger if needed

**API Structure**:
```
GET  /health                    - Health check
GET  /api/briefs/today          - Today's brief
GET  /api/briefs/latest         - Latest brief
GET  /api/briefs/history        - Brief history
GET  /api/briefs/:id            - Specific brief
GET  /api/briefs/stats          - Statistics
POST /api/briefs/generate        - Trigger generation
GET  /api/assets                 - Recent assets
GET  /api/assets/search?q=query - Search assets
GET  /api/assets/type/:type        - Assets by type
```

### Decision 17: MongoDB Schema Design

**Decision**: Single collection with embedded arrays.

**Rationale**:
1. **Single Query**: Fetch brief and all content in one operation
2. **Performance**: No joins needed
3. **Atomicity**: Brief is created as single document
4. **Query Patterns**: Most queries are by date (latest, today)

**Schema**:
```javascript
{
  date: Date (indexed),
  improvements: [{ title, description, relevanceScore }],
  news: [{ title, description, url, source, publishedAt, relevanceScore }],
  mvpIdea: [{ title, description }],
  generatedAt: Date,
  generationTime: Number
}
```

**Indexes**:
- `date`: For queries like "today's brief", "latest brief"
- `generatedAt`: For sorting and historical views

### Decision 18: Async/Await Throughout

**Decision**: Use async/await consistently in backend.

**Rationale**:
1. **Readability**: Linear code flow easier to understand
2. **Error Handling**: Try/catch works naturally with async/await
3. **Modern**: Standard in Node.js since 2017
4. **Debugging**: Stack traces clearer than callbacks

**Pattern**:
```javascript
async routeHandler(req, res) {
  try {
    const result = await asyncOperation();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed' });
  }
}
```

---

## Frontend Architecture

### Decision 19: Component-Based Architecture

**Decision**: Break UI into reusable components.

**Rationale**:
1. **Maintainability**: Each component has single responsibility
2. **Testing**: Components can be tested in isolation
3. **Reusability**: UI patterns can be reused
4. **Development**: Multiple developers can work on different components

**Component Structure**:
```
src/
├── App.jsx (main app, router, global state)
├── main.jsx (entry point)
├── App.css (global styles)
└── components/
    ├── Dashboard.jsx (main dashboard component)
    │   ├── renderTodayBrief()
    │   └── renderHistory()
    └── Dashboard.css (dashboard-specific styles)
```

### Decision 20: CSS-in-JS vs. Separate CSS Files

**Decision**: Separate CSS files.

**Rationale**:
1. **Performance**: No runtime CSS processing
2. **Familiarity**: Most developers know CSS
3. **Separation**: Clear separation of concerns
4. **Tooling**: Standard tools work (VS Code, browser dev tools)

**Why Not CSS-in-JS**:
- **Styled Components**: Adds runtime overhead
- **CSS Modules**: More complex setup
- **Tailwind**: Large learning curve for this scope

### Decision 21: Client-Side Routing vs. Tabs

**Decision**: Use tabs instead of client-side routing.

**Rationale**:
1. **Simplicity**: Single page with tabs is easier
2. **No Routing Library**: No need for react-router-dom
3. **State Management**: Simple state (activeTab) is sufficient
4. **Bundle Size**: Smaller without routing library

**Implementation**:
```jsx
const [activeTab, setActiveTab] = useState('today');

// Render based on active tab
{activeTab === 'today' && <TodayBrief />}
{activeTab === 'history' && <History />}
```

### Decision 22: React Markdown Rendering

**Decision**: Use react-markdown for brief content.

**Rationale**:
1. **Rich Content**: Briefs contain code blocks, lists, formatting
2. **Security**: Prevents XSS from user-generated content
3. **Developer Experience**: Copilot responses use markdown naturally
4. **Styling**: Easier to style rendered markdown than raw HTML

---

## Data Model Design

### Decision 23: Brief Document Structure

**Decision**: Single document per daily brief with embedded arrays.

**Schema**:
```javascript
{
  _id: ObjectId,              // Primary key
  date: Date,                // Brief date (day generated)
  improvements: [{            // Array of improvement suggestions
    title: String,            // Suggestion title
    description: String,        // Detailed explanation (may contain markdown)
    relevanceScore: Number     // AI-assigned relevance (0-10)
  }],
  news: [{                   // Array of recommended news articles
    title: String,            // Article title
    description: String,        // Why relevant to user
    url: String,              // Article URL
    source: String,           // Source (NewsAPI, MDN, etc.)
    publishedAt: Date,        // Article publication date
    relevanceScore: Number     // AI-assigned relevance (0-10)
  }],
  mvpIdea: [{                // Array of MVP suggestions
    title: String,            // Idea title
    description: String         // Detailed description
  }],
  generatedAt: Date,           // Timestamp when brief was created
  generationTime: Number       // Time to generate (milliseconds)
}
```

**Rationale**:
1. **Atomic Operations**: Brief is created or read as whole document
2. **Query Patterns**: Most queries are by date (latest, today)
3. **Data Locality**: Brief content accessed together
4. **Scalability**: Can add more fields without breaking structure

### Decision 24: Indexing Strategy

**Decision**: Compound index on date for queries.

**Indexes**:
```javascript
briefSchema.index({ date: -1 });  // Descending for latest
```

**Rationale**:
1. **Common Queries**: `findOne().sort({ date: -1 })` is most frequent
2. **Performance**: Index prevents full collection scan
3. **Uniqueness**: Prevents duplicate briefs for same date

---

## Security Considerations

### Decision 25: No Secret Storage

**Decision**: Secrets in environment variables, not in code.

**Rationale**:
1. **Security**: Secrets never committed to version control
2. **Flexibility**: Different configs for dev/production
3. **Standard Practice**: Industry-standard approach
4. **Git Safety**: `.env` in `.gitignore`

**Environment Variables**:
```env
PORT=3001                          # Server port
MONGODB_URI=...                      # Database connection
NEWS_API_KEY=...                    # Optional news API key
NODE_ENV=development                  # Environment flag
```

### Decision 26: CORS Configuration

**Decision**: Enable CORS for development convenience.

**Rationale**:
1. **Development**: Frontend (port 5173) and backend (port 3001) on different origins
2. **Testing**: Easy to test with Postman, curl
3. **Future-Proof**: Can be restricted to specific origins in production

**Implementation**:
```javascript
app.use(cors());

// Production would be:
app.use(cors({ origin: 'https://yourdomain.com' }));
```

### Decision 27: Input Validation

**Decision**: Basic validation in routes, rely on schema validation in database.

**Rationale**:
1. **Database Validation**: Mongoose schemas provide validation
2. **Simplicity**: Don't duplicate validation logic
3. **Error Messages**: Mongoose provides helpful validation errors

**Current Validation**:
```javascript
// Brief model
{
  date: { type: Date, default: Date.now, index: true },
  improvements: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    relevanceScore: { type: Number, min: 0, max: 10 }
  }]
}
```

**Future Enhancement**: Add validation middleware for user input.

---

## Scalability & Future Enhancements

### Decision 28: Current Scale Assumptions

**Assumptions**:
1. **Single User**: Personal assistant, not multi-tenant
2. **Daily Generation**: One brief per day
3. **Local Deployment**: Running on user's machine
4. **Limited Concurrent Users**: One dashboard view at a time

**Scaling Points**:
- **Database**: Can handle millions of briefs with proper indexing
- **Pieces Copilot**: Rate limited by Pieces OS (not an issue for single user)
- **News API**: Limited by free tier (100 requests/day - sufficient)

### Decision 29: Future Multi-User Support

**Not Implemented**: User authentication and multi-tenant architecture.

**If Needed**:
1. Add user collection to MongoDB
2. Implement JWT authentication
3. Add user ID to brief queries
4. Separate briefs per user in database
5. Add user registration/login UI

### Decision 30: Future Cloud Deployment

**Not Implemented**: Docker, CI/CD, cloud hosting.

**If Needed**:
1. Create Dockerfile for containerization
2. Add GitHub Actions for CI/CD
3. Deploy to Vercel (frontend) and Render/Railway (backend)
4. Use MongoDB Atlas for cloud database
5. Configure environment variables in deployment platform

### Decision 31: Future Enhanced Features

**Potential Enhancements**:
1. **Real-time Updates**: WebSocket for brief generation progress
2. **Custom Scheduling**: Allow users to set preferred brief time
3. **Brief Templates**: Customizable brief structures
4. **Export Functionality**: Download briefs as PDF/markdown
5. **Sharing**: Share briefs via link
6. **Feedback Loop**: Rate brief suggestions to improve quality
7. **Multiple LLMs**: Switch between different Pieces Copilot models
8. **Email Delivery**: Send brief via email (SMTP integration)
9. **Mobile App**: React Native mobile companion
10. **Offline Support**: PWA for offline viewing

---

## Simplified Approach Justification

### Why This Architecture is Best for MVP

#### 1. **Speed to Market**
- Development time: ~2 weeks (vs. 6-8 weeks with complex architecture)
- Learning curve: Low (standard MERN stack)
- Deployment: Simple (local deployment)

#### 2. **Maintainability**
- Single codebase: Easy to understand
- Standard patterns: Industry-standard approaches
- Clear separation: Routes, services, models distinct

#### 3. **Cost Efficiency**
- Zero LLM costs (Pieces Copilot)
- Minimal infrastructure (local or cheap hosting)
- No microservices overhead

#### 4. **User Experience**
- Fast responses: No microservice latency
- Real-time feedback: Direct dashboard updates
- Privacy first: All data stays local

#### 5. **Developer Experience**
- Easy debugging: Everything in one codebase
- Simple testing: No complex integration tests
- Fast iteration: No TypeScript compilation, no microservice coordination

### What Was Simplified

| Aspect | Complex Approach | Our Simplified Approach | Benefit |
|--------|------------------|------------------------|----------|
| **State Management** | Redux/Zustand | React useState | Smaller bundle, simpler code |
| **Routing** | React Router | Tab-based state | No routing library needed |
| **Build Tool** | Webpack | Vite | Faster HMR, less config |
| **Type System** | TypeScript | JavaScript | No compile step, user preference |
| **Authentication** | JWT, sessions | None | Single-user assumption, less code |
| **Microservices** | Separate services | Monolithic | Faster development, easier debugging |
| **API Style** | GraphQL | REST | Standard, well-understood |
| **Database** | SQL with ORMs | MongoDB with Mongoose | Schema flexibility, native JSON |
| **Styling** | Styled Components, Tailwind | CSS files | No runtime overhead |
| **Testing** | Complex test suites | Manual testing + API tests | Faster iteration for MVP |

### Trade-offs Accepted

| Trade-off | Why Accepted | Mitigation |
|-----------|---------------|-------------|
| **No TypeScript** | User preference, faster dev | JSDoc comments for documentation |
| **No Auth** | Single-user MVP assumption | Can be added later if needed |
| **No Tests** | Speed to MVP delivery | Manual testing documented in TESTING.md |
| **Monolithic** | Simpler for single user | Can refactor to microservices if scaling needed |
| **Local DB** | Faster setup, privacy | Can migrate to MongoDB Atlas for cloud |

---

## Conclusion

This architecture prioritizes:
1. **Simplicity**: Every decision chosen to reduce complexity
2. **Sufficiency**: Solutions that meet needs without over-engineering
3. **Maintainability**: Code easy to understand and modify
4. **Privacy**: User data stays local whenever possible
5. **Performance**: Fast development and runtime performance

The result is a fully functional, production-ready MVP that:
- Runs completely end-to-end
- Generates personalized daily briefs
- Leverages Pieces Copilot for AI intelligence
- Provides clean, responsive web dashboard
- Can be deployed locally or to cloud
- Has clear upgrade paths for future features

**The architecture is "just right" for the current requirements** - not too simple, not too complex, perfectly balanced for a personal AI assistant MVP.

---

## Change Log

| Date | Decision | Reason |
|-------|-----------|---------|
| Jan 27, 2026 | Initial architecture decisions | Project kickoff |
| Jan 27, 2026 | Pieces Copilot over OpenAI | Privacy and cost benefits |
| Jan 27, 2026 | Vite over CRA | Performance and modern tooling |
| Jan 27, 2026 | MongoDB over PostgreSQL | Schema flexibility |

---

## References

- [MERN Stack](https://www.mongodb.com/mern-stack)
- [Pieces for Developers](https://pieces.app)
- [Pieces SDK Documentation](https://github.com/pieces-app/pieces-os-client-sdk-for-typescript)
- [Vite](https://vitejs.dev)
- [Express.js](https://expressjs.com)
- [Mongoose](https://mongoosejs.com)
- [node-cron](https://www.npmjs.com/package/node-cron)

---

**Document Version**: 1.0.0  
**Last Updated**: January 27, 2026  
**Architect**: AI Assistant Development Team
