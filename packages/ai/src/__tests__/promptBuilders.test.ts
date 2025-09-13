import { applyBrandKit, buildSeriesPrompt, buildScriptPrompt } from '../promptBuilders';
import { Brand } from '../types';

describe('applyBrandKit', () => {
  const mockBrand: Brand = {
    font: 'Arial',
    palette: {
      primary: '#FF0000',
      secondary: '#00FF00',
      accent: '#0000FF'
    },
    tone: 'professional and friendly',
    cta: 'Subscribe Now',
    voice_preset: 'Warm Narration'
  };

  it('should prepend brand guidelines to the prompt', () => {
    const basePrompt = 'Generate a video about AI.';
    const result = applyBrandKit(basePrompt, mockBrand);

    expect(result).toContain('BRAND GUIDELINES:');
    expect(result).toContain('FONT: Use Arial font family');
    expect(result).toContain('COLOR PALETTE:');
    expect(result).toContain('TONE: Maintain professional and friendly');
    expect(result).toContain('CALL TO ACTION: Use "Subscribe Now"');
    expect(result).toContain('VOICE PRESET: Use "Warm Narration"');
    expect(result).toContain('ORIGINAL PROMPT:');
    expect(result).toContain(basePrompt);
  });

  it('should handle partial brand configuration', () => {
    const partialBrand: Brand = {
      tone: 'casual',
      cta: 'Learn More'
    };

    const basePrompt = 'Create content about technology.';
    const result = applyBrandKit(basePrompt, partialBrand);

    expect(result).toContain('TONE: Maintain casual');
    expect(result).toContain('CALL TO ACTION: Use "Learn More"');
    expect(result).not.toContain('FONT:');
    expect(result).not.toContain('COLOR PALETTE:');
    expect(result).toContain('ORIGINAL PROMPT:');
  });

  it('should return original prompt when brand is empty', () => {
    const emptyBrand = {} as Brand;
    const basePrompt = 'Plain prompt without brand.';

    const result = applyBrandKit(basePrompt, emptyBrand);

    expect(result).toBe(basePrompt);
  });
});

describe('buildSeriesPrompt', () => {
  it('should build series prompt without brand', () => {
    const input = {
      title: 'Tech Trends 2025',
      topic: 'artificial intelligence'
    };

    const result = buildSeriesPrompt(input);

    expect(result).toContain('Tech Trends 2025');
    expect(result).toContain('artificial intelligence');
    expect(result).toContain('weekly');
    expect(result).toContain('English');
    expect(result).toContain('JSON response');
  });

  it('should build series prompt with brand', () => {
    const input = {
      title: 'Tech Trends 2025',
      topic: 'artificial intelligence',
      brand: {
        tone: 'professional',
        cta: 'Watch More'
      } as Brand
    };

    const result = buildSeriesPrompt(input);

    expect(result).toContain('BRAND GUIDELINES:');
    expect(result).toContain('TONE: Maintain professional');
    expect(result).toContain('CALL TO ACTION: Use "Watch More"');
    expect(result).toContain('ORIGINAL PROMPT:');
    expect(result).toContain('Tech Trends 2025');
  });
});

describe('buildScriptPrompt', () => {
  it('should build script prompt without brand', () => {
    const input = {
      title: 'Introduction to Machine Learning',
      topic: 'AI fundamentals',
      episodeId: 'ep-123',
      seriesId: 'series-456',
      duration: 120
    };

    const result = buildScriptPrompt(input);

    expect(result).toContain('Introduction to Machine Learning');
    expect(result).toContain('AI fundamentals');
    expect(result).toContain('120 seconds');
    expect(result).toContain('ep-123');
    expect(result).toContain('series-456');
  });

  it('should build script prompt with brand', () => {
    const input = {
      title: 'Introduction to Machine Learning',
      topic: 'AI fundamentals',
      episodeId: 'ep-123',
      seriesId: 'series-456',
      duration: 120,
      brand: {
        font: 'Helvetica',
        voice_preset: 'Clear and Authoritative'
      } as Brand
    };

    const result = buildScriptPrompt(input);

    expect(result).toContain('BRAND GUIDELINES:');
    expect(result).toContain('FONT: Use Helvetica font family');
    expect(result).toContain('VOICE PRESET: Use "Clear and Authoritative"');
    expect(result).toContain('ORIGINAL PROMPT:');
    expect(result).toContain('Introduction to Machine Learning');
  });

  it('should use default duration when not provided', () => {
    const input = {
      title: 'Test Episode',
      episodeId: 'ep-123',
      seriesId: 'series-456'
    };

    const result = buildScriptPrompt(input);

    expect(result).toContain('60 seconds');
  });
});

describe('Brand palette handling', () => {
  it('should format color palette correctly in brand guidelines', () => {
    const brandWithPalette: Brand = {
      palette: {
        primary: '#FF5733',
        secondary: '#33FF57',
        accent: '#5733FF'
      }
    };

    const basePrompt = 'Generate thumbnail.';
    const result = applyBrandKit(basePrompt, brandWithPalette);

    expect(result).toContain('COLOR PALETTE:');
    expect(result).toContain('- Primary: #FF5733');
    expect(result).toContain('- Secondary: #33FF57');
    expect(result).toContain('- Accent: #5733FF');
  });
});
