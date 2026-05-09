import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, Loader2 } from "lucide-react";
import api from "../api/client";
import { KBArticle, KBArticleSummary } from "../types";

const KnowledgeBasePage: React.FC = () => {
  const [articles, setArticles] = useState<KBArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listKBArticles()
      .then((data) => {
        if (cancelled) return;
        setArticles(data);
        if (data.length > 0 && !selectedSlug) {
          setSelectedSlug(data[0].slug);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load knowledge base articles."
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setArticle(null);
      return;
    }
    let cancelled = false;
    setArticleLoading(true);
    api
      .getKBArticle(selectedSlug)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch(() => {
        if (!cancelled) setArticle(null);
      })
      .finally(() => {
        if (!cancelled) setArticleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Policy guides and frequently asked questions.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Articles
          </div>
          {articles === null && !error && (
            <div className="px-4 py-6 text-sm text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {articles?.map((a) => (
              <li key={a.article_id}>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(a.slug)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${
                    selectedSlug === a.slug ? "bg-brand-50" : ""
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${
                      selectedSlug === a.slug
                        ? "text-brand-700"
                        : "text-slate-800"
                    }`}
                  >
                    {a.title}
                  </div>
                  {a.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 min-h-[300px]">
          {articleLoading && (
            <div className="text-sm text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading article...
            </div>
          )}
          {!articleLoading && !article && (
            <div className="text-sm text-slate-500">
              Select an article to start reading.
            </div>
          )}
          {!articleLoading && article && (
            <div className="prose prose-slate max-w-none">
              <h2>{article.title}</h2>
              <ReactMarkdown>{article.body_markdown}</ReactMarkdown>
            </div>
          )}
        </article>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
