const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'pieces';
    this.initProviders();
  }

  initProviders() {
    // z.ai uses OpenAI-compatible API
    if (process.env.ZAI_API_KEY && process.env.ZAI_API_KEY !== 'your_zai_api_key_here') {
      this.zai = new OpenAI({
        apiKey: process.env.ZAI_API_KEY,
        baseURL: 'https://api.z.ai/api/coding/paas/v4/'
      });
      console.log('✓ z.ai provider initialized');
    }
    
    // Google Gemini (new SDK)
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      this.gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      console.log('✓ Gemini provider initialized');
    }
  }

  async generateBrief(context, newsArticles) {
    const prompt = this.buildUniversalPrompt(context, newsArticles);
    
    console.log(`🤖 Generating brief with provider: ${this.provider}`);
    
    switch (this.provider) {
      case 'zai':
        if (!this.zai) {
          throw new Error('z.ai not configured. Please set ZAI_API_KEY in .env');
        }
        return this.generateWithZAI(prompt);
      case 'gemini':
        if (!this.gemini) {
          throw new Error('Gemini not configured. Please set GEMINI_API_KEY in .env');
        }
        return this.generateWithGemini(prompt);
      default:
        // Fall back to pieces - will be handled by piecesCopilotService
        return null;
    }
  }

  // ============================================
  // SIMPLIFIED AGENT-CENTRIC FORMATTING
  // ============================================

  async formatBriefAsJSON(agentAnalysis, news, goals) {
    console.log('📝 Formatting agent analysis into display-ready JSON...');
    
    const goalsText = goals && goals.length > 0
      ? goals.map(g => `• ${g.title}`).join('\n')
      : 'None set';

    const newsText = news && news.length > 0
      ? news.slice(0, 3).map(n => `• ${n.title}`).join('\n')
      : 'No news available';

    const prompt = `Convert this analysis into a structured JSON brief for display.

## ANALYSIS FROM LOCAL AI AGENT:
${agentAnalysis.content || agentAnalysis}

## USER'S GOALS:
${goalsText}

## TODAY'S RELEVANT NEWS:
${newsText}

## OUTPUT FORMAT (strict JSON, no markdown wrapper):
{
  "greeting": "Brief personalized greeting referencing their current work",
  "activitySummary": "2-3 sentences summarizing what they've been working on from the analysis",
  "focusArea": {
    "title": "Their main focus area from the analysis",
    "confidence": "high/medium/low based on how clear the focus is"
  },
  "items": [
    {
      "type": "blocker_solution",
      "title": "Title addressing a specific blocker from the analysis",
      "description": "How to resolve it with specific steps",
      "priority": 9
    },
    {
      "type": "recommendation",
      "title": "Actionable recommendation from the analysis",
      "description": "Why this helps and how to do it",
      "priority": 7
    },
    {
      "type": "insight",
      "title": "Pattern or observation from the analysis",
      "description": "What was noticed about their work",
      "priority": 5
    },
    {
      "type": "quick_tip",
      "title": "Quick win from the analysis",
      "description": "Something they can do in 15 minutes"
    }
  ],
  "quickTip": "One actionable tip from the Quick Wins section",
  "dailyChallenge": {
    "title": "A challenge based on their current work",
    "description": "What to do and why",
    "difficulty": "easy/medium/hard"
  }
}

IMPORTANT:
- Extract and structure information ONLY from the analysis provided
- Do NOT add generic advice not in the analysis
- Include 3-5 items based on what's in the analysis
- Priority: 1-10 (10 = most urgent)
- If the analysis mentions blockers, include them as blocker_solution items`;

    try {
      let result;
      switch (this.provider) {
        case 'zai':
          if (!this.zai) throw new Error('z.ai not configured');
          result = await this.formatWithZAI(prompt);
          break;
        case 'gemini':
          if (!this.gemini) throw new Error('Gemini not configured');
          result = await this.formatWithGemini(prompt);
          break;
        default:
          throw new Error('No AI provider configured for formatting');
      }

      return this.validateFormattedBrief(result);
    } catch (error) {
      console.error('✗ Formatting failed:', error.message);
      return this.generateFallbackFromAnalysis(agentAnalysis);
    }
  }

  async formatWithZAI(prompt) {
    console.log('📡 Formatting with z.ai...');
    
    const response = await this.zai.chat.completions.create({
      model: process.env.ZAI_MODEL || 'glm-4.7',
      messages: [
        {
          role: 'system',
          content: 'You are a JSON formatter. Extract information from the provided analysis and structure it into the requested JSON format. Always respond with valid JSON only, no markdown.'
        },
        { role: 'user', content: prompt }
      ]
    });
    
    const content = response.choices[0].message.content;
    console.log('✓ Formatting complete from z.ai');
    return this.parseJSONResponse(content);
  }

  async formatWithGemini(prompt) {
    console.log('📡 Formatting with Gemini...');
    
    const response = await this.gemini.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt
    });
    
    const text = response.text;
    console.log('✓ Formatting complete from Gemini');
    return this.parseJSONResponse(text);
  }

  validateFormattedBrief(brief) {
    // Ensure required fields exist with defaults
    return {
      greeting: brief.greeting || 'Hello!',
      activitySummary: brief.activitySummary || '',
      focusArea: brief.focusArea || { title: 'General Work', confidence: 'low' },
      items: Array.isArray(brief.items) ? brief.items.map((item, idx) => ({
        id: `item-${idx}`,
        type: item.type || 'recommendation',
        title: item.title || 'Recommendation',
        description: item.description || '',
        priority: Math.min(10, Math.max(1, item.priority || 5)),
        url: item.url || null
      })) : [],
      quickTip: brief.quickTip || '',
      dailyChallenge: brief.dailyChallenge || null,
      reflection: brief.reflection || null
    };
  }

  generateFallbackFromAnalysis(agentAnalysis) {
    const content = agentAnalysis.content || agentAnalysis || '';
    const context = agentAnalysis.contextAvailable || {};
    
    // Check if we have meaningful context data
    const hasData = (context.files || 0) + (context.websites || 0) + (context.activities || 0) > 0;
    
    if (hasData && content.length > 100) {
      // We have context and analysis - use it
      return {
        greeting: 'Hello! Here\'s your activity summary.',
        activitySummary: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
        focusArea: { title: 'Your Recent Work', confidence: 'medium' },
        items: [
          {
            id: 'item-0',
            type: 'insight',
            title: 'Activity Analysis',
            description: content.substring(0, 500),
            priority: 5
          }
        ],
        quickTip: 'Review your recent files and websites for context.',
        dailyChallenge: null,
        reflection: null
      };
    }
    
    // No meaningful data - provide helpful guidance
    return {
      greeting: 'Hello! Pieces is ready to help.',
      activitySummary: 'Pieces is monitoring your activity but needs more data to provide personalized insights. Keep working and check back soon!',
      focusArea: { title: 'Getting Started', confidence: 'low' },
      items: [
        {
          id: 'item-0',
          type: 'tip',
          title: 'Keep Pieces OS Running',
          description: 'Ensure Pieces OS is running in the background. It captures your workflow across browsers, IDEs, and applications to provide contextual recommendations.',
          priority: 7
        },
        {
          id: 'item-1',
          type: 'tip',
          title: 'Use Your Tools Normally',
          description: 'Browse documentation, write code, and work as usual. Pieces will learn your patterns and provide personalized insights.',
          priority: 6
        }
      ],
      quickTip: 'Make sure Pieces OS is running and give it some time to collect activity data.',
      dailyChallenge: {
        title: 'Get Started with Pieces',
        description: 'Use your browser and IDE for 30 minutes with Pieces running to build your activity profile.',
        difficulty: 'easy'
      },
      reflection: null
    };
  }

  // ============================================
  // SIMPLIFIED SUGGESTION FORMATTING
  // ============================================

  async formatSuggestionsAsJSON(agentAnalysis) {
    console.log('📝 Formatting agent analysis into suggestions...');
    
    const prompt = `Extract actionable suggestions from this AI analysis.

## ANALYSIS FROM LOCAL AI AGENT:
${agentAnalysis.content || agentAnalysis}

## OUTPUT FORMAT (strict JSON array):
{
  "suggestions": [
    {
      "type": "tip|reminder|insight|action|warning",
      "title": "Clear, actionable title",
      "description": "2-3 sentences with specific guidance",
      "priority": 7,
      "category": "productivity|code_quality|learning|health|focus|tools|debugging",
      "keywords": ["relevant", "tags"],
      "actions": [
        { "label": "Primary Action", "type": "link", "payload": "https://..." },
        { "label": "Dismiss", "type": "dismiss" }
      ]
    }
  ]
}

RULES:
- Extract 1-3 suggestions ONLY from the analysis provided
- Each suggestion must be specific and actionable
- Do NOT add generic advice not in the analysis
- Priority: 1-10 (10 = most urgent)
- Include at least a dismiss action for each suggestion`;

    try {
      let result;
      switch (this.provider) {
        case 'zai':
          if (!this.zai) throw new Error('z.ai not configured');
          result = await this.formatWithZAI(prompt);
          break;
        case 'gemini':
          if (!this.gemini) throw new Error('Gemini not configured');
          result = await this.formatWithGemini(prompt);
          break;
        default:
          throw new Error('No AI provider configured');
      }

      return this.validateFormattedSuggestions(result);
    } catch (error) {
      console.error('✗ Suggestion formatting failed:', error.message);
      return this.generateFallbackSuggestions({ currentFocus: {} });
    }
  }

  validateFormattedSuggestions(result) {
    const suggestions = result.suggestions || result || [];
    
    if (!Array.isArray(suggestions)) {
      return [];
    }

    return suggestions.map(s => ({
      type: s.type || 'tip',
      title: s.title || 'Suggestion',
      description: s.description || '',
      priority: Math.min(10, Math.max(1, s.priority || 5)),
      category: s.category || 'general',
      keywords: s.keywords || [],
      actions: (s.actions || []).map(a => ({
        label: a.label || 'View',
        type: a.type || 'link',
        payload: a.payload || ''
      }))
    })).slice(0, 3);
  }

  // ============================================
  // ADVANCED MULTI-STAGE BRIEF SYNTHESIS (LEGACY)
  // ============================================

  async synthesizeAdvancedBrief(intelligence, news, goals) {
    console.log('🧪 Synthesizing advanced brief from multi-stage intelligence...');
    
    const prompt = this.buildSynthesisPrompt(intelligence, news, goals);
    
    try {
      let result;
      switch (this.provider) {
        case 'zai':
          if (!this.zai) throw new Error('z.ai not configured');
          result = await this.synthesizeWithZAI(prompt);
          break;
        case 'gemini':
          if (!this.gemini) throw new Error('Gemini not configured');
          result = await this.synthesizeWithGemini(prompt);
          break;
        default:
          throw new Error('No AI provider configured for synthesis');
      }
      
      // Validate and enhance the result
      return this.validateAndEnhanceBrief(result, intelligence.metadata);
    } catch (error) {
      console.error('✗ Synthesis failed:', error.message);
      return this.generateFallbackBrief(intelligence, goals);
    }
  }

  buildSynthesisPrompt(intelligence, news, goals) {
    const { stages, metadata, rawData } = intelligence;
    
    // Format goals
    const goalsText = goals && goals.length > 0
      ? goals.map(g => `• ${g.title}${g.description ? `: ${g.description}` : ''}`).join('\n')
      : 'No specific goals set';

    // Format news
    const newsText = news && news.length > 0
      ? news.slice(0, 5).map(n => `• ${n.title}`).join('\n')
      : 'No news available';

    return `You are an expert productivity assistant creating a highly personalized daily brief.

## INTELLIGENCE FROM PIECES AI (Pre-analyzed by local AI)

### 1. WORK STREAM SUMMARY
${stages.workStream.success ? stages.workStream.content : 'Unable to analyze work stream'}

### 2. TECHNICAL DEEP DIVE
${stages.technical.success ? stages.technical.content : 'Unable to analyze technical context'}

### 3. BROWSER & RESEARCH CONTEXT
${stages.research.success ? stages.research.content : 'Unable to analyze research activity'}

### 4. BLOCKER ANALYSIS
${stages.blockers.success ? stages.blockers.content : 'No blockers identified'}

## USER'S STATED GOALS
${goalsText}

## TODAY'S RELEVANT NEWS
${newsText}

## ACTIVITY METRICS
• Files accessed: ${metadata.filesAccessed || 0}
• Websites visited: ${metadata.websitesVisited || 0}
• Total activities: ${metadata.totalActivities || 0}
• Top applications: ${metadata.topApplications?.map(a => a.name).join(', ') || 'Unknown'}

## RECENT FILES
${rawData.recentFiles?.slice(0, 5).join('\n') || 'None tracked'}

## RECENT WEBSITES
${rawData.recentWebsites?.slice(0, 5).map(w => w.url || w.name).join('\n') || 'None tracked'}

---

## YOUR TASK

Create a **cohesive, actionable daily brief** that:

1. **CONNECTS THE DOTS**: Link insights across all 4 intelligence stages
   - Example: "You were researching X in the browser while working on file Y - here's how to apply what you learned"

2. **ADDRESSES BLOCKERS FIRST**: If blockers were identified, prioritize solutions

3. **ALIGNS WITH GOALS**: Every recommendation should advance their stated goals

4. **IS SPECIFIC, NOT GENERIC**: Reference actual files, URLs, and topics from the intelligence

5. **INCLUDES VARIETY**: Mix different types of content (tips, resources, challenges)

## RESPONSE FORMAT (STRICT JSON)

{
  "greeting": "Warm, personalized greeting that references their current work focus",
  "activitySummary": "2-3 sentences summarizing their work patterns and progress toward goals",
  "focusArea": {
    "title": "Their main focus area right now",
    "confidence": "high/medium/low",
    "evidence": "What data points support this"
  },
  "items": [
    {
      "type": "blocker_solution",
      "title": "Clear title addressing a specific blocker",
      "description": "How to resolve it, with specific steps",
      "priority": 9,
      "relatedTo": "Which intelligence stage this came from"
    },
    {
      "type": "recommendation",
      "title": "Actionable recommendation",
      "description": "Why this helps and how to do it",
      "url": "https://relevant-resource.com",
      "priority": 7,
      "relatedTo": "Connection to their work"
    },
    {
      "type": "insight",
      "title": "Pattern or observation",
      "description": "What you noticed and why it matters",
      "priority": 5
    },
    {
      "type": "quick_tip",
      "title": "Immediate actionable tip",
      "description": "One thing they can do right now"
    },
    {
      "type": "learning",
      "title": "Skill development opportunity",
      "description": "Based on what they're working on",
      "url": "https://learning-resource.com",
      "timeEstimate": "15 min"
    }
  ],
  "dailyChallenge": {
    "title": "Specific challenge aligned with their goals",
    "description": "What to do and why",
    "difficulty": "easy/medium/hard",
    "reward": "What they'll gain"
  },
  "quickTip": "One-liner tip specific to their current work",
  "reflection": {
    "question": "Thought-provoking question about their work",
    "context": "Why this question matters for them"
  }
}

IMPORTANT:
- Generate 4-6 items in the items array
- Every item must reference specific things from the intelligence
- NO generic advice like "take breaks" or "stay hydrated"
- If intelligence is limited, acknowledge it and ask clarifying questions
- Priority: 1-10 (10 = most urgent)`;
  }

  async synthesizeWithZAI(prompt) {
    console.log('📡 Synthesizing with z.ai...');
    
    const response = await this.zai.chat.completions.create({
      model: process.env.ZAI_MODEL || 'glm-4.7',
      messages: [
        {
          role: 'system',
          content: 'You are an expert productivity assistant. Analyze the multi-stage intelligence and create a cohesive, highly personalized brief. Always respond with valid JSON.'
        },
        { role: 'user', content: prompt }
      ]
    });
    
    const content = response.choices[0].message.content;
    console.log('✓ Synthesis complete from z.ai');
    return this.parseJSONResponse(content);
  }

  async synthesizeWithGemini(prompt) {
    console.log('📡 Synthesizing with Gemini...');
    
    const response = await this.gemini.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt
    });
    
    const text = response.text;
    console.log('✓ Synthesis complete from Gemini');
    return this.parseJSONResponse(text);
  }

  validateAndEnhanceBrief(brief, metadata) {
    // Ensure all required fields exist
    const validated = {
      greeting: brief.greeting || 'Good day!',
      activitySummary: brief.activitySummary || 'Your activity has been analyzed.',
      focusArea: brief.focusArea || { title: 'General Development', confidence: 'low', evidence: 'Limited data' },
      items: Array.isArray(brief.items) ? brief.items : [],
      dailyChallenge: brief.dailyChallenge || null,
      quickTip: brief.quickTip || '',
      reflection: brief.reflection || null,
      // Add metadata for frontend
      contextMetadata: {
        filesAccessed: metadata.filesAccessed || 0,
        websitesVisited: metadata.websitesVisited || 0,
        totalActivities: metadata.totalActivities || 0,
        topApplications: metadata.topApplications || [],
        generatedAt: new Date().toISOString()
      }
    };

    // Normalize items
    validated.items = validated.items.map((item, idx) => ({
      id: `item-${idx}`,
      type: item.type || 'recommendation',
      title: item.title || 'Recommendation',
      description: item.description || '',
      url: item.url || null,
      priority: Math.min(10, Math.max(1, item.priority || 5)),
      relatedTo: item.relatedTo || null,
      timeEstimate: item.timeEstimate || null
    }));

    return validated;
  }

  generateFallbackBrief(intelligence, goals) {
    const { metadata, rawData } = intelligence;
    
    return {
      greeting: 'Hello! Your assistant is ready to help.',
      activitySummary: `I detected ${metadata.totalActivities || 0} activities across ${metadata.topApplications?.length || 0} applications.`,
      focusArea: {
        title: 'Getting Started',
        confidence: 'low',
        evidence: 'Limited intelligence available'
      },
      items: [
        {
          id: 'item-0',
          type: 'recommendation',
          title: 'Enable Pieces Screen Capture',
          description: 'For better recommendations, ensure Pieces for Developers has screen capture (WPE) enabled. This helps me understand your work context.',
          priority: 8,
          url: 'https://docs.pieces.app'
        },
        {
          id: 'item-1',
          type: 'quick_tip',
          title: 'Set Your Goals',
          description: 'Add your current goals so I can provide more relevant recommendations aligned with what you want to achieve.',
          priority: 7
        }
      ],
      dailyChallenge: {
        title: 'Configure Your Assistant',
        description: 'Spend 5 minutes setting up your goals and preferences for a more personalized experience.',
        difficulty: 'easy',
        reward: 'Better, more relevant recommendations'
      },
      quickTip: 'Your assistant learns from your activity patterns over time.',
      reflection: null,
      contextMetadata: {
        filesAccessed: metadata?.filesAccessed || 0,
        websitesVisited: metadata?.websitesVisited || 0,
        totalActivities: metadata?.totalActivities || 0,
        topApplications: metadata?.topApplications || [],
        generatedAt: new Date().toISOString()
      }
    };
  }

  async generateSuggestions(context) {
    const prompt = this.buildSuggestionPrompt(context);
    
    console.log(`🤖 Generating suggestions with provider: ${this.provider}`);
    
    try {
      let result;
      
      switch (this.provider) {
        case 'zai':
          if (!this.zai) {
            console.warn('z.ai not configured, falling back to basic suggestions');
            return this.generateFallbackSuggestions(context);
          }
          result = await this.generateSuggestionsWithZAI(prompt);
          break;
        case 'gemini':
          if (!this.gemini) {
            console.warn('Gemini not configured, falling back to basic suggestions');
            return this.generateFallbackSuggestions(context);
          }
          result = await this.generateSuggestionsWithGemini(prompt);
          break;
        default:
          return this.generateFallbackSuggestions(context);
      }
      
      // Validate and normalize suggestions
      if (result && Array.isArray(result.suggestions)) {
        return this.normalizeSuggestions(result.suggestions);
      }
      
      return [];
    } catch (error) {
      console.error('✗ Error generating suggestions:', error.message);
      return this.generateFallbackSuggestions(context);
    }
  }

  async generateSuggestionsWithZAI(prompt) {
    console.log('📡 Calling z.ai API for suggestions...');
    
    const response = await this.zai.chat.completions.create({
      model: process.env.ZAI_MODEL || 'glm-4.7',
      messages: [
        { 
          role: 'system', 
          content: 'You are a proactive AI assistant that analyzes developer activity and provides helpful, actionable suggestions. Always respond with valid JSON.' 
        },
        { role: 'user', content: prompt }
      ]
    });
    
    const content = response.choices[0].message.content;
    console.log('✓ Received suggestions from z.ai');
    
    return this.parseJSONResponse(content);
  }

  async generateSuggestionsWithGemini(prompt) {
    console.log('📡 Calling Gemini API for suggestions...');
    
    const response = await this.gemini.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const text = response.text;
    console.log('✓ Received suggestions from Gemini');
    
    return this.parseJSONResponse(text);
  }

  normalizeSuggestions(suggestions) {
    return suggestions.map(s => ({
      type: s.type || 'tip',
      title: s.title || 'Suggestion',
      description: s.description || '',
      priority: Math.min(10, Math.max(1, s.priority || 5)),
      category: s.category || 'general',
      keywords: s.keywords || [],
      actions: (s.actions || []).map(a => ({
        label: a.label || 'View',
        type: a.type || 'link',
        payload: a.payload || ''
      }))
    })).slice(0, 3); // Max 3 suggestions per run
  }

  generateFallbackSuggestions(context) {
    // Generate basic suggestions without AI when providers unavailable
    const suggestions = [];
    const focus = context.currentFocus || {};
    
    // Suggest based on current application
    if (focus.currentApplication) {
      const app = focus.currentApplication.toLowerCase();
      
      if (app.includes('code') || app.includes('cursor') || app.includes('vs')) {
        suggestions.push({
          type: 'tip',
          title: 'Take a Short Break',
          description: `You've been coding for a while. Consider taking a 5-minute break to rest your eyes and stretch.`,
          priority: 6,
          category: 'health',
          actions: [
            { label: 'Snooze 30 min', type: 'snooze', payload: '30' },
            { label: 'Dismiss', type: 'dismiss' }
          ]
        });
      }
      
      if (app.includes('browser') || app.includes('chrome') || app.includes('firefox')) {
        suggestions.push({
          type: 'insight',
          title: 'Bookmark Useful Pages',
          description: 'If you find useful resources while browsing, consider saving them to Pieces for future reference.',
          priority: 5,
          category: 'productivity',
          actions: [
            { label: 'Dismiss', type: 'dismiss' }
          ]
        });
      }
    }
    
    // Suggest based on recent files
    if (focus.recentFiles && focus.recentFiles.length > 0) {
      const file = focus.recentFiles[0];
      if (file.includes('.test') || file.includes('.spec')) {
        suggestions.push({
          type: 'tip',
          title: 'Run Your Tests',
          description: 'You\'ve been working on test files. Make sure to run the test suite to verify everything passes.',
          priority: 7,
          category: 'testing',
          actions: [
            { label: 'Dismiss', type: 'dismiss' }
          ]
        });
      }
    }
    
    // Default suggestion if nothing else
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'tip',
        title: 'Stay Focused',
        description: 'Your AI assistant is monitoring your activity. It will provide personalized suggestions as you work.',
        priority: 3,
        category: 'general',
        actions: [
          { label: 'Dismiss', type: 'dismiss' }
        ]
      });
    }
    
    return suggestions;
  }

  buildSuggestionPrompt(rawContext) {
    // Check if we have meaningful data
    const hasVisionData = rawContext.visionEvents && rawContext.visionEvents !== '[]';
    const hasActivities = rawContext.activities && rawContext.activities !== '[]';
    const hasSummaries = rawContext.workstreamSummaries && rawContext.workstreamSummaries !== '[]';
    const hasAnchors = rawContext.anchors && rawContext.anchors !== '[]';
    const hasAssets = rawContext.assets && rawContext.assets !== '[]';
    const hasAgentInsights = rawContext.agentInsights && rawContext.agentInsights !== '[]';
    
    const dataAvailable = [hasVisionData, hasActivities, hasSummaries, hasAnchors, hasAssets, hasAgentInsights]
      .filter(Boolean).length;

    return `
You are a proactive AI assistant analyzing a developer's CURRENT work context from RAW API data and AI-summarized insights.
Your job is to parse this JSON data, understand what they're working on, and provide 1-3 helpful suggestions.

## HIGH-LEVEL INSIGHTS FROM PIECES AI AGENT
${rawContext.agentInsights}

## RAW DATA FROM PIECES FOR DEVELOPERS

### Vision/Screen Events:
${rawContext.visionEvents}

### Recent Activities:
${rawContext.activities}

### Workstream Summaries:
${rawContext.workstreamSummaries}

### Anchors (files/locations):
${rawContext.anchors}

### Websites Visited:
${rawContext.websites}

### Saved Assets:
${rawContext.assets}

### Recent Conversations:
${rawContext.conversations}

## YOUR TASK

1. **Parse the AGENT INSIGHTS and RAW DATA above** to identify:
   - What the user is currently focused on (use Agent Insights as your primary source of truth)
   - What browser tabs, files, or resources they are using
   - Any roadblocks or specific challenges identified by the agent
   - Helpful next steps or relevant resources based on their active work

2. **Generate 1-3 suggestions** that are:
   - SPECIFIC to what they're actually doing (reference specific files, URLs, or topics)
   - Immediately actionable
   - Helpful without being generic

${dataAvailable < 2 ? `
**IMPORTANT**: The context data appears limited. If you cannot determine what the user is working on:
- Generate only 1 suggestion asking them to share what they're working on
- Do NOT generate generic productivity tips like "take a break" or "stay focused"
- Suggest they ensure Pieces for Developers WPE (screen capture) is enabled
` : ''}

### Suggestion Types:
- **tip**: Helpful advice specific to what they're doing
- **reminder**: Something related to their current work they might have forgotten
- **insight**: Observation about their specific work patterns
- **action**: Something they should do now based on their context
- **warning**: Potential issue with what they're working on

### Categories:
productivity, code_quality, learning, health, focus, tools, collaboration, documentation, testing, debugging, optimization, general

### Action Buttons (each suggestion needs at least one):
- **link**: Opens a URL (use real, relevant URLs)
- **copy**: Copies useful text to clipboard
- **dismiss**: Dismisses the suggestion
- **snooze**: Hides for X minutes (payload = minutes as string)

## RESPONSE FORMAT (STRICT JSON ONLY)

{
  "suggestions": [
    {
      "type": "tip",
      "title": "Specific, clear title referencing their actual work",
      "description": "Why this matters for what they're doing right now (2-3 sentences)",
      "priority": 7,
      "category": "code_quality",
      "keywords": ["actual", "topics", "from", "their", "context"],
      "actions": [
        { "label": "Relevant Action", "type": "link", "payload": "https://relevant-url.com" },
        { "label": "Snooze 30m", "type": "snooze", "payload": "30" }
      ]
    }
  ]
}

### CRITICAL RULES:
- Reference SPECIFIC things from the data (file names, URLs, topics, applications)
- Do NOT give generic advice if you have specific context
- If data is empty/unclear, ask what they're working on instead of generic tips
- Maximum 3 suggestions
- Priority 1-10 (higher = more urgent)
- Descriptions under 150 characters
`.trim();
  }

  async generateWithZAI(prompt) {
    console.log('📡 Calling z.ai API (GLM-4.7)...');
    
    const response = await this.zai.chat.completions.create({
      model: process.env.ZAI_MODEL || 'glm-4.7',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful personal assistant that provides personalized daily briefs. Always respond with valid JSON.' 
        },
        { role: 'user', content: prompt }
      ]
    });
    
    const content = response.choices[0].message.content;
    console.log('✓ Received response from z.ai');
    
    return this.parseJSONResponse(content);
  }

  async generateWithGemini(prompt) {
    console.log('📡 Calling Gemini API...');
    
    const response = await this.gemini.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const text = response.text;
    console.log('✓ Received response from Gemini');
    
    return this.parseJSONResponse(text);
  }

  parseJSONResponse(text) {
    try {
      // Try direct parse first
      return JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from markdown code blocks or text
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (e2) {
          // Continue to next attempt
        }
      }
      
      // Try to find JSON object in the text
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch (e3) {
          console.error('✗ Failed to parse JSON from response');
          throw new Error('Failed to parse AI response as JSON');
        }
      }
      
      throw new Error('No valid JSON found in AI response');
    }
  }

  buildUniversalPrompt(context, newsArticles) {
    // User preferences and goals (highest priority for personalization)
    const userPrefs = context.userPreferences || {};
    const goals = userPrefs.goals || [];
    const preferences = userPrefs.preferences || {};
    const recentConversations = userPrefs.recentConversationTopics || [];
    
    // Build goals section
    const goalsSection = goals.length > 0
      ? goals.map(g => `- **${g.title}** (Priority: ${g.priority}/5)${g.description ? `: ${g.description}` : ''}`).join('\n')
      : 'No goals set';

    // Build preferences section
    const likedCategories = preferences.likedCategories || [];
    const dislikedCategories = preferences.dislikedCategories || [];
    const prefsSection = likedCategories.length > 0 || dislikedCategories.length > 0
      ? `Liked: ${likedCategories.join(', ') || 'None'}\nDisliked: ${dislikedCategories.join(', ') || 'None'}`
      : 'No preference history yet';

    // Build saved assets section (lower priority - explicitly saved items)
    const assetsSection = context.assets && context.assets.length > 0 
      ? context.assets.slice(0, 10).map(a => `- **${a.name}** [${a.type}]${a.language ? ` | ${a.language}` : ''} ${a.tags.length ? `(${a.tags.slice(0, 3).join(', ')})` : ''}`).join('\n')
      : 'No saved items';

    // Build workstream summaries section (HIGH PRIORITY - what user was actually doing)
    const workstreamSection = context.workstreamSummaries && context.workstreamSummaries.length > 0
      ? context.workstreamSummaries.slice(0, 5).map(s => {
          const date = s.created ? new Date(s.created).toLocaleString() : 'Unknown time';
          return `**[${date}]** ${s.summary || 'Activity session'}${s.tags.length ? ` | Topics: ${s.tags.slice(0, 5).join(', ')}` : ''}`;
        }).join('\n\n')
      : 'No workstream summaries available';

    // Build application usage section
    const appUsageSection = context.activityContext?.topApplications && context.activityContext.topApplications.length > 0
      ? context.activityContext.topApplications.map(app => 
          `- **${app.name}**: ${app.activityCount} activities`
        ).join('\n')
      : 'No application data';

    // Build websites visited section
    const websitesSection = context.activityContext?.websitesVisited && context.activityContext.websitesVisited.length > 0
      ? context.activityContext.websitesVisited.slice(0, 10).map(w => 
          `- ${w.name || w.url || 'Unknown'}`
        ).join('\n')
      : 'No websites tracked';

    // Build files accessed section  
    const filesSection = context.activityContext?.filesAccessed && context.activityContext.filesAccessed.length > 0
      ? context.activityContext.filesAccessed.slice(0, 10).map(f => 
          `- ${f.name || f.fullPath || 'Unknown file'}`
        ).join('\n')
      : 'No file access tracked';

    // Build news section
    const newsSection = newsArticles && newsArticles.length > 0
      ? newsArticles.map(a => 
          `- **${a.title}** (${a.source || 'News'})\n  ${a.description || ''}`
        ).join('\n\n')
      : 'No news available';

    // Activity metrics
    const activityMetrics = context.activityContext || {};

    // Agent insights (if available)
    const agentInsights = context.agentInsights && context.agentInsights.length > 0
      ? context.agentInsights.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n\n')
      : '';

    return `
You are a proactive personal assistant creating a personalized daily brief. Generate VARIED and GENUINELY USEFUL content based on the user's actual activity and stated goals.

## USER'S GOALS (TOP PRIORITY - Align all recommendations with these)
${goalsSection}

## USER'S PREFERENCES (What they like/dislike - respect these)
${prefsSection}

## Recent Conversation Topics (for continuity)
${recentConversations.length > 0 ? recentConversations.join(', ') : 'None'}

## What They've Been ACTUALLY Doing (Activity Tracking)

### Workstream Summaries (AI-generated descriptions of work sessions):
${workstreamSection}

### Applications Used:
${appUsageSection}

### Websites & Pages Visited:
${websitesSection}

### Files & Code Accessed:
${filesSection}

### Activity Metrics:
- Total activities tracked: ${activityMetrics.totalActivities || 0}
- Activities in last 24 hours: ${activityMetrics.activitiesLast24h || 0}
- Topics worked on: ${activityMetrics.topicsWorkedOn?.slice(0, 10).join(', ') || 'None'}

## Saved Items (explicitly saved snippets/links):
${assetsSection}

### Technologies/Languages: ${context.patterns?.languages?.join(', ') || 'None detected'}
${agentInsights ? `\n## Deeper Insights:\n${agentInsights}` : ''}
${context.piecesSummary ? `\n### Additional Context:\n${context.piecesSummary}` : ''}

## Today's News & Trends:
${newsSection}

## CONTENT FORMAT TYPES (Use varied formats to keep it interesting!)

Generate 5-8 items mixing these FORMATS:

| Format | When to Use | Required Fields |
|--------|-------------|-----------------|
| **quick_tip** | Short actionable advice | title, description (1-2 sentences) |
| **tool_recommendation** | Software/app suggestion | title, description, url, installSteps |
| **article** | Deep-dive content | title, summary, fullContent (markdown), readTime, sources |
| **stack_upgrade** | Tech improvement | title, currentState, upgradeTarget, migrationSteps |
| **learning_path** | Skill development | title, description, resources (array of links), estimatedTime |
| **action_item** | Immediate task | title, description, priority (1-5), dueBy |
| **insight** | Pattern observation | title, description, dataPoint |
| **challenge** | Fun optional goal | title, description, difficulty (easy/medium/hard), reward |

## CONTENT CATEGORIES (Pick what's MOST RELEVANT)

productivity_tips, software_tools, videos, articles, learning_resources, books, podcasts, communities, events, wellness, project_ideas, automations, people_to_follow, challenges, quick_wins

## CRITICAL GUIDELINES

1. **GOAL-ALIGNED**: Every recommendation should help with at least one of their goals
2. **RESPECT PREFERENCES**: Avoid categories/formats they've disliked, favor what they like
3. **SPECIFIC & ACTIONABLE**: Reference specific things from their activity
4. **VARIED FORMATS**: Mix at least 3 different format types
5. **REAL RESOURCES**: Use actual URLs, real tools, genuine recommendations
6. **RELEVANCE REASONS**: Explain WHY each item matters for THEM
7. **NO GENERIC ADVICE**: Everything should be personalized

## RESPONSE FORMAT (STRICT JSON - no markdown wrapper)

{
  "greeting": "Personalized greeting referencing their goals or recent work",
  "activitySummary": "2-3 sentence summary of what they've been doing and how it relates to their goals",
  "items": [
    {
      "format": "tool_recommendation",
      "category": "software_tools",
      "title": "Try Linear for Project Management",
      "description": "Based on your work on multiple coding projects...",
      "url": "https://linear.app",
      "metadata": {
        "installSteps": "1. Sign up at linear.app\\n2. Import from your current tool\\n3. Set up your first project",
        "relevanceToGoal": "Helps with your goal: Ship MVP by Friday"
      },
      "relevanceScore": 9,
      "timeToComplete": "15 min setup"
    },
    {
      "format": "article",
      "category": "articles",
      "title": "Understanding React Server Components",
      "summary": "You were researching Next.js - this explains the core concepts",
      "fullContent": "# React Server Components\\n\\nServer Components allow you to...",
      "metadata": {
        "readTime": "8 min",
        "sources": ["https://nextjs.org/docs"],
        "relatedToActivity": "Your Next.js research yesterday"
      },
      "relevanceScore": 8,
      "timeToComplete": "8 min"
    },
    {
      "format": "quick_tip",
      "category": "productivity_tips",
      "title": "Use Cmd+Shift+P in VS Code",
      "description": "Quick access to any command - saves 10+ minutes daily for heavy users like you"
    },
    {
      "format": "challenge",
      "category": "challenges",
      "title": "Zero-Distraction Morning",
      "description": "Try working on your MVP for 2 hours before checking email/slack tomorrow",
      "metadata": {
        "difficulty": "medium",
        "reward": "Significant progress toward your shipping goal"
      }
    }
  ],
  "dailyChallenge": {
    "title": "Goal-focused challenge",
    "description": "Related to their main goal",
    "difficulty": "medium"
  },
  "reflection": {
    "question": "Question about their work/progress",
    "context": "Why this matters for their goals"
  },
  "quickTip": "One-liner tip highly relevant to their current work"
}
`.trim();
  }
}

module.exports = new AIService();
