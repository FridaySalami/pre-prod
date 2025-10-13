/**
 * Keyword Extractor for Amazon Product Catalog Data
 * 
 * Extracts meaningful keywords from product titles and bullet points
 * Uses NLP techniques to identify key terms and rank by relevance
 */

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'this', 'these', 'those', 'their', 'them', 'or', 'but', 'not', 'can', 'all',
  'one', 'two', 'three', 'four', 'five', 'each', 'other', 'some', 'such', 'no',
  'more', 'only', 'into', 'over', 'after', 'most', 'also', 'than', 'when', 'where',
  'why', 'how', 'who', 'which', 'what', 'while', 'out', 'up', 'down', 'if', 'about',
  'get', 'make', 'made', 'use', 'used', 'using', 'new', 'great', 'good', 'best',
  'high', 'low', 'quality', 'perfect', 'ideal', 'premium', 'includes', 'comes',
  'please', 'note', 'ensure', 'may', 'might', 'should', 'would', 'could',
  // Additional common words
  'la', 'el', 'los', 'las', 'de', 'del' // Spanish articles often in brand names
]);

// Generic filler words specific to Amazon listings
const LISTING_FILLERS = new Set([
  'pack', 'set', 'piece', 'pieces', 'item', 'items', 'product', 'products',
  'amazon', 'prime', 'delivery', 'shipping', 'available', 'stock', 'buy',
  'purchase', 'order', 'price', 'sale', 'offer', 'deal', 'discount'
]);

export interface KeywordScore {
  keyword: string;
  score: number;
  frequency: number;
  sources: string[]; // 'title', 'bullets', 'category'
}

export interface ExtractedKeywords {
  primary: string[]; // Top 5 most relevant
  secondary: string[]; // Next 5 relevant
  all: KeywordScore[]; // All keywords with scores
}

/**
 * Extract keywords from catalog data
 */
export function extractKeywords(
  title: string,
  bulletPoints?: string[],
  category?: string,
  brand?: string
): ExtractedKeywords {
  const wordScores = new Map<string, KeywordScore>();

  // Process title (highest weight)
  if (title) {
    processText(title, wordScores, 'title', 3.0);
  }

  // Process bullet points (medium weight)
  if (bulletPoints && bulletPoints.length > 0) {
    bulletPoints.forEach(bullet => {
      processText(bullet, wordScores, 'bullets', 1.5);
    });
  }

  // Process category (lower weight, but relevant)
  if (category) {
    processText(category, wordScores, 'category', 1.0);
  }

  // Boost brand name if present
  if (brand) {
    const brandLower = brand.toLowerCase().trim();
    if (wordScores.has(brandLower)) {
      const existing = wordScores.get(brandLower)!;
      existing.score *= 1.5; // Boost brand score
    }
  }

  // Convert to array and sort by score
  const allKeywords = Array.from(wordScores.values())
    .filter(kw => kw.score > 0)
    .sort((a, b) => b.score - a.score);

  // Get top keywords
  const primary = allKeywords.slice(0, 5).map(kw => kw.keyword);
  const secondary = allKeywords.slice(5, 10).map(kw => kw.keyword);

  return {
    primary,
    secondary,
    all: allKeywords
  };
}

/**
 * Process text and update word scores
 */
function processText(
  text: string,
  wordScores: Map<string, KeywordScore>,
  source: string,
  weight: number
): void {
  // Tokenize and clean
  const words = tokenize(text);

  // Count word frequency in this text
  const localFrequency = new Map<string, number>();
  words.forEach(word => {
    localFrequency.set(word, (localFrequency.get(word) || 0) + 1);
  });

  // Update global scores
  words.forEach((word, index) => {
    if (!wordScores.has(word)) {
      wordScores.set(word, {
        keyword: word,
        score: 0,
        frequency: 0,
        sources: []
      });
    }

    const keywordScore = wordScores.get(word)!;

    // Add source if not already tracked
    if (!keywordScore.sources.includes(source)) {
      keywordScore.sources.push(source);
    }

    // Calculate position weight (earlier = more important)
    const positionWeight = 1 / (Math.log10(index + 10) / Math.log10(10));

    // Calculate frequency weight for this source
    const freqWeight = Math.log10((localFrequency.get(word) || 1) + 1);

    // Update score
    keywordScore.score += weight * positionWeight * freqWeight;
    keywordScore.frequency += 1;
  });
}

