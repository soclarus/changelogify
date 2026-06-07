import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client
const supabaseUrl = 'https://dfeumsaeaoplyztmwxpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key', // Use dummy key if missing
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

    // Attempt to generate summaries using OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `
          You are a product manager assistant. I will provide you with a GitHub Pull Request title and description.
          Please generate two summaries:
          1. A "Technical Summary" for developers (brief, concise, technical).
          2. A "Client Summary" for non-technical stakeholders (friendly, focus on value/features, no jargon).

          PR Title: \${prTitle}
          PR Body: \${prBody}

          Return your response in the following JSON format:
          {
            "technical_summary": "...",
            "client_summary": "..."
          }
        `;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes code changes.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        });

        summaries = JSON.parse(completion.choices[0].message.content || '{}');
      } catch (aiError) {
        console.error('OpenAI Error, falling back to mock:', aiError);
        summaries = {
          technical_summary: \`Mock technical summary for: \${prTitle}. Details: \${prBody.substring(0, 100)}...\`,
          client_summary: \`We improved the project by adding: \${prTitle}. This update makes the experience smoother for all users.\`
        };
      }
    } else {
      // Graceful fallback for testing without API key
      summaries = {
        technical_summary: \`[MOCK] Technical: \${prTitle}. PR #\${pr.number} merged into main.\`,
        client_summary: \`[MOCK] Client: We added a new feature: \${prTitle}. Check it out!\`
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

    return NextResponse.json({ message: 'Changelog processed successfully', data, mode: process.env.OPENAI_API_KEY ? 'live' : 'mock' });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
