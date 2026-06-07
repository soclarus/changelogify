"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChevronDown, ChevronUp, GitBranch, Clock, LogOut } from "lucide-react";

// Mark route as dynamic to prevent build-time crashes if env vars are missing
export const dynamic = "force-dynamic";

// Supabase client factory to handle missing environment variables gracefully
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
};

const supabase = getSupabaseClient();

interface Changelog {
  id: string;
  created_at: string;
  pr_number: number;
  client_summary: string;
  technical_summary: string;
  github_repo: string;
}

export default function Dashboard() {
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChangelogs() {
      if (!supabase) {
        setError("Supabase environment variables are missing.");
        setLoading(false);
        return;
      }

      // Supabase RLS will automatically restrict this query to only the authenticated user's rows
      const { data, error: supabaseError } = await supabase
        .from("changelogs")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setChangelogs(data);
      if (supabaseError) {
        console.error("Error fetching changelogs:", supabaseError);
        setError("Failed to load changelogs.");
      }
      setLoading(false);
    }
    fetchChangelogs();
  }, []);

  const repos = useMemo(() => {
    const uniqueRepos = Array.from(new Set(changelogs.map(log => log.github_repo).filter(Boolean)));
    return ["All", ...uniqueRepos];
  }, [changelogs]);

  const filteredChangelogs = useMemo(() => {
    if (selectedRepo === "All") return changelogs;
    return changelogs.filter(log => log.github_repo === selectedRepo);
  }, [changelogs, selectedRepo]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Product Updates</h1>
            <p className="text-gray-400">The latest improvements and fixes to your projects.</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 rounded-lg transition-colors border border-gray-800"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </header>

        {/* Tabs for filtering */}
        {!loading && repos.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-12 border-b border-gray-800 pb-4">
            {repos.map(repo => (
              <button
                key={repo}
                onClick={() => setSelectedRepo(repo)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedRepo === repo
                    ? "bg-blue-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                }`}
              >
                {repo}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 mb-8 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredChangelogs.length === 0 ? (
              <div className="text-center py-20 bg-[#141414] rounded-xl border border-dashed border-gray-800">
                <p className="text-gray-500 mb-2">No changelogs found.</p>
                <p className="text-sm text-gray-600">Connect a repository and merge a PR to see updates here.</p>
              </div>
            ) : (
              filteredChangelogs.map((log) => (
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
                        <a
                          href={`https://github.com/${log.github_repo}/pull/${log.pr_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                          <GitBranch size={14} />
                          PR #{log.pr_number}
                        </a>
                        {log.github_repo && (
                          <span className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-bold uppercase tracking-wider">
                            {log.github_repo.split('/')[1] || log.github_repo}
                          </span>
                        )}
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
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
