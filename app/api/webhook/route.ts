import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client
const supabaseUrl = 'https://dfeumsaeaoplyztmwxpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Dynamic Provider Configuration
const getAIConfig = () => {
  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      model: 'llama3-8b-8192',
      name: 'Groq',
      supports_json_mode: true
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-2.0-flash-lite-preview:free',
      name: 'OpenRouter',
      // Some OpenRouter models (especially free/flash ones) might not strictly support response_format: { type: 'json_object' } 
      // or require specific headers. We will handle headers in the constructor and 
      // check for JSON mode support.
      supports_json_mode: false 
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: undefined, // Default OpenAI base URL
      model: 'gpt-4o-mini',
      name: 'OpenAI',
      supports_json_mode: true
    };
  }
  return null;
};

const aiConfig = getAIConfig();

// Initialize OpenAI client with necessary OpenRouter headers if applicable
const openai = new OpenAI({
  apiKey: aiConfig?.apiKey || 'mock-key',
  baseURL: aiConfig?.baseURL,
  defaultHeaders: aiConfig?.name === 'OpenRouter' ? {
    'HTTP-Referer': 'https://changelogify.soclarus.com', // Optional, for OpenRouter rankings
    'X-Title': 'Changelogify', // Optional, for OpenRouter rankings
  } : undefined,
});

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Only process Pull Request 'closed' events where the PR was merged
    if (payload.action !== 'closed' || !payload.pull_request?.merged) {
      return NextResponse.json({ message: 'Not a merged PR event, skipping' });
    }

    const pr = payload.pull_request;
    const repoName = payload.repository.full_name;
    const prTitle = pr.title;
    const prBody = pr.body || 'No description provided.';

    let summaries = {
      technical_summary: '',
      client_summary: ''
    };

    // Attempt to generate summaries using the configured AI provider
    if (aiConfig) {
      try {
        const prompt = `
          You are a product manager assistant. I will provide you with a GitHub Pull Request title and description.
          Please generate two summaries:
          1. A "Technical Summary" for developers (brief, concise, technical).
          2. A "Client Summary" for non-technical stakeholders (friendly, focus on value/features, no jargon).

          PR Title: ${prTitle}
          PR Body: ${prBody}

          Return your response in EXACTLY the following JSON format:
          {
            "technical_summary": "...",
            "client_summary": "..."
          }
        `;

        const completion = await openai.chat.completions.create({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes code changes and always responds in valid JSON.' },
            { role: 'user', content: prompt }
          ],
          // Only use response_format if the provider explicitly supports it to avoid 400 errors
          ...(aiConfig.supports_json_mode ? { response_format: { type: 'json_object' } } : {})
        });

        const content = completion.choices[0].message.content || '{}';
        
        // Robust JSON parsing: handle potential markdown blocks in non-JSON-mode responses
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        
        summaries = JSON.parse(jsonString);
      } catch (aiError) {
        console.error(`${aiConfig.name} Error, falling back to mock:`, aiError);
        summaries = {
          technical_summary: `Mock technical summary for: ${prTitle}. Details: ${prBody.substring(0, 100)}...`,
          client_summary: `We improved the project by adding: ${prTitle}. This update makes the experience smoother for all users.`
        };
      }
    } else {
      // Graceful fallback for testing without any API keys
      summaries = {
        technical_summary: `[MOCK] Technical: ${prTitle}. PR #${pr.number} merged into main.`,
        client_summary: `[MOCK] Client: We added a new feature: ${prTitle}. Check it out!`
      };
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('changelogs')
      .insert([
        {
          github_repo: repoName,
          pr_number: pr.number,
          title: prTitle,
          technical_summary: summaries.technical_summary,
          client_summary: summaries.client_summary,
        },
      ]);

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: 'Failed to save to database' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Changelog processed successfully', 
      data, 
      mode: aiConfig ? aiConfig.name : 'mock' 
    });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
