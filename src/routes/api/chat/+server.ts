import { json, error } from '@sveltejs/kit';
import { OpenAI } from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, analyticsData } = await request.json();

    if (!OPENAI_API_KEY) {
      throw error(500, 'OpenAI API key not configured');
    }

    // Initialize OpenAI client with the API key
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });

    if (!message) {
      throw error(400, 'Message is required');
    }

    // Prepare the system prompt with analytics context
    const systemPrompt = `You are a data analysis assistant for a business analytics dashboard. You have access to the following business data and should provide insights, trends, and recommendations based on this information.

Current Analytics Data:
${JSON.stringify(analyticsData, null, 2)}

Your role is to:
1. Analyze the provided data for trends and patterns
2. Provide actionable business insights
3. Suggest areas for improvement or investigation
4. Answer specific questions about the data
5. Highlight important metrics and changes

Please be concise, professional, and focus on actionable insights. Use specific numbers from the data when relevant.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw error(500, 'No response from OpenAI');
    }

    return json({
      response,
      usage: completion.usage
    });
  } catch (err) {
    console.error('OpenAI API error:', err);

    if (err instanceof Error) {
      // Handle specific OpenAI errors
      if (err.message.includes('API key')) {
        throw error(500, 'Invalid API key configuration');
      }
      if (err.message.includes('quota')) {
        throw error(429, 'API quota exceeded');
      }
    }

    throw error(500, 'Failed to get AI response');
  }
};
