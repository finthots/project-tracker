import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTodo, deleteTodo, getTodos, updateTodo } from "@/api";
import type { Todo, TodoPriority } from "@/api";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Clock3, Pencil, Plus, Search, Trash2, X } from "lucide-react";

type View = "open" | "done" | "all";
const priorities: TodoPriority[] = ["Low", "Medium", "High", "Critical"];
const priorityStyle: Record<TodoPriority, string> = {
  Low: "bg-slate-100 text-slate-600", Medium: "bg-blue-100 text-blue-700",
  High: "bg-amber-100 text-amber-700", Critical: "bg-rose-100 text-rose-700",
};
const day = (value: string | Date) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const today = () => day(new Date());
const dueDay = (t: Todo) => t.due_date ? day(t.due_date) : null;
const niceDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function TodoCard({ todo, onSave, onDelete }: {
  todo: Todo; onSave: (id: number, data: Partial<Todo>) => void; onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? "");
  const [priority, setPriority] = useState<TodoPriority>(todo.priority);
  const [due, setDue] = useState(todo.due_date?.slice(0, 10) ?? "");
  const late = !todo.is_done && dueDay(todo) !== null && dueDay(todo)! < today();
  const save = () => {
    if (!title.trim()) return;
    onSave(todo.id, { title: title.trim(), notes: notes.trim() || null as unknown as string,
      priority, due_date: due || null as unknown as string });
    setEditing(false);
  };
  return <article className={`rounded-2xl border bg-white p-4 shadow-sm ${late ? "border-rose-200" : "border-slate-200"}`}>
    {editing ? <div className="space-y-3">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        aria-label="To-do title" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">Priority<select value={priority} onChange={(e) => setPriority(e.target.value as TodoPriority)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="text-xs text-slate-600">Due date<input type="date" value={due} onChange={(e) => setDue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>
      <div className="flex justify-end gap-2"><button onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-sm text-slate-600">Cancel</button>
        <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save</button></div>
    </div> : <div className="flex gap-3">
      <button onClick={() => onSave(todo.id, { is_done: !todo.is_done })}
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${todo.is_done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-blue-500"}`}
        aria-label={todo.is_done ? "Mark incomplete" : "Mark complete"}><Check size={16} /></button>
      <div className="min-w-0 flex-1">
        <p className={`break-words font-medium ${todo.is_done ? "text-slate-400 line-through" : "text-slate-900"}`}>{todo.title}</p>
        {todo.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">{todo.notes}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-medium ${priorityStyle[todo.priority]}`}>{todo.priority}</span>
          {todo.due_date && <span className={`flex items-center gap-1 ${late ? "font-semibold text-rose-600" : "text-slate-500"}`}>
            <CalendarDays size={13} /> {late ? "Overdue · " : "Due · "}{niceDate(todo.due_date)}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <button onClick={() => setEditing(true)} aria-label="Edit to-do" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={16} /></button>
        <button onClick={() => { if (window.confirm("Delete this to-do?")) onDelete(todo.id); }} aria-label="Delete to-do"
          className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></button>
      </div>
    </div>}
  </article>;
}

export function Todos() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("open");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<TodoPriority | "All">("All");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>("Medium");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const { data: todos = [], isLoading } = useQuery({ queryKey: ["todos"], queryFn: () => getTodos(true).then((r) => r.data) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["todos"] }); qc.invalidateQueries({ queryKey: ["dashboardSummary"] }); };
  const create = useMutation({ mutationFn: createTodo, onSuccess: () => {
    refresh(); setTitle(""); setNotes(""); setDue(""); setNewPriority("Medium"); setAdding(false); setError("");
  }, onError: () => setError("Could not add the to-do. Please try again.") });
  const update = useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<Todo> }) => updateTodo(id, data),
    onSuccess: refresh, onError: () => setError("Could not save the to-do. Please try again.") });
  const remove = useMutation({ mutationFn: deleteTodo, onSuccess: refresh,
    onError: () => setError("Could not delete the to-do. Please try again.") });
  const open = todos.filter((t) => !t.is_done);
  const done = todos.filter((t) => t.is_done);
  const overdue = open.filter((t) => dueDay(t) !== null && dueDay(t)! < today()).length;
  const dueToday = open.filter((t) => dueDay(t) === today()).length;
  const filtered = useMemo(() => todos.filter((t) =>
    (view === "all" || (view === "done" ? t.is_done : !t.is_done)) &&
    (priority === "All" || t.priority === priority) &&
    `${t.title} ${t.notes ?? ""}`.toLowerCase().includes(query.toLowerCase().trim())), [todos, view, priority, query]);
  const sections = view === "open" ? [
    { title: "Overdue", items: filtered.filter((t) => dueDay(t) !== null && dueDay(t)! < today()), tone: "rose" },
    { title: "Today", items: filtered.filter((t) => dueDay(t) === today()), tone: "slate" },
    { title: "Upcoming", items: filtered.filter((t) => dueDay(t) !== null && dueDay(t)! > today()), tone: "slate" },
    { title: "No due date", items: filtered.filter((t) => !dueDay(t)), tone: "slate" },
  ] : [{ title: view === "done" ? "Completed" : "All to-dos", items: filtered, tone: "slate" }];
  const add = () => { if (title.trim()) create.mutate({ title: title.trim(), notes: notes.trim() || undefined,
    priority: newPriority, due_date: due || undefined }); };
  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold text-slate-900">My To-Dos</h1><p className="mt-1 text-sm text-slate-500">Keep the small things moving.</p></div>
      <button onClick={() => setAdding((v) => !v)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
        {adding ? <X size={17} /> : <Plus size={17} />}{adding ? "Close" : "Add to-do"}</button>
    </header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Open", open.length, <Clock3 size={18} />], ["Overdue", overdue, <AlertTriangle size={18} />],
        ["Due today", dueToday, <CalendarDays size={18} />], ["Completed", done.length, <CheckCircle2 size={18} />]].map(([label, count, icon]) =>
        <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500"><span className="text-xs font-medium uppercase tracking-wide">{label}</span>{icon}</div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{count}</p></div>)}
    </div>
    {adding && <div className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        placeholder="What needs to be done?" aria-label="New to-do title" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details or next step (optional)" rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <label className="text-xs text-slate-600">Priority<select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">{priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="text-xs text-slate-600">Due date<input type="date" value={due} onChange={(e) => setDue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
        <button onClick={add} disabled={!title.trim() || create.isPending} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Add to list</button>
      </div>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">{(["open", "done", "all"] as View[]).map((tab) =>
        <button key={tab} onClick={() => setView(tab)} className={`flex-1 rounded-md px-3 py-2 text-sm capitalize sm:flex-none ${view === tab ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>{tab}</button>)}</div>
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search to-dos" aria-label="Search to-dos"
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm" /></div>
      <select value={priority} onChange={(e) => setPriority(e.target.value as TodoPriority | "All")}
        aria-label="Filter priority" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
        <option value="All">All priorities</option>{priorities.map((p) => <option key={p}>{p}</option>)}</select>
    </div></div>
    {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Loading to-dos…</p> : filtered.length === 0 ?
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center"><CheckCircle2 size={32} className="mx-auto text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">Nothing here yet</p><p className="mt-1 text-sm text-slate-500">Add a to-do or change the filters.</p></div> :
      sections.filter((s) => s.items.length).map((section) => <section key={section.title} className="space-y-2">
        <h2 className={`flex items-center gap-2 px-1 text-sm font-semibold ${section.tone === "rose" ? "text-rose-700" : "text-slate-700"}`}>
          {section.title}<span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{section.items.length}</span></h2>
        {section.items.map((todo) => <TodoCard key={todo.id} todo={todo}
          onSave={(id, data) => update.mutate({ id, data })} onDelete={(id) => remove.mutate(id)} />)}</section>)}
  </div>;
}
