import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMyTasks, getOverdueTasks, getDueThisWeek,
  getActiveProjects, getRecentActivity, getProjects,
  getDashboardSummary,
  getUsers,
} from "@/api";
import type { Task, ActivityLog, Project } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  taskStatusColor, priorityColor, daysToDeadline, deadlineClass, formatDate,
} from "@/lib/statusColors";
import { AlertTriangle, Clock, CheckSquare, BarChart2, Activity, FolderKanban, ArrowRight, ListTodo } from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const selectedMemberId = searchParams.get("user_id") ? Number(searchParams.get("user_id")) : undefined;
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => getUsers().then((r) => r.data) });
  const reportIds = useMemo(() => {
    const seen = new Set<number>();
    let frontier = user ? [user.id] : [];
    while (frontier.length) {
      const next = users.filter((u) => frontier.includes(u.reports_to_id ?? -1)).map((u) => u.id).filter((id) => !seen.has(id));
      next.forEach((id) => seen.add(id));
      frontier = next;
    }
    return seen;
  }, [users, user]);
  const reportOptions = user?.role === "admin" ? users.filter((u) => u.is_active && u.role !== "admin") :
    users.filter((u) => u.role !== "admin" && (reportIds.has(u.id) || u.id === user?.id));
  const selectedMember = users.find((u) => u.id === selectedMemberId);
  const { data: summary } = useQuery({
    queryKey: ["dashboardSummary", selectedMemberId],
    queryFn: () => getDashboardSummary(selectedMemberId).then((r) => r.data),
  });

  const { data: myTasks = [], isLoading: loadingMy } = useQuery({
    queryKey: ["myTasks", selectedMemberId],
    queryFn: () => getMyTasks(selectedMemberId).then((r) => r.data),
  });

  const { data: overdueTasks = [], isLoading: loadingOverdue } = useQuery({
    queryKey: ["overdueTasks", selectedMemberId],
    queryFn: () => getOverdueTasks(selectedMemberId).then((r) => r.data),
  });

  const { data: dueThisWeek = [], isLoading: loadingDue } = useQuery({
    queryKey: ["dueThisWeek", selectedMemberId],
    queryFn: () => getDueThisWeek(selectedMemberId).then((r) => r.data),
  });

  const { data: activeProjects = [], isLoading: loadingActive } = useQuery({
    queryKey: ["activeProjectsChart", selectedMemberId],
    queryFn: () => getActiveProjects(selectedMemberId).then((r) => r.data),
  });

  const { data: recentActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["recentActivity", selectedMemberId],
    queryFn: () => getRecentActivity(selectedMemberId).then((r) => r.data),
  });

  // Fetch full project list for name/client lookup
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects", "dashboard", selectedMemberId],
    queryFn: () => getProjects(selectedMemberId ? { user_id: String(selectedMemberId) } : undefined).then((r) => r.data),
    staleTime: 60_000,
  });

  const projectMap = useMemo(
    () => new Map<number, Project>(allProjects.map((p) => [p.id, p])),
    [allProjects]
  );

  const maxCount = activeProjects.reduce((m, p) => Math.max(m, p.count), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{selectedMember ? `${selectedMember.full_name}'s Dashboard` : "Dashboard"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{selectedMember ? `Work overview for ${selectedMember.username}` : "What needs attention today"}</p>
      </div>
      {(user?.role === "admin" || reportOptions.length > 1) && <div className="max-w-sm">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">View member dashboard</label>
        <Select value={selectedMemberId ? String(selectedMemberId) : ""} onChange={(event) => {
          if (event.target.value) setSearchParams({ user_id: event.target.value });
          else setSearchParams({});
        }}>
          <option value="">My dashboard</option>
          {reportOptions.filter((u) => u.id !== user?.id).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
        </Select>
      </div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard title="Active projects" value={summary?.active_projects} icon={<FolderKanban size={18} />} onClick={() => navigate("/")} />
        <SummaryCard title="My open tasks" value={summary?.my_open_tasks} icon={<CheckSquare size={18} />} onClick={() => document.getElementById("my-tasks")?.scrollIntoView({ behavior: "smooth" })} />
        <SummaryCard title="Overdue" value={summary?.overdue_tasks} icon={<AlertTriangle size={18} />} onClick={() => document.getElementById("overdue-tasks")?.scrollIntoView({ behavior: "smooth" })} tone="red" />
        <SummaryCard title="My to-dos" value={summary?.my_todos} icon={<ListTodo size={18} />} onClick={() => navigate("/todos")} />
      </div>
      <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:grid-cols-2 sm:items-center">
        <span><strong>{summary?.due_this_week ?? "—"}</strong> tasks due this week · <strong>{summary?.completed_tasks ?? "—"}</strong> tasks completed</span>
        <button onClick={() => navigate("/todos")} className="flex items-center gap-1 font-semibold sm:justify-self-end">Open my to-dos <ArrowRight size={15} /></button>
      </div>

      {/* ── My Tasks ─────────────────────────────────────────────────────────── */}
      <div id="my-tasks">
      <Section
        icon={<CheckSquare size={16} className="text-blue-600" />}
        title="My Tasks"
        count={myTasks.length}
      >
        <TaskTable
          tasks={myTasks}
          loading={loadingMy}
          projectMap={projectMap}
          onClickTask={(task) => navigate(`/projects/${task.project_id}`)}
          emptyMessage="You have no assigned tasks."
        />
      </Section>
      </div>

      {/* ── Overdue ──────────────────────────────────────────────────────────── */}
      <div id="overdue-tasks">
      <Section
        icon={<AlertTriangle size={16} className="text-red-500" />}
        title="Overdue Tasks"
        count={overdueTasks.length}
        countColor="bg-red-100 text-red-700"
      >
        <TaskTable
          tasks={overdueTasks}
          loading={loadingOverdue}
          projectMap={projectMap}
          onClickTask={(task) => navigate(`/projects/${task.project_id}`)}
          emptyMessage="No overdue tasks. 🎉"
          highlightOverdue
        />
      </Section>
      </div>

      {/* ── Due This Week ─────────────────────────────────────────────────────── */}
      <Section
        icon={<Clock size={16} className="text-amber-500" />}
        title="Due This Week"
        count={dueThisWeek.length}
        countColor="bg-amber-100 text-amber-700"
      >
        <TaskTable
          tasks={dueThisWeek}
          loading={loadingDue}
          projectMap={projectMap}
          onClickTask={(task) => navigate(`/projects/${task.project_id}`)}
          emptyMessage="Nothing due this week."
        />
      </Section>

      {/* ── Active Projects by Venture ────────────────────────────────────────── */}
      <Section
        icon={<BarChart2 size={16} className="text-purple-600" />}
        title="Active Projects by Venture"
      >
        {loadingActive ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : activeProjects.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No active projects.</p>
        ) : (
          <div className="space-y-3 py-2">
            {activeProjects.map((item) => (
              <div key={item.venture} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                  {item.venture}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: maxCount > 0 ? `${(item.count / maxCount) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-8 text-sm font-semibold text-gray-900 text-right">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Recent Activity ───────────────────────────────────────────────────── */}
      <Section
        icon={<Activity size={16} className="text-gray-500" />}
        title="Recent Activity"
      >
        {loadingActivity ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No recent activity.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentActivity.map((a) => (
              <ActivityRow key={a.id} log={a} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function SummaryCard({ title, value, icon, onClick, tone = "blue" }: {
  title: string; value?: number; icon: React.ReactNode; onClick: () => void; tone?: "blue" | "red";
}) {
  return <button onClick={onClick} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
    <div className={`flex items-center justify-between text-xs font-medium uppercase tracking-wide ${tone === "red" ? "text-red-600" : "text-gray-500"}`}>
      <span>{title}</span>{icon}
    </div>
    <p className="mt-3 text-3xl font-bold text-gray-900">{value ?? "—"}</p>
  </button>;
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  icon, title, count, countColor = "bg-blue-100 text-blue-700", children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  countColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {count !== undefined && (
          <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${countColor}`}>
            {count}
          </span>
        )}
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

// ── Task table ────────────────────────────────────────────────────────────────

function TaskTable({
  tasks, loading, projectMap, onClickTask, emptyMessage, highlightOverdue = false,
}: {
  tasks: Task[];
  loading: boolean;
  projectMap: Map<number, Project>;
  onClickTask: (task: Task) => void;
  emptyMessage: string;
  highlightOverdue?: boolean;
}) {
  if (loading) return <p className="text-sm text-gray-400 py-4">Loading…</p>;
  if (tasks.length === 0) return <p className="text-sm text-gray-400 py-4">{emptyMessage}</p>;

  return (
    <div className="-mx-5">
      <div className="divide-y divide-gray-100 md:hidden">
        {tasks.map((task) => {
          const project = projectMap.get(task.project_id);
          const days = daysToDeadline(task.planned_end);
          const late = task.status !== "Done" && days !== null && days < 0;
          return <button key={task.id} onClick={() => onClickTask(task)} className="block w-full px-5 py-3 text-left hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3"><p className="font-medium text-gray-900">{task.title}</p>
              <Badge variant={(priorityColor[task.priority] as any) ?? "secondary"}>{task.priority}</Badge></div>
            <p className="mt-1 text-xs text-gray-500">{project?.name ?? `Project #${task.project_id}`} · {project?.client ?? "No client"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><Badge variant={(taskStatusColor[task.status] as any) ?? "secondary"}>{task.status}</Badge>
              <span className={late ? "font-semibold text-red-600" : "text-gray-500"}>
                {task.planned_end ? late ? `${Math.abs(days!)}d overdue` : formatDate(task.planned_end) : "No due date"}
              </span></div>
          </button>;
        })}
      </div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Title", "Project", "Client", "Status", "Priority", "Due"].map((h) => (
              <th
                key={h}
                className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => {
            const days = daysToDeadline(task.planned_end);
            const project = projectMap.get(task.project_id);
            const isOverdue = task.status !== "Done" && days !== null && days < 0;
            return (
              <tr
                key={task.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onClickTask(task)}
              >
                <td className="px-5 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">
                  {task.title}
                </td>
                <td className="px-5 py-2.5 text-gray-700 max-w-[150px] truncate">
                  {project?.name ?? `Project #${task.project_id}`}
                </td>
                <td className="px-5 py-2.5 text-gray-500 max-w-[120px] truncate">
                  {project?.client ?? "—"}
                </td>
                <td className="px-5 py-2.5">
                  <Badge variant={(taskStatusColor[task.status] as any) ?? "secondary"}>
                    {task.status}
                  </Badge>
                </td>
                <td className="px-5 py-2.5">
                  <Badge variant={(priorityColor[task.priority] as any) ?? "secondary"}>
                    {task.priority}
                  </Badge>
                </td>
                <td
                  className={`px-5 py-2.5 text-xs whitespace-nowrap ${
                    highlightOverdue && isOverdue
                      ? "text-red-600 font-semibold"
                      : task.status === "Done" ? "text-gray-500" : deadlineClass(days)
                  }`}
                >
                  {task.planned_end
                    ? isOverdue
                      ? `${Math.abs(days!)}d overdue`
                      : days === 0
                      ? "Today"
                      : formatDate(task.planned_end)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ log }: { log: ActivityLog }) {
  return (
    <div className="py-2.5 flex items-start gap-3">
      <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold mt-0.5">
        {log.user?.full_name?.[0] ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{log.user?.full_name ?? "System"}</span>{" "}
          <span className="text-gray-500">{log.action}</span>{" "}
          <span className="capitalize text-gray-600">{log.entity_type}</span>{" "}
          <span className="text-gray-500">#{log.entity_id}</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
        </p>
      </div>
    </div>
  );
}
