const axios = require('axios');

class NewsService {
  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.baseUrl = 'https://newsapi.org/v2';
    
    this.techKeywords = [
      'programming',
      'software development',
      'web development',
      'JavaScript',
      'React',
      'Node.js',
      'AI',
      'artificial intelligence',
      'machine learning',
      'cloud computing',
      'DevOps',
      'open source',
      'software engineering'
    ];
  }

  async getTechNews(limit = 10) {
    try {
      console.log('🔄 Fetching tech news...');
      
      if (!this.newsApiKey) {
        console.warn('⚠ No NEWS_API_KEY configured, returning fallback news');
        return this.getFallbackNews(limit);
      }

      const query = this.techKeywords.join(' OR ');
      
      const response = await axios.get(`${this.baseUrl}/everything`, {
        params: {
          q: query,
          sortBy: 'publishedAt',
          pageSize: limit * 2,
          language: 'en',
          apiKey: this.newsApiKey
        },
        timeout: 10000
      });
      
      if (response.data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${response.data.message}`);
      }

      const articles = response.data.articles
        .filter(article => article.title && article.description && article.url)
        .slice(0, limit)
        .map(article => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt,
          urlToImage: article.urlToImage
        }));

      console.log(`✓ Fetched ${articles.length} tech news articles`);
      return articles;
    } catch (error) {
      console.error('✗ Error fetching news:', error.message);
      console.log('🔄 Using fallback news...');
      return this.getFallbackNews(limit);
    }
  }

  getFallbackNews(limit = 10) {
    const fallbackArticles = [
      {
        title: 'JavaScript Best Practices 2024',
        description: 'Learn the modern JavaScript best practices for better code quality and performance in 2024.',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
        source: 'MDN Web Docs',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'React 18 New Features Explained',
        description: 'Comprehensive guide to the latest features in React 18 and how to use them effectively.',
        url: 'https://react.dev/blog',
        source: 'React Blog',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'Node.js Performance Optimization',
        description: 'Tips and techniques to optimize your Node.js applications for better performance.',
        url: 'https://nodejs.org/en/docs/guides/simple-profiling/',
        source: 'Node.js Docs',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'MongoDB Schema Design Patterns',
        description: 'Best practices for designing MongoDB schemas that scale and perform well.',
        url: 'https://www.mongodb.com/docs/manual/core/schema/',
        source: 'MongoDB Docs',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'RESTful API Design Principles',
        description: 'Understanding the core principles of designing RESTful APIs with Node.js and Express.',
        url: 'https://restfulapi.net/',
        source: 'RESTful API Guide',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'Async/Await in Modern JavaScript',
        description: 'Mastering asynchronous programming with async/await for better code readability.',
        url: 'https://javascript.info/async',
        source: 'JavaScript.info',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'CSS Grid Layout Tutorial',
        description: 'Complete guide to CSS Grid for creating complex layouts with ease.',
        url: 'https://css-tricks.com/snippets/css/complete-guide-grid/',
        source: 'CSS Tricks',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'TypeScript vs JavaScript: When to Use Which',
        description: 'Comparison of TypeScript and JavaScript with practical examples for decision making.',
        url: 'https://www.typescriptlang.org/docs/handbook/typescript-from-javascript.html',
        source: 'TypeScript Handbook',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'Git Best Practices for Teams',
        description: 'Essential Git workflows and best practices for collaborative development.',
        url: 'https://git-scm.com/docs/gittutorial',
        source: 'Git Documentation',
        publishedAt: new Date().toISOString()
      },
      {
        title: 'Introduction to Docker for Developers',
        description: 'Getting started with Docker for containerizing your development environment.',
        url: 'https://docs.docker.com/get-started/',
        source: 'Docker Docs',
        publishedAt: new Date().toISOString()
      }
    ];

    console.log(`✓ Returning ${Math.min(limit, fallbackArticles.length)} fallback articles`);
    return fallbackArticles.slice(0, limit);
  }

  async getNewsByTopic(topic, limit = 5) {
    try {
      if (!this.newsApiKey) {
        return this.getFallbackNews(limit);
      }

      const response = await axios.get(`${this.baseUrl}/everything`, {
        params: {
          q: topic,
          sortBy: 'publishedAt',
          pageSize: limit,
          language: 'en',
          apiKey: this.newsApiKey
        }
      });

      const articles = response.data.articles
        .filter(article => article.title && article.description && article.url)
        .map(article => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt
        }));

      return articles;
    } catch (error) {
      console.error('✗ Error fetching news by topic:', error.message);
      return [];
    }
  }
}

module.exports = new NewsService();
