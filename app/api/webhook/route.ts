import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client
const supabaseUrl = 'https://dfeumsaeaoplyztmwxpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

interface AIConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  name: string;
  supports_json_mode: boolean;
}

const getAIConfigs = (): AIConfig[] => {
  const configs: AIConfig[] = [];

  if (process.env.OPENROUTER_API_KEY) {
    configs.push({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      name: 'OpenRouter',
      supports_json_mode: false 
    });
  }

  if (process.env.OPENAI_API_KEY) {
    configs.push({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: undefined,
      model: 'gpt-4o-mini',
      name: 'OpenAI',
      supports_json_mode: true
    });
  }

  return configs;
};

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id query parameter' }, { status: 400 });
    }

    const payload = await req.json();
    
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

    const aiConfigs = getAIConfigs();
    let success = false;
    let lastUsedProvider = 'mock';

    for (const config of aiConfigs) {
      try {
        const openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          defaultHeaders: config.name === 'OpenRouter' ? {
            'HTTP-Referer': 'https://changelogify.soclarus.com',
            'X-Title': 'Changelogify',
          } : undefined,
        });

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
          model: config.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes code changes and always responds in valid JSON.' },
            { role: 'user', content: prompt }
          ],
          ...(config.supports_json_mode ? { response_format: { type: 'json_object' } } : {})
        });

        const content = completion.choices[0].message.content || '{}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        
        summaries = JSON.parse(jsonString);
        success = true;
        lastUsedProvider = config.name;
        break;
      } catch (aiError) {
        console.error(\`\${config.name} Error, trying next provider...\`, aiError);
      }
    }

    if (!success) {
      summaries = {
        technical_summary: \`[MOCK] Technical: \${prTitle}. PR #\${pr.number} merged into main.\`,
        client_summary: \`[MOCK] Client: We added a new feature: \${prTitle}. Check it out!\`
      };
    }

    const { data, error } = await supabase
      .from('changelogs')
      .insert([
        {
          github_repo: repoName,
          pr_number: pr.number,
          title: prTitle,
          technical_summary: summaries.technical_summary,
          client_summary: summaries.client_summary,
          user_id: userId,
        },
      ]);

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: 'Failed to save to database' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Changelog processed successfully', 
      data, 
      mode: lastUsedProvider 
    });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