/**
 * Tokenize text into meaningful words
 */
function tokenize(text: string): string[] {
  // Clean and normalize
  let cleaned = text
    .toLowerCase()
    .replace(/[^\w\s\-]/g, ' ') // Remove punctuation except hyphens
    .replace(/\s+/g, ' ')
    .trim();

  // Split into words
  const words = cleaned.split(' ');

  // Filter and process
  return words
    .map(word => word.trim())
    .filter(word => {
      // Must be at least 2 characters (changed from 3 to keep "pc", "uk", etc.)
      if (word.length < 2) return false;

      // Skip if all numbers (unless it's a key spec like "20000mah")
      if (/^\d+$/.test(word)) return false;

      // Skip stop words
      if (STOP_WORDS.has(word)) return false;

      // Skip listing fillers
      if (LISTING_FILLERS.has(word)) return false;

      return true;
    })
    // Keep hyphenated terms intact, but also include individual parts
    .flatMap(word => {
      // Keep hyphenated terms that look meaningful (e.g., "power-bank", "5-quart")
      if (word.includes('-') && word.length > 3) {
        const parts = word.split('-').filter(w => w.length > 1 && !STOP_WORDS.has(w));
        // Return both the full hyphenated term AND individual parts
        return [word, ...parts];
      }
      return [word];
    })
    // Remove duplicates while preserving order
    .filter((word, index, self) => self.indexOf(word) === index);
}

/**
 * Extract keyword phrases (2-3 word combinations)
 */
export function extractPhrases(
  title: string,
  bulletPoints?: string[]
): string[] {
  const phrases: string[] = [];

  // Process title
  const titlePhrases = extractPhrasesFromText(title);
  phrases.push(...titlePhrases);

  // Process bullets
  if (bulletPoints && bulletPoints.length > 0) {
    bulletPoints.forEach(bullet => {
      const bulletPhrases = extractPhrasesFromText(bullet);
      phrases.push(...bulletPhrases);
    });
  }

  // Count frequency
  const phraseCount = new Map<string, number>();
  phrases.forEach(phrase => {
    phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
  });

  // Return top phrases (appearing more than once)
  return Array.from(phraseCount.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase, _]) => phrase);
}

/**
 * Extract phrases from text (2-3 word combinations)
 */
function extractPhrasesFromText(text: string): string[] {
  const words = tokenize(text);
  const phrases: string[] = [];

  // 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (phrase.length > 5) { // Skip very short phrases
      phrases.push(phrase);
    }
  }

  // 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (phrase.length > 10) { // Skip very short phrases
      phrases.push(phrase);
    }
  }

  return phrases;
}

/**
 * Format keywords for display (capitalize first letter)
 */
export function formatKeywords(keywords: string[]): string[] {
  return keywords.map(keyword => {
    // Capitalize first letter of each word
    return keyword
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });
}

/**
 * Get keyword statistics
 */
export function getKeywordStats(keywords: ExtractedKeywords): {
  totalUnique: number;
  fromTitle: number;
  fromBullets: number;
  fromCategory: number;
  avgScore: number;
} {
  const fromTitle = keywords.all.filter(kw => kw.sources.includes('title')).length;
  const fromBullets = keywords.all.filter(kw => kw.sources.includes('bullets')).length;
  const fromCategory = keywords.all.filter(kw => kw.sources.includes('category')).length;
  const avgScore = keywords.all.reduce((sum, kw) => sum + kw.score, 0) / keywords.all.length;

  return {
    totalUnique: keywords.all.length,
    fromTitle,
    fromBullets,
    fromCategory,
    avgScore
  };
}
