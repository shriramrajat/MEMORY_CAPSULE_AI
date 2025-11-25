/**
 * AI Service
 * 
 * Handles all AI-powered features including sentiment analysis, transcription,
 * semantic search, and content summarization using the Gemini API.
 */

import { getEnvConfig } from './env-validation';
import type { DecryptedCapsule } from './database';

/**
 * AI Analysis result containing sentiment and themes
 */
export interface AIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // 0-1
  themes: string[];
  keyPhrases: string[];
  summary: string;
}

/**
 * AI Reflection across multiple capsules
 */
export interface AIReflection {
  overallSentiment: string;
  patterns: string[];
  insights: string[];
  recommendations: string[];
}

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  capsule: DecryptedCapsule;
  relevanceScore: number;
  matchedContent: string;
}

/**
 * Error types for AI service operations
 */
export enum AIErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class for AI service errors
 */
export class AIServiceError extends Error {
  constructor(
    public type: AIErrorType,
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/**
 * AI Service class for managing AI-powered features
 */
export class AIService {
  private apiKey: string;
  private timeoutMs: number;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    const config = getEnvConfig();
    this.apiKey = config.ai.geminiApiKey;
    this.timeoutMs = config.ai.timeoutMs;
  }

  /**
   * Checks if AI service is available (API key is configured)
   */
  isAvailable(): boolean {
    return this.apiKey !== '' && this.apiKey !== undefined;
  }

  /**
   * Makes a request to the Gemini API with timeout
   */
  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    if (!this.isAvailable()) {
      throw new AIServiceError(
        AIErrorType.API_KEY_MISSING,
        'Gemini API key is not configured. AI features are unavailable.'
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.baseUrl}/${endpoint}?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: signal || controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new AIServiceError(
            AIErrorType.RATE_LIMIT,
            'AI service rate limit exceeded. Please try again later.'
          );
        }
        throw new AIServiceError(
          AIErrorType.NETWORK_ERROR,
          `AI service request failed: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AIServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError(
          AIErrorType.TIMEOUT,
          `AI service request timed out after ${this.timeoutMs}ms`,
          error
        );
      }

      throw new AIServiceError(
        AIErrorType.NETWORK_ERROR,
        'Failed to connect to AI service',
        error
      );
    }
  }

  /**
   * Extracts text content from Gemini API response
   */
  private extractTextFromResponse(response: Record<string, unknown>): string {
    try {
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts[0]
      ) {
        return response.candidates[0].content.parts[0].text;
      }
      throw new Error('Invalid response structure');
    } catch (error) {
      throw new AIServiceError(
        AIErrorType.INVALID_RESPONSE,
        'Failed to parse AI service response',
        error
      );
    }
  }

  /**
   * Analyzes capsule content for sentiment and themes
   */
  async analyzeCapsuleContent(content: string): Promise<AIAnalysis> {
    if (!this.isAvailable()) {
      // Return fallback analysis when AI is unavailable
      return this.getFallbackAnalysis(content);
    }

    try {
      const prompt = `Analyze the following personal memory/journal entry and provide:
1. Overall sentiment (positive, neutral, or negative)
2. Sentiment score (0.0 to 1.0, where 0 is very negative and 1 is very positive)
3. Main themes (up to 5 key themes)
4. Key phrases (up to 5 important phrases)
5. A brief summary (1-2 sentences)

Format your response as JSON with this structure:
{
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0.0-1.0,
  "themes": ["theme1", "theme2", ...],
  "keyPhrases": ["phrase1", "phrase2", ...],
  "summary": "brief summary"
}

Content to analyze:
${content}`;

      const response = await this.makeRequest('gemini-pro:generateContent', {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      });

      const text = this.extractTextFromResponse(response);
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      return {
        sentiment: this.normalizeSentiment(analysis.sentiment),
        sentimentScore: this.normalizeSentimentScore(analysis.sentimentScore),
        themes: Array.isArray(analysis.themes) ? analysis.themes.slice(0, 5) : [],
        keyPhrases: Array.isArray(analysis.keyPhrases) ? analysis.keyPhrases.slice(0, 5) : [],
        summary: typeof analysis.summary === 'string' ? analysis.summary : '',
      };
    } catch (error) {
      console.error('AI analysis failed, using fallback:', error);
      return this.getFallbackAnalysis(content);
    }
  }

  /**
   * Generates AI reflection across multiple capsules
   */
  async generateReflection(capsules: DecryptedCapsule[]): Promise<AIReflection> {
    if (!this.isAvailable() || capsules.length === 0) {
      return this.getFallbackReflection();
    }

    try {
      // Prepare capsule summaries for analysis
      const capsuleSummaries = capsules
        .slice(0, 20) // Limit to 20 most recent capsules
        .map((c, i) => `${i + 1}. [${c.createdAt.toLocaleDateString()}] ${c.title}: ${c.content.substring(0, 200)}...`)
        .join('\n\n');

      const prompt = `Analyze these personal memories/journal entries and provide insights:

${capsuleSummaries}

Provide:
1. Overall sentiment trend
2. Recurring patterns or themes
3. Key insights about the person's journey
4. Recommendations for reflection

Format as JSON:
{
  "overallSentiment": "description of sentiment trend",
  "patterns": ["pattern1", "pattern2", ...],
  "insights": ["insight1", "insight2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...]
}`;

      const response = await this.makeRequest('gemini-pro:generateContent', {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048,
        },
      });

      const text = this.extractTextFromResponse(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const reflection = JSON.parse(jsonMatch[0]);

      return {
        overallSentiment: reflection.overallSentiment || '',
        patterns: Array.isArray(reflection.patterns) ? reflection.patterns : [],
        insights: Array.isArray(reflection.insights) ? reflection.insights : [],
        recommendations: Array.isArray(reflection.recommendations) ? reflection.recommendations : [],
      };
    } catch (error) {
      console.error('AI reflection failed, using fallback:', error);
      return this.getFallbackReflection();
    }
  }

  /**
   * Transcribes audio to text using Gemini API
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    if (!this.isAvailable()) {
      throw new AIServiceError(
        AIErrorType.API_KEY_MISSING,
        'Audio transcription requires AI service to be configured'
      );
    }

    try {
      // Convert audio blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      // Extract the base64 data (remove data URL prefix if present)
      const base64Data = base64Audio.includes(',') 
        ? base64Audio.split(',')[1] 
        : base64Audio;

      // Determine MIME type from blob
      const mimeType = audioBlob.type || 'audio/webm';

      const prompt = `Please transcribe the following audio recording. Provide only the transcribed text without any additional commentary or formatting.`;

      const response = await this.makeRequest('gemini-1.5-flash:generateContent', {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const transcription = this.extractTextFromResponse(response).trim();
      
      if (!transcription) {
        throw new Error('Empty transcription received');
      }

      return transcription;
    } catch (error) {
      console.error('Audio transcription failed:', error);
      
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      throw new AIServiceError(
        AIErrorType.UNKNOWN,
        'Failed to transcribe audio. Please try again.',
        error
      );
    }
  }

  /**
   * Converts a Blob to base64 string
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Performs semantic search across capsules
   */
  async semanticSearch(
    query: string,
    capsules: DecryptedCapsule[]
  ): Promise<SearchResult[]> {
    if (!this.isAvailable() || capsules.length === 0) {
      // Fallback to simple text matching
      return this.fallbackSearch(query, capsules);
    }

    try {
      // For semantic search, we'd ideally use embeddings
      // For now, use AI to rank relevance
      const capsuleTexts = capsules.map(
        (c, i) => `${i}. ${c.title}: ${c.content.substring(0, 300)}`
      );

      const prompt = `Given this search query: "${query}"

Rank these memories by relevance (0-100 score):
${capsuleTexts.join('\n\n')}

Return JSON array: [{"index": 0, "score": 85, "reason": "why relevant"}, ...]`;

      const response = await this.makeRequest('gemini-pro:generateContent', {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });

      const text = this.extractTextFromResponse(response);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const rankings = JSON.parse(jsonMatch[0]);

      interface RankingResult {
        index: number;
        score: number;
        reason?: string;
      }
      
      const results: SearchResult[] = rankings
        .filter((r: RankingResult) => r.score > 30) // Only include relevant results
        .map((r: RankingResult) => ({
          capsule: capsules[r.index],
          relevanceScore: r.score / 100,
          matchedContent: r.reason || '',
        }))
        .sort((a: SearchResult, b: SearchResult) => b.relevanceScore - a.relevanceScore);

      return results;
    } catch (error) {
      console.error('Semantic search failed, using fallback:', error);
      return this.fallbackSearch(query, capsules);
    }
  }

  /**
   * Generates a summary of capsule content
   */
  async generateSummary(content: string): Promise<string> {
    if (!this.isAvailable()) {
      return this.getFallbackSummary(content);
    }

    try {
      const prompt = `Summarize this personal memory/journal entry in 1-2 concise sentences:

${content}`;

      const response = await this.makeRequest('gemini-pro:generateContent', {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
        },
      });

      return this.extractTextFromResponse(response).trim();
    } catch (error) {
      console.error('Summary generation failed, using fallback:', error);
      return this.getFallbackSummary(content);
    }
  }

  // Fallback methods when AI is unavailable

  private getFallbackAnalysis(content: string): AIAnalysis {
    // Simple heuristic-based sentiment analysis
    const positiveWords = ['happy', 'joy', 'love', 'great', 'wonderful', 'amazing', 'excited'];
    const negativeWords = ['sad', 'angry', 'hate', 'terrible', 'awful', 'disappointed', 'frustrated'];

    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(w => lowerContent.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerContent.includes(w)).length;

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    let sentimentScore = 0.5;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      sentimentScore = Math.min(0.5 + (positiveCount * 0.1), 1.0);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      sentimentScore = Math.max(0.5 - (negativeCount * 0.1), 0.0);
    }

    return {
      sentiment,
      sentimentScore,
      themes: ['Personal reflection'],
      keyPhrases: [],
      summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
    };
  }

  private getFallbackReflection(): AIReflection {
    return {
      overallSentiment: 'AI reflection unavailable - configure Gemini API key to enable this feature',
      patterns: [],
      insights: [],
      recommendations: ['Configure AI service to unlock reflection features'],
    };
  }

  private getFallbackSummary(content: string): string {
    return content.substring(0, 150) + (content.length > 150 ? '...' : '');
  }

  private fallbackSearch(query: string, capsules: DecryptedCapsule[]): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    
    return capsules
      .map(capsule => {
        const titleMatch = capsule.title.toLowerCase().includes(lowerQuery);
        const contentMatch = capsule.content.toLowerCase().includes(lowerQuery);
        
        let relevanceScore = 0;
        if (titleMatch) relevanceScore += 0.6;
        if (contentMatch) relevanceScore += 0.4;

        const matchIndex = capsule.content.toLowerCase().indexOf(lowerQuery);
        const matchedContent = matchIndex >= 0
          ? capsule.content.substring(Math.max(0, matchIndex - 50), matchIndex + 100)
          : '';

        return {
          capsule,
          relevanceScore,
          matchedContent,
        };
      })
      .filter(result => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private normalizeSentiment(sentiment: string): 'positive' | 'neutral' | 'negative' {
    const lower = sentiment.toLowerCase();
    if (lower.includes('positive')) return 'positive';
    if (lower.includes('negative')) return 'negative';
    return 'neutral';
  }

  private normalizeSentimentScore(score: string | number): number {
    const num = typeof score === 'number' ? score : parseFloat(score);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }
}

// Export singleton instance
export const aiService = new AIService();
