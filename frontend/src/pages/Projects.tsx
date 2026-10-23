import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject, getMilestoneTemplates, exportAllActiveXlsx, getCategories, getUsers, updateProject } from "@/api";
import type { Project, Venture, ProjectCategory, ProjectStatus, CategoryOption } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { ventureColor, projectStatusColor, daysToDeadline, deadlineClass } from "@/lib/statusColors";
import { Plus, LayoutGrid, List, Download, CalendarDays, Search, X, ArrowRight } from "lucide-react";

const VENTURES: Venture[] = ["Finthots", "Sunyukth", "Personal"];
const STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];

export function Projects() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [view, setView] = useState<"card" | "table">("card");
  const [filters, setFilters] = useState({ venture: "", status: "", category: "", user_id: "" });
  const [sortOrder, setSortOrder] = useState<"name_asc" | "newest" | "oldest">("name_asc");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", filters],
    queryFn: () =>
      getProjects(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).then(
        (r) => r.data
      ),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["milestoneTemplates"],
    queryFn: () => getMilestoneTemplates().then((r) => r.data),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then((r) => r.data),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
  });

  const reportIds = useMemo(() => {
    const seen = new Set<number>();
    let frontier = user ? [user.id] : [];
    while (frontier.length) {
      const next = users
        .filter((member) => frontier.includes(member.reports_to_id ?? -1))
        .map((member) => member.id)
        .filter((id) => !seen.has(id));
      next.forEach((id) => seen.add(id));
      frontier = next;
    }
    return seen;
  }, [users, user]);
  const canFilterByMember = isAdmin || reportIds.size > 0;
  const filterUsers = isAdmin
    ? users.filter((member) => member.is_active)
    : users.filter((member) => member.is_active && (member.id === user?.id || reportIds.has(member.id)));

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
      navigate(`/projects/${r.data.id}`);
    },
  });

  const ownerMutation = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: number }) =>
      updateProject(projectId, { created_by_id: userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const setFilter = (k: string, v: string) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const pct = (p: Project) =>
    p.task_count > 0 ? Math.round((p.done_task_count / p.task_count) * 100) : 0;
  const visibleProjects = projects
    .filter((p) =>
      `${p.name} ${p.client ?? ""} ${p.venture} ${p.category}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "name_asc") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }

      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === "newest" ? bCreated - aCreated : aCreated - bCreated;
    });
  const hasFilters = Boolean(search || filters.venture || filters.status || filters.category || filters.user_id);
  const creatorControl = (project: Project) => isAdmin ? (
    <label className="flex items-center gap-2 text-xs text-gray-500" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      Created by
      <Select aria-label={`Change creator for ${project.name}`} className="min-h-9 max-w-44" value={String(project.created_by_id)}
        onChange={(e) => ownerMutation.mutate({ projectId: project.id, userId: Number(e.target.value) })}>
        {users.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
      </Select>
    </label>
  ) : (
    <p className="text-xs text-gray-500">Created by <span className="font-medium text-gray-700">{project.created_by?.full_name ?? "Unknown"}</span></p>
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{visibleProjects.length} {hasFilters ? "matching " : ""}projects</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button variant="outline" size="sm" className="min-h-11" onClick={exportAllActiveXlsx}>
            <Download size={14} /> Export Active
          </Button>
          <Button size="sm" className="min-h-11" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Project
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 min-w-0 sm:min-w-56 sm:flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects or clients"
            aria-label="Search projects or clients" className="min-h-11 pl-10 pr-9" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><X size={16} /></button>}
        </div>
        {canFilterByMember && <Select
          className="col-span-2 min-h-11 min-w-0 text-sm sm:w-48"
          aria-label="Filter projects by member"
          value={filters.user_id}
          onChange={(e) => setFilter("user_id", e.target.value)}
        >
          <option value="">All Projects</option>
          {filterUsers.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
        </Select>}
        <Select
          className="min-h-11 min-w-0 text-sm sm:w-36"
          aria-label="Filter by venture"
          value={filters.venture}
          onChange={(e) => setFilter("venture", e.target.value)}
        >
          <option value="">All Ventures</option>
          {VENTURES.map((v) => <option key={v}>{v}</option>)}
        </Select>
        <Select
          className="min-h-11 min-w-0 text-sm sm:w-36"
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select
          className="col-span-2 min-h-11 min-w-0 text-sm sm:w-36"
          aria-label="Filter by category"
          value={filters.category}
          onChange={(e) => setFilter("category", e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id}>{c.name}</option>)}
        </Select>
        <Select
          className="col-span-2 min-h-11 min-w-0 text-sm sm:w-44"
          aria-label="Sort projects"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "name_asc" | "newest" | "oldest")}
        >
          <option value="name_asc">Alphabetical: A to Z</option>
          <option value="newest">Newest to Oldest</option>
          <option value="oldest">Oldest to Newest</option>
        </Select>
        <div className="ml-auto hidden gap-1 md:flex" aria-label="Project view">
          <button
            onClick={() => setView("card")}
            aria-label="Card view"
            className={`p-2 rounded ${view === "card" ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView("table")}
            aria-label="Table view"
            className={`p-2 rounded ${view === "table" ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading…</p>}

      {view === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((p) => {
            const complete = p.status === "Completed" || p.status === "Cancelled" || (p.task_count > 0 && p.done_task_count === p.task_count);
            const days = complete ? null : daysToDeadline(p.target_end_date);
            const completion = pct(p);
            return (
              <Card
                key={p.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${p.name}`}
                className="group min-w-0 cursor-pointer rounded-xl transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => navigate(`/projects/${p.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/projects/${p.id}`); }}
              >
                <CardContent className="p-4">
                  <h3 className="break-words text-base font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">{p.name}</h3>
                  {p.client && (
                    <p className="mt-1 break-words text-xs text-gray-500">{p.client}</p>
                  )}
                  <div className="mb-4 mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={`max-w-full break-words rounded-full px-2 py-0.5 text-xs font-medium ${ventureColor[p.venture]}`}>{p.venture}</span>
                    <Badge variant={(projectStatusColor[p.status] as any) ?? "secondary"}>
                      {p.status}
                    </Badge>
                    <Badge variant="secondary">{p.category}</Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{p.done_task_count}/{p.task_count} tasks</span>
                      <span>{completion}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </div>
                  {creatorControl(p)}

                  {complete ? <div className="text-xs font-medium text-emerald-700">Work complete</div> : days !== null && (
                    <div className={`flex items-center gap-1 text-xs ${deadlineClass(days)}`}>
                      <CalendarDays size={12} />
                      {days < 0
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                        ? "Due today"
                        : `${days}d to deadline`}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-end gap-1 text-xs font-semibold text-blue-700 group-hover:text-blue-800">
                    Open project <ArrowRight size={14} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && visibleProjects.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">{hasFilters ? "No projects match your filters." : "No projects yet. Create your first project."}</p>
              {hasFilters && <Button variant="outline" size="sm" className="mt-3 min-h-10" onClick={() => { setSearch(""); setFilters({ venture: "", status: "", category: "", user_id: "" }); }}>Clear filters</Button>}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Client", "Venture", "Status", "Progress", "Deadline", "Created by"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!isLoading && visibleProjects.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">{hasFilters ? "No projects match your filters." : "No projects yet."}</td></tr>}
              {visibleProjects.map((p) => {
                const complete = p.status === "Completed" || p.status === "Cancelled" || (p.task_count > 0 && p.done_task_count === p.task_count);
                const days = complete ? null : daysToDeadline(p.target_end_date);
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.client ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ventureColor[p.venture]}`}>
                        {p.venture}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={(projectStatusColor[p.status] as any) ?? "secondary"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{pct(p)}%</td>
                    <td className={`px-4 py-3 ${deadlineClass(days)}`}>
                      {complete ? "Complete" : days === null ? "—" : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>{creatorControl(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        templates={templates}
        categories={categories}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// ── Create project dialog ─────────────────────────────────────────────────────

function CreateProjectDialog({
  open, onClose, onSubmit, loading, templates, categories, isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  templates: any[];
  categories: CategoryOption[];
  isAdmin: boolean;
}) {
  const [form, setForm] = useState({
    name: "", client: "", venture: "Finthots" as Venture,
    category: "" as ProjectCategory, status: "Planning" as ProjectStatus,
    description: "", milestone_template_id: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      milestone_template_id: form.milestone_template_id
        ? Number(form.milestone_template_id)
        : undefined,
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="New Project">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <Input value={form.client} onChange={(e) => set("client", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venture *</label>
            <Select value={form.venture} onChange={(e) => set("venture", e.target.value)}>
              {VENTURES.map((v) => <option key={v}>{v}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)} required>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Milestone Template
          </label>
          <Select
            value={form.milestone_template_id}
            onChange={(e) => set("milestone_template_id", e.target.value)}
            disabled={templates.length === 0}
          >
            <option value="">{templates.length ? "None" : "No templates available"}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          {templates.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {isAdmin
                ? "Create one from Admin → Milestone Templates."
                : "An administrator must create a milestone template first."}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={loading || !form.name || !form.category}>
            {loading ? "Creating…" : "Create Project"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
