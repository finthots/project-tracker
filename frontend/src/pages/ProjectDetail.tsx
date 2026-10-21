import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import {
  getTasks, getMilestones, getProjectComments, getActivity, addProjectComment,
  createTask, updateTask, deleteTask, reorderTasks, createMilestone, updateMilestone,
  deleteMilestone, updateProject, deleteProject, exportProjectXlsx, exportProjectPdf,
  getProject, getUsers, getCategories,
} from "@/api";
import type {
  Task, Milestone, Comment, ActivityLog,
  TaskStatus, TaskPriority, MilestoneStatus,
  ProjectStatus, Venture,
  CategoryOption,
} from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import {
  priorityColor, ventureColor, daysToDeadline, deadlineClass, toDateInput, formatDate,
} from "@/lib/statusColors";
import { useAuth } from "@/hooks/useAuth";
import { TaskModal } from "./TaskModal";
import {
  GripVertical, Link2, Trash2, Plus, FileText,
  FileSpreadsheet, ChevronLeft, Send, Pencil, CheckSquare, Check, X,
} from "lucide-react";

const PROJECT_STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];
const VENTURES: Venture[] = ["Finthots", "Sunyukth", "Personal"];
const TASK_STATUSES: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Review", "Done"];
const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Critical"];
const MILESTONE_STATUSES: MilestoneStatus[] = ["Pending", "Hit", "Missed", "Shared", "Signed off"];
const TABS = ["Tasks", "Milestones", "Comments", "Activity", "Settings"] as const;
type Tab = typeof TABS[number];

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("Tasks");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskPrefill, setAddTaskPrefill] = useState<Partial<Task> | null>(null);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  // Project data
  const { data: project, isLoading: projLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId).then((r) => r.data),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId).then((r) => r.data),
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => getMilestones(projectId).then((r) => r.data),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["projectComments", projectId],
    queryFn: () => getProjectComments(projectId).then((r) => r.data),
    enabled: activeTab === "Comments",
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", projectId],
    queryFn: () =>
      getActivity({ entity_type: "project", entity_id: projectId }).then((r) => r.data),
    enabled: activeTab === "Activity",
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
  });
  const teamIds = new Set<number>(user ? [user.id] : []);
  let expandedTeam = true;
  while (expandedTeam) {
    expandedTeam = false;
    for (const member of users) {
      if (member.reports_to_id && teamIds.has(member.reports_to_id) && !teamIds.has(member.id)) {
        teamIds.add(member.id);
        expandedTeam = true;
      }
    }
  }
  const canManageCollaborators = Boolean(user && project && (
    isAdmin || user.id === project.created_by_id || teamIds.has(project.created_by_id)
  ));
  const collaboratorOptions = users.filter((member) => member.is_active && (
    isAdmin || teamIds.has(member.id) || member.id === project?.created_by_id
  ));
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then((r) => r.data),
  });

  // Mutations
  const refreshTaskViews = () => {
    qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    for (const key of ["myTasks", "overdueTasks", "dueThisWeek", "overdueCount", "dashboardSummary"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
  const updateProjectMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProject>[1]) =>
      updateProject(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => navigate("/"),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: Parameters<typeof createTask>[1]) =>
      createTask(projectId, data),
    onSuccess: () => {
      refreshTaskViews();
      setShowAddTask(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: refreshTaskViews,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: refreshTaskViews,
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => reorderTasks(projectId, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (data: Parameters<typeof createMilestone>[1]) =>
      createMilestone(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      setShowAddMilestone(false);
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Milestone> }) =>
      updateMilestone(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (id: number) => deleteMilestone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => addProjectComment(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projectComments", projectId] });
      setCommentBody("");
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const ordered = Array.from(tasks).sort((a, b) => a.sequence - b.sequence);
    const [moved] = ordered.splice(result.source.index, 1);
    ordered.splice(result.destination.index, 0, moved);
    reorderMutation.mutate(ordered.map((t) => t.id));
  };

  if (projLoading || !project) {
    return <p className="text-gray-500 text-sm p-6">Loading project…</p>;
  }

  const sortedTasks = [...tasks].sort((a, b) => a.sequence - b.sequence);
  const sortedMilestones = [...milestones].sort((a, b) => a.sequence - b.sequence);
  const workComplete = project.status === "Completed" || project.status === "Cancelled" ||
    (project.task_count > 0 && project.done_task_count === project.task_count);
  const projectDays = workComplete ? null : daysToDeadline(project.target_end_date);
  const progress = project.task_count > 0
    ? Math.round((project.done_task_count / project.task_count) * 100) : 0;
  const milestoneActions = (milestone: Milestone) => ({
    milestone,
    users,
    onUpdate: (data: Partial<Milestone>) => updateMilestoneMutation.mutate({ id: milestone.id, data }),
    onDelete: () => {
      if (confirm(`Delete milestone "${milestone.name}"?`)) deleteMilestoneMutation.mutate(milestone.id);
    },
    onAddAsTask: () => {
      setAddTaskPrefill({ title: milestone.name, planned_end: milestone.target_date?.split("T")[0] as any });
      setShowAddTask(true);
      setActiveTab("Tasks");
    },
  });

  return (
    <div>
      {/* Back navigation */}
      <button
        onClick={() => navigate("/")}
        className="mb-3 flex min-h-11 items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft size={16} /> Projects
      </button>

      {/* Project header */}
      <div className="mb-5 min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="min-w-0">
          <InlineEditField
            value={project.name}
            onSave={(v) => updateProjectMutation.mutate({ name: v })}
            className="text-xl font-bold leading-snug text-gray-900 sm:text-2xl"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`max-w-full break-words rounded-full px-2.5 py-1 text-xs font-medium ${ventureColor[project.venture]}`}>
            {project.venture}
          </span>
          <Badge variant="secondary">{project.category}</Badge>
          <label className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-gray-500">Status</span>
            <Select
              value={project.status}
              aria-label="Project status"
              onChange={(e) => updateProjectMutation.mutate({ status: e.target.value as ProjectStatus })}
              className="min-h-11 min-w-0 flex-1 text-sm sm:w-40 sm:flex-none"
            >
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
        </div>

        {project.client && (
          <p className="mt-3 break-words text-sm text-gray-600">Client: <span className="font-medium text-gray-800">{project.client}</span></p>
        )}

        <div className="mt-2 break-words">
          <InlineEditTextarea
            value={project.description ?? ""}
            onSave={(v) => updateProjectMutation.mutate({ description: v })}
            placeholder="Add a project description…"
          />
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs text-gray-600">
            <span><strong className="text-gray-900">{project.done_task_count}/{project.task_count}</strong> tasks done</span>
            <span className={projectDays !== null && projectDays < 0 ? "font-semibold text-red-600" : ""}>
              {workComplete ? "Work complete" : projectDays === null ? "No target date" :
                projectDays < 0 ? `${Math.abs(projectDays)}d overdue` : projectDays === 0 ? "Due today" : `${projectDays}d to deadline`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200" aria-label={`${progress}% of tasks complete`}>
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 w-full whitespace-nowrap sm:w-auto"
            onClick={() => exportProjectPdf(projectId)}
          >
            <FileText size={15} className="shrink-0" /> Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 w-full whitespace-nowrap sm:w-auto"
            onClick={() => exportProjectXlsx(projectId)}
          >
            <FileSpreadsheet size={15} className="shrink-0" /> Export XLSX
          </Button>
          {isAdmin && (
            <Button
              variant="danger"
              size="sm"
              className="col-span-2 min-h-11 w-full whitespace-nowrap sm:ml-auto sm:w-auto"
              onClick={() => {
                if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                  deleteProjectMutation.mutate();
                }
              }}
              disabled={deleteProjectMutation.isPending}
            >
              <Trash2 size={15} className="shrink-0" /> Delete Project
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 border-b border-gray-200">
        <nav className="grid grid-cols-3 gap-1 pb-1 sm:flex sm:gap-1 sm:pb-0" aria-label="Project sections">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? "page" : undefined}
              className={`min-h-11 rounded-md border-b-2 px-2 py-2 text-xs font-medium transition-colors sm:rounded-none sm:px-4 sm:py-2.5 sm:text-sm ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
              {tab === "Tasks" && tasks.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tasks Tab ────────────────────────────────────────────────────────── */}
      {activeTab === "Tasks" && (
        <div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tasks">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-white border border-gray-200 rounded-xl overflow-x-auto mb-3"
                >
                  {sortedTasks.length === 0 ? (
                    <p className="text-center text-gray-400 py-10 text-sm">
                      No tasks yet. Add one below.
                    </p>
                  ) : (
                    <>
                    <div className="divide-y divide-gray-100 md:hidden">
                      {sortedTasks.map((task) => {
                        const days = daysToDeadline(task.planned_end);
                        const late = !workComplete && task.status !== "Done" && days !== null && days < 0;
                        return <div key={task.id} role="button" tabIndex={0}
                          onClick={() => setSelectedTaskId(task.id)}
                          onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") setSelectedTaskId(task.id); }}
                          className="space-y-2 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0 break-words text-sm font-semibold text-gray-900">{task.title}</span>
                            <Badge variant={(priorityColor[task.priority] as any) ?? "secondary"}>{task.priority}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">{task.owner?.full_name ?? "Unassigned"}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Select value={task.status} aria-label={`Status for ${task.title}`}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => updateTaskMutation.mutate({ id: task.id, data: { status: event.target.value as TaskStatus } })}
                              className="min-h-11 w-auto max-w-full text-xs">
                              {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                            </Select>
                            <span className={`text-xs ${late ? "font-semibold text-red-600" : "text-gray-500"}`}>
                              {task.planned_end ? late ? `${Math.abs(days!)}d overdue` : formatDate(task.planned_end) : "No due date"}
                            </span>
                          </div>
                        </div>;
                      })}
                    </div>
                    <table className="hidden min-w-[760px] w-full text-sm md:table">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="w-8" />
                          <th className="w-10 px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedTasks.map((task, index) => {
                          const days = daysToDeadline(task.planned_end);
                          return (
                            <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                              {(drag, snapshot) => (
                                <tr
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  className={`hover:bg-gray-50 cursor-pointer ${
                                    snapshot.isDragging ? "bg-blue-50 shadow-md" : ""
                                  }`}
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  <td
                                    className="px-2 text-gray-400 cursor-grab"
                                    {...drag.dragHandleProps}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical size={14} />
                                  </td>
                                  <td className="px-3 py-2.5 text-gray-400 text-xs">
                                    {task.sequence}
                                  </td>
                                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-xs truncate">
                                    <span className="flex items-center gap-1.5">
                                      {task.title}
                                      {task.depends_on_task_id && (
                                        <Link2
                                          size={12}
                                          className="text-gray-400 flex-shrink-0"
                                        />
                                      )}
                                    </span>
                                  </td>
                                  <td
                                    className="px-3 py-2.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {task.owner ? (
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                          {task.owner.full_name[0]}
                                        </div>
                                        <span className="text-xs text-gray-600 truncate max-w-[80px]">
                                          {task.owner.full_name}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Select
                                      value={task.status}
                                      onChange={(e) =>
                                        updateTaskMutation.mutate({
                                          id: task.id,
                                          data: { status: e.target.value as TaskStatus },
                                        })
                                      }
                                      className="text-xs py-0.5 px-2 h-7"
                                    >
                                      {TASK_STATUSES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </Select>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge
                                      variant={(priorityColor[task.priority] as any) ?? "secondary"}
                                    >
                                      {task.priority}
                                    </Badge>
                                  </td>
                                  <td className={`px-3 py-2.5 text-xs ${workComplete || task.status === "Done" ? "text-gray-500" : deadlineClass(days)}`}>
                                    {task.planned_end
                                      ? !workComplete && task.status !== "Done" && days !== null && days < 0
                                        ? `${Math.abs(days)}d overdue`
                                        : days === 0
                                        ? "Today"
                                        : formatDate(task.planned_end)
                                      : "—"}
                                  </td>
                                  <td
                                    className="px-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      aria-label={`Delete task ${task.title}`}
                                      className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                      onClick={() => {
                                        if (confirm("Delete this task?")) {
                                          deleteTaskMutation.mutate(task.id);
                                        }
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          );
                        })}
                      </tbody>
                    </table>
                    </>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Inline quick-add row */}
          {showInlineAdd && (
            <InlineAddTaskRow
              users={users}
              onSubmit={(data) => {
                createTaskMutation.mutate(data);
                setShowInlineAdd(false);
              }}
              onCancel={() => setShowInlineAdd(false)}
            />
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
            <Button size="sm" className="min-h-11" onClick={() => { setShowInlineAdd(true); setShowAddTask(false); }}>
              <Plus size={14} /> Quick Add Task
            </Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => { setAddTaskPrefill(null); setShowAddTask(true); }}>
              <Plus size={14} /> Full Form
            </Button>
          </div>
        </div>
      )}

      {/* ── Milestones Tab ───────────────────────────────────────────────────── */}
      {activeTab === "Milestones" && (
        <div>
          {/* Timeline strip */}
          {sortedMilestones.length > 0 && (
            <div className="mb-4 hidden overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 md:block">
              <div className="relative flex items-center gap-0 min-w-max">
                {sortedMilestones.map((m, i) => (
                  <div key={m.id} className="flex items-center">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          m.status === "Hit"
                            ? "bg-green-100 border-green-500 text-green-700"
                            : m.status === "Missed"
                            ? "bg-red-100 border-red-500 text-red-700"
                            : "bg-gray-100 border-gray-400 text-gray-600"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <span className="text-xs text-gray-700 font-medium text-center max-w-[80px] leading-tight">
                        {m.name}
                      </span>
                      {m.target_date && (
                        <span className="text-xs text-gray-400">{formatDate(m.target_date)}</span>
                      )}
                    </div>
                    {i < sortedMilestones.length - 1 && (
                      <div className="w-12 h-0.5 bg-gray-300 mx-1 mb-6" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones: editable cards on phones, table on larger screens */}
          <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white md:overflow-x-auto">
            {sortedMilestones.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No milestones yet.</p>
            ) : (
              <>
              <div className="divide-y divide-gray-100 md:hidden">
                {sortedMilestones.map((m) => <MilestoneCard key={m.id} {...milestoneActions(m)} />)}
              </div>
              <table className="hidden min-w-[700px] w-full text-sm md:table">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["#", "Name", "Target Date", "Status", "Pending With", "Notes", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedMilestones.map((m) => <MilestoneRow key={m.id} {...milestoneActions(m)} />)}
                </tbody>
              </table>
              </>
            )}
          </div>

          <Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => setShowAddMilestone(true)}>
            <Plus size={14} /> Add Milestone
          </Button>
        </div>
      )}

      {/* ── Comments Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "Comments" && (
        <div className="max-w-2xl">
          <div className="space-y-4 mb-5">
            {comments.length === 0 && (
              <p className="text-gray-400 text-sm">No comments yet.</p>
            )}
            {comments.map((c) => (
              <CommentCard key={c.id} comment={c} />
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentBody.trim()) addCommentMutation.mutate(commentBody.trim());
            }}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              rows={3}
              className="mb-3"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!commentBody.trim() || addCommentMutation.isPending}
              >
                <Send size={13} /> Post Comment
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Activity Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "Activity" && (
        <div className="max-w-2xl">
          {activity.length === 0 ? (
            <p className="text-gray-400 text-sm">No activity recorded.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <ActivityItem key={a.id} log={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab — always mounted so form state survives tab switches ── */}
      <div className={activeTab === "Settings" ? "" : "hidden"}>
        <ProjectSettings
          project={project}
          users={users}
          categories={categories}
          isAdmin={isAdmin}
          canManageCollaborators={canManageCollaborators}
          collaboratorOptions={collaboratorOptions}
          onUpdate={(data) => updateProjectMutation.mutateAsync(data)}
          onDelete={
            isAdmin
              ? () => {
                  if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                    deleteProjectMutation.mutate();
                  }
                }
              : undefined
          }
          saving={updateProjectMutation.isPending}
        />
      </div>

      {/* Task modal */}
      {selectedTaskId !== null && (
        <TaskModal
          taskId={selectedTaskId}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={showAddTask}
        onClose={() => { setShowAddTask(false); setAddTaskPrefill(null); }}
        onSubmit={(data) => createTaskMutation.mutate(data)}
        loading={createTaskMutation.isPending}
        users={users}
        tasks={tasks}
        prefill={addTaskPrefill ?? undefined}
      />

      {/* Add Milestone Dialog */}
      <AddMilestoneDialog
        open={showAddMilestone}
        onClose={() => setShowAddMilestone(false)}
        onSubmit={(data) => createMilestoneMutation.mutate(data)}
        loading={createMilestoneMutation.isPending}
        users={users}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InlineEditField({
  value,
  onSave,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== value) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            if (draft.trim() && draft !== value) onSave(draft.trim());
          }
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
        className={`min-w-0 ${className}`}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={`Edit ${value}`}
      className={`group flex max-w-full min-w-0 items-start gap-2 text-left ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{value}</span>
      <Pencil size={15} className="mt-1 shrink-0 text-gray-400 sm:opacity-0 sm:group-hover:opacity-100" />
    </button>
  );
}

function InlineEditTextarea({
  value,
  onSave,
  placeholder = "",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={placeholder}
        />
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={() => {
              setEditing(false);
              if (draft !== value) onSave(draft);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setDraft(value);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <p
      className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 px-1 py-1 rounded"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
    </p>
  );
}

function MilestoneCard({
  milestone, users, onUpdate, onDelete, onAddAsTask,
}: {
  milestone: Milestone;
  users: any[];
  onUpdate: (data: Partial<Milestone>) => void;
  onDelete: () => void;
  onAddAsTask: () => void;
}) {
  return <article className="min-w-0 space-y-3 p-4">
    <div className="flex min-w-0 items-start justify-between gap-2">
      <InlineEditField value={milestone.name} onSave={(name) => onUpdate({ name })}
        className="min-w-0 text-sm font-semibold text-gray-900" />
      <span className="shrink-0 text-xs text-gray-400">#{milestone.sequence}</span>
    </div>
    <div className="grid gap-3">
      <label className="min-w-0 text-xs font-medium text-gray-600">Target date
        <Input type="date" value={milestone.target_date ? milestone.target_date.split("T")[0] : ""}
          onChange={(e) => onUpdate({ target_date: e.target.value || undefined })}
          className="mt-1 min-h-11 min-w-0" />
      </label>
      <label className="min-w-0 text-xs font-medium text-gray-600">Status
        <Select value={milestone.status} onChange={(e) => onUpdate({ status: e.target.value as MilestoneStatus })}
          className="mt-1 min-h-11 min-w-0">
          {MILESTONE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </Select>
      </label>
      <label className="min-w-0 text-xs font-medium text-gray-600">Pending with
        <Select value={milestone.pending_with ?? ""} onChange={(e) => onUpdate({ pending_with: e.target.value || undefined })}
          className="mt-1 min-h-11 min-w-0">
          <option value="">—</option>
          <optgroup label="Team">
            {users.filter((u) => u.is_active).map((u) => <option key={u.id} value={`u:${u.id}`}>{u.full_name}</option>)}
          </optgroup>
          <optgroup label="External"><option value="Freelancer">Freelancer</option><option value="Client">Client</option></optgroup>
        </Select>
      </label>
    </div>
    {milestone.notes && <p className="break-words text-xs leading-5 text-gray-600">{milestone.notes}</p>}
    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
      <Button size="sm" variant="outline" className="min-h-10 flex-1" onClick={onAddAsTask}>
        <CheckSquare size={15} /> Make task
      </Button>
      <Button size="sm" variant="outline" className="min-h-10 flex-1 border-red-200 text-red-700 hover:bg-red-50" onClick={onDelete}>
        <Trash2 size={15} /> Delete
      </Button>
    </div>
  </article>;
}

function MilestoneRow({
  milestone,
  users,
  onUpdate,
  onDelete,
  onAddAsTask,
}: {
  milestone: Milestone;
  users: any[];
  onUpdate: (data: Partial<Milestone>) => void;
  onDelete: () => void;
  onAddAsTask: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(milestone.name);

  // Build the "Pending with" dropdown value
  const pendingVal = milestone.pending_with ?? "";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5 text-gray-400 text-xs">{milestone.sequence}</td>

      {/* Name — inline editable */}
      <td className="px-4 py-2.5 font-medium text-gray-900">
        {editingName ? (
          <Input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (nameVal.trim() && nameVal !== milestone.name) onUpdate({ name: nameVal.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditingName(false);
                if (nameVal.trim() && nameVal !== milestone.name) onUpdate({ name: nameVal.trim() });
              }
              if (e.key === "Escape") { setEditingName(false); setNameVal(milestone.name); }
            }}
            className="text-sm py-1"
          />
        ) : (
          <span className="cursor-pointer hover:text-blue-700" onClick={() => setEditingName(true)}>
            {milestone.name}
          </span>
        )}
      </td>

      {/* Target date */}
      <td className="px-4 py-2.5">
        <Input
          type="date"
          value={milestone.target_date ? milestone.target_date.split("T")[0] : ""}
          onChange={(e) => onUpdate({ target_date: e.target.value || undefined })}
          className="text-xs py-1 w-36"
        />
      </td>

      {/* Status */}
      <td className="px-4 py-2.5">
        <Select
          value={milestone.status}
          onChange={(e) => onUpdate({ status: e.target.value as MilestoneStatus })}
          className="text-xs py-1"
        >
          {MILESTONE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </td>

      {/* Pending With */}
      <td className="px-4 py-2.5">
        <Select
          value={pendingVal}
          onChange={(e) => onUpdate({ pending_with: e.target.value || undefined })}
          className="text-xs py-1 min-w-[130px]"
        >
          <option value="">—</option>
          <optgroup label="Team">
            {users.filter((u) => u.is_active).map((u) => (
              <option key={u.id} value={`u:${u.id}`}>{u.full_name}</option>
            ))}
          </optgroup>
          <optgroup label="External">
            <option value="Freelancer">Freelancer</option>
            <option value="Client">Client</option>
          </optgroup>
        </Select>
      </td>

      {/* Notes */}
      <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">
        {milestone.notes ?? "—"}
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-1.5 py-1 rounded hover:bg-blue-50 transition-colors"
            onClick={onAddAsTask}
            title="Create a task from this milestone"
          >
            <CheckSquare size={12} />
            <span className="hidden sm:inline">Task</span>
          </button>
          <button aria-label={`Delete milestone ${milestone.name}`} className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold">
        {comment.user?.full_name?.[0] ?? "?"}
      </div>
      <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-800">
            {comment.user?.full_name ?? "Unknown"}
          </span>
          <span className="text-xs text-gray-400">
            {comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>
      </div>
    </div>
  );
}

function ActivityItem({ log }: { log: ActivityLog }) {
  const before = log.before_json ? tryParseJson(log.before_json) : null;
  const after = log.after_json ? tryParseJson(log.after_json) : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-700 capitalize">
          {log.entity_type} #{log.entity_id}
        </span>
        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
          {log.action}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {log.user?.full_name ?? "System"} &bull;{" "}
          {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
        </span>
      </div>
      {(before || after) && (
        <div className="mt-1 text-xs text-gray-500">
          {before && (
            <span className="text-red-600 mr-2">
              Before: {summarizeJson(before)}
            </span>
          )}
          {after && (
            <span className="text-green-600">
              After: {summarizeJson(after)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function tryParseJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s); } catch { return null; }
}

function summarizeJson(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

// ── Settings Tab Component ─────────────────────────────────────────────────────

function ProjectSettings({
  project,
  users,
  categories,
  isAdmin,
  canManageCollaborators,
  collaboratorOptions,
  onUpdate,
  onDelete,
  saving,
}: {
  project: any;
  users: any[];
  categories: CategoryOption[];
  isAdmin: boolean;
  canManageCollaborators: boolean;
  collaboratorOptions: any[];
  onUpdate: (data: any) => Promise<any>;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const buildForm = (p: any) => ({
    name: p.name ?? "",
    client: p.client ?? "",
    venture: p.venture ?? "",
    category: p.category ?? "",
    created_by_id: p.created_by_id ? String(p.created_by_id) : "",
    collaborators_ids: p.collaborators_ids ?? [],
    status: p.status ?? "",
    start_date: toDateInput(p.start_date),
    target_end_date: toDateInput(p.target_end_date),
    actual_end_date: toDateInput(p.actual_end_date),
    description: p.description ?? "",
  });

  const [form, setForm] = useState(() => buildForm(project));

  // Keep form in sync when the project is first loaded or navigated to a
  // different project (project.id changes). Does NOT reset while user is typing.
  const lastSyncedIdRef = useRef<number>(project.id);
  useEffect(() => {
    if (project.id !== lastSyncedIdRef.current) {
      lastSyncedIdRef.current = project.id;
      setForm(buildForm(project));
    }
  }, [project.id]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSaveError("");
    try {
      const { collaborators_ids, ...projectFields } = form;
      const updated = await onUpdate({
        ...projectFields,
        client: form.client || undefined,
        start_date: form.start_date || undefined,
        target_end_date: form.target_end_date || undefined,
        actual_end_date: form.actual_end_date || undefined,
        description: form.description || undefined,
        ...(canManageCollaborators ? { collaborators_ids } : {}),
      });
      // Re-sync form from the server's response so it reflects what was persisted
      if (updated?.data) setForm(buildForm(updated.data));
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSaveError(Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join("; ")
        : detail ?? "Save failed. Please try again.");
    }
  };

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900">Project Settings</h2>

        {saved && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
            <Check size={14} /> Changes saved successfully.
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            <X size={14} /> {saveError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <Input value={form.client} onChange={(e) => set("client", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venture</label>
            <Select value={form.venture} onChange={(e) => set("venture", e.target.value)}>
              {VENTURES.map((v) => <option key={v}>{v}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => <option key={c.id}>{c.name}</option>)}
            </Select>
          </div>
        </div>
        {isAdmin && <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project created by</label>
          <Select value={form.created_by_id} onChange={(e) => set("created_by_id", e.target.value)}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
          </Select>
        </div>}
        <fieldset className="rounded-lg border border-gray-200 p-3" disabled={!canManageCollaborators}>
          <legend className="px-1 text-sm font-medium text-gray-700">Project collaborators</legend>
          <p className="mb-2 text-xs text-gray-500">
            Collaborators can see this project. The project creator, their reporting manager, or an admin can update this list.
          </p>
          <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {collaboratorOptions.map((member) => (
              <label key={member.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.collaborators_ids.includes(member.id)}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    collaborators_ids: event.target.checked
                      ? [...current.collaborators_ids, member.id]
                      : current.collaborators_ids.filter((id: number) => id !== member.id),
                  }))}
                />
                {member.full_name}
              </label>
            ))}
            {collaboratorOptions.length === 0 && <p className="text-sm text-gray-500">No eligible members.</p>}
          </div>
        </fieldset>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target End</label>
            <Input type="date" value={form.target_end_date} onChange={(e) => set("target_end_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual End</label>
            <Input type="date" value={form.actual_end_date} onChange={(e) => set("actual_end_date", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
          />
        </div>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving || !form.name}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          {onDelete && (
            <Button type="button" variant="danger" className="min-h-11 w-full sm:ml-auto sm:w-auto" onClick={onDelete}>
              <Trash2 size={15} className="shrink-0" /> Delete Project
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Inline Quick-Add Task Row ──────────────────────────────────────────────────

function InlineAddTaskRow({
  users,
  onSubmit,
  onCancel,
}: {
  users: any[];
  onSubmit: (data: Partial<Task>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [plannedEnd, setPlannedEnd] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      status: "Not Started",
      priority,
      owner_id: ownerId ? Number(ownerId) : undefined,
      planned_end: plannedEnd || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex sm:flex-wrap sm:items-end"
    >
      <div className="col-span-2 min-w-0 sm:min-w-[180px] sm:flex-1">
        <label className="block text-xs text-gray-500 mb-1">Task title *</label>
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
          className="min-h-11 text-sm"
        />
      </div>
      <div className="min-w-0 sm:min-w-[120px]">
        <label className="block text-xs text-gray-500 mb-1">Owner</label>
        <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="min-h-11 min-w-0 text-sm">
          <option value="">Unassigned</option>
          {users.filter((u) => u.is_active).map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </Select>
      </div>
      <div className="min-w-0 sm:min-w-[100px]">
        <label className="block text-xs text-gray-500 mb-1">Priority</label>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="min-h-11 min-w-0 text-sm">
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>
      <div className="col-span-2 min-w-0 sm:min-w-[130px]">
        <label className="block text-xs text-gray-500 mb-1">Due date</label>
        <Input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} className="min-h-11 min-w-0 text-sm" />
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex sm:items-end sm:pb-0.5">
        <Button type="submit" size="sm" className="min-h-11" disabled={!title.trim()}>
          <Check size={13} /> Add
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onCancel}>
          <X size={13} /> Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Add Task Dialog ────────────────────────────────────────────────────────────

function AddTaskDialog({
  open, onClose, onSubmit, loading, users, tasks, prefill,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Task>) => void;
  loading: boolean;
  users: any[];
  tasks: Task[];
  prefill?: Partial<Task>;
}) {
  const blank = {
    title: "",
    status: "Not Started" as TaskStatus,
    priority: "Medium" as TaskPriority,
    owner_id: "",
    planned_start: "",
    planned_end: "",
    depends_on_task_id: "",
    description: "",
    notes: "",
  };

  const [form, setForm] = useState(blank);

  // Re-initialize when prefill or open state changes
  useEffect(() => {
    if (open) {
      setForm({
        ...blank,
        title: prefill?.title ?? "",
        planned_end: (prefill?.planned_end as string | undefined) ?? "",
        planned_start: (prefill?.planned_start as string | undefined) ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: form.title,
      status: form.status,
      priority: form.priority,
      owner_id: form.owner_id ? Number(form.owner_id) : undefined,
      planned_start: form.planned_start || undefined,
      planned_end: form.planned_end || undefined,
      depends_on_task_id: form.depends_on_task_id ? Number(form.depends_on_task_id) : undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add Task">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
          <Select value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start</label>
            <Input type="date" value={form.planned_start} onChange={(e) => set("planned_start", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned End</label>
            <Input type="date" value={form.planned_end} onChange={(e) => set("planned_end", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Depends On</label>
          <Select value={form.depends_on_task_id} onChange={(e) => set("depends_on_task_id", e.target.value)}>
            <option value="">None</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>#{t.sequence} {t.title}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={loading || !form.title}>
            {loading ? "Adding…" : "Add Task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Add Milestone Dialog ───────────────────────────────────────────────────────

function AddMilestoneDialog({
  open, onClose, onSubmit, loading, users,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Milestone>) => void;
  loading: boolean;
  users: any[];
}) {
  const [form, setForm] = useState({
    name: "",
    target_date: "",
    status: "Pending" as MilestoneStatus,
    notes: "",
    pending_with: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: form.name,
      target_date: form.target_date || undefined,
      status: form.status,
      notes: form.notes || undefined,
      pending_with: form.pending_with || undefined,
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Add Milestone">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
            <Input type="date" value={form.target_date} onChange={(e) => set("target_date", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pending With</label>
          <Select value={form.pending_with} onChange={(e) => set("pending_with", e.target.value)}>
            <option value="">—</option>
            <optgroup label="Team">
              {users.filter((u) => u.is_active).map((u) => (
                <option key={u.id} value={`u:${u.id}`}>{u.full_name}</option>
              ))}
            </optgroup>
            <optgroup label="External">
              <option value="Freelancer">Freelancer</option>
              <option value="Client">Client</option>
            </optgroup>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={loading || !form.name}>
            {loading ? "Adding…" : "Add Milestone"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
