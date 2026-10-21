import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowUp, Database, Loader2, Sparkles } from "lucide-react";
import { askTracker } from "@/api";

type Exchange = { question: string; answer: string; source: "local" | "tracker" | "huggingface" };

const suggestions = [
  "Which tasks are overdue?",
  "What should I focus on this week?",
  "Summarize active projects",
  "Which of my to-dos are still open?",
];

export function AskAI() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = Boolean(pendingQuestion);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, pendingQuestion, error]);

  const ask = async (value: string) => {
    const next = value.trim();
    if (!next || busy || next.length > 500) return;
    setQuestion("");
    setError("");
    setPendingQuestion(next);
    try {
      const response = await askTracker(next);
      setHistory((current) => [...current, { question: next, answer: response.data.answer, source: response.data.source }]);
    } catch (err) {
      setQuestion(next);
      setError(isAxiosError(err)
        ? (err.response?.data?.detail || "Could not reach the AI service. Please try again.")
        : "Could not reach the AI service. Please try again.");
    } finally {
      setPendingQuestion("");
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-5 pb-6">
      <div className="rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 p-5 text-white shadow-sm sm:p-7">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><Sparkles size={22} /></div>
        <h1 className="text-2xl font-bold sm:text-3xl">Ask your tracker</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">Ask about projects, tasks, milestones, recent comments, or your to-dos in everyday language.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900 sm:text-sm">
        <Database size={17} className="mt-0.5 shrink-0" />
        <span>Common questions are answered directly from your tracker. Other questions send a read-only snapshot of relevant project data and your own to-dos to Hugging Face. AI answers can make mistakes, so check important details in the tracker.</span>
      </div>

      {history.length === 0 && !pendingQuestion && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Try asking</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {suggestions.map((item) => (
              <button key={item} type="button" onClick={() => ask(item)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800">
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {(history.length > 0 || pendingQuestion) && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-live="polite">
          {history.map((item, index) => (
            <div key={index} className="space-y-3">
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-3 text-sm text-white sm:max-w-[80%]">{item.question}</div>
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Sparkles size={16} /></div>
                <div className="min-w-0 max-w-[calc(100%-3rem)] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-800">
                  <div className="whitespace-pre-wrap break-words">{item.answer}</div>
                  <div className="mt-2 text-xs text-slate-500">{item.source === "tracker" ? "Exact tracker data" : item.source === "local" ? "Built-in response" : "Hugging Face AI"}</div>
                </div>
              </div>
            </div>
          ))}
          {pendingQuestion && <div className="space-y-3">
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-3 text-sm text-white sm:max-w-[80%]">{pendingQuestion}</div>
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Reading tracker data and preparing an answer…</div>
          </div>}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={(event) => { event.preventDefault(); ask(question); }} className="mt-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        {error && <div className="mb-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
        <div className="flex items-end gap-2">
          <textarea aria-label="Question for tracker AI" value={question} maxLength={500} rows={2} disabled={busy}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(question); } }}
            placeholder="Ask a question about your tracker…"
            className="max-h-40 min-h-14 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
          <button type="submit" disabled={busy || !question.trim()} aria-label="Ask question"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {busy ? <Loader2 size={19} className="animate-spin" /> : <ArrowUp size={19} />}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Each question uses a fresh snapshot. Press Enter to ask, Shift+Enter for a new line.</p>
      </form>
    </div>
  );
}
