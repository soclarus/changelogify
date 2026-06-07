"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChevronDown, ChevronUp, Package, Clock, ExternalLink } from "lucide-react";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface Changelog {
  id: string;
  created_at: string;
  version: string;
  client_summary: string;
  technical_summary: string;
}

export default function Dashboard() {
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChangelogs() {
      const { data, error } = await supabase
        .from("changelogs")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setChangelogs(data);
      if (error) console.error("Error fetching changelogs:", error);
    }
    fetchChangelogs();
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Product Updates</h1>
          <p className="text-gray-400">The latest improvements and fixes to Changelogify.</p>
        </header>

        <div className="space-y-8">
          {changelogs.map((log) => (
            <div key={log.id} className="relative pl-8 border-l border-gray-800">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-[#0a0a0a]" />
              
              <div className="bg-[#141414] rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {new Date(log.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package size={14} />
                      v{log.version}
                    </span>
                  </div>

                  <h2 className="text-2xl font-semibold mb-4 leading-snug">
                    {log.client_summary}
                  </h2>

                  <button 
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {expandedId === log.id ? (
                      <>Hide Technical Details <ChevronUp size={16} /></>
                    ) : (
                      <>View Technical Details <ChevronDown size={16} /></>
                    )}
                  </button>
                </div>

                {expandedId === log.id && (
                  <div className="px-6 pb-6 pt-2 border-t border-gray-800 bg-[#1a1a1a]">
                    <div className="prose prose-invert max-w-none">
                      <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap">
                        {log.technical_summary}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
