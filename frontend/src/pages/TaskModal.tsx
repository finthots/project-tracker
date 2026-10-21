import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTasks, updateTask, getTaskComments, addTaskComment, getUsers,
} from "@/api";
import type { Task, TaskStatus, TaskPriority } from "@/api/types";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { taskStatusColor, priorityColor, toDateInput } from "@/lib/statusColors";
import { CheckCircle, Send, Check } from "lucide-react";

const TASK_STATUSES: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Review", "Done"];
const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Critical"];

interface TaskModalProps {
  taskId: number | null;
  projectId: number;
  onClose: () => void;
}

export function TaskModal({ taskId, projectId, onClose }: TaskModalProps) {
  const qc = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId).then((r) => r.data),
    enabled: taskId !== null,
  });

  const task = tasks.find((t) => t.id === taskId) ?? null;

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
    enabled: taskId !== null,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["taskComments", taskId],
    queryFn: () => getTaskComments(taskId!).then((r) => r.data),
    enabled: taskId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) => updateTask(taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      setSaveError("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      setSaveError(
        Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join("; ")
          : detail ?? "Save failed."
      );
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => addTaskComment(taskId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskComments", taskId] });
      setCommentBody("");
    },
  });

  // Clear flash when switching tasks
  useEffect(() => {
    setSavedFlash(false);
    setSaveError("");
  }, [taskId]);

  const handleField = (field: keyof Task, value: string | number | null) => {
    setSaveError("");
    updateMutation.mutate({ [field]: value });
  };

  const handleMarkDone = () => {
    const today = new Date().toISOString().split("T")[0];
    updateMutation.mutate({ status: "Done", actual_end: today });
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    addCommentMutation.mutate(commentBody.trim());
  };

  if (taskId === null) return null;

  return (
    <Dialog open={taskId !== null} onClose={onClose} title={task?.title ?? "Task"} className="max-w-3xl">
      {!task ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="space-y-5">

          {/* Save feedback banner */}
          {savedFlash && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
              <Check size={14} /> Saved
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {saveError}
            </div>
          )}

          {/* Saving spinner in title area */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Title</label>
              <EditableField
                value={task.title}
                onSave={(v) => handleField("title", v)}
                className="text-lg font-semibold text-gray-900"
              />
            </div>
            {updateMutation.isPending && (
              <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">Saving…</span>
            )}
          </div>

          {/* Status / Priority / Owner row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Status</label>
              <Select
                value={task.status}
                onChange={(e) => handleField("status", e.target.value)}
                className="text-sm"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <div className="mt-1">
                <Badge variant={(taskStatusColor[task.status] as any) ?? "secondary"}>
                  {task.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Priority</label>
              <Select
                value={task.priority}
                onChange={(e) => handleField("priority", e.target.value)}
                className="text-sm"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <div className="mt-1">
                <Badge variant={(priorityColor[task.priority] as any) ?? "secondary"}>
                  {task.priority}
                </Badge>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Owner</label>
              <Select
                value={task.owner_id?.toString() ?? ""}
                onChange={(e) =>
                  handleField("owner_id", e.target.value ? Number(e.target.value) : null)
                }
                className="text-sm"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </Select>
              {task.owner && (
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {task.owner.full_name[0]}
                  </div>
                  <span className="text-sm text-gray-700">{task.owner.full_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Description</label>
            <EditableTextarea
              value={task.description ?? ""}
              onSave={(v) => handleField("description", v)}
              placeholder="Add a description…"
            />
          </div>

          {/* Dates grid — values stripped to YYYY-MM-DD so the date picker displays correctly */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Planned Start</label>
              <Input
                type="date"
                value={toDateInput(task.planned_start)}
                onChange={(e) => handleField("planned_start", e.target.value || null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Planned End</label>
              <Input
                type="date"
                value={toDateInput(task.planned_end)}
                onChange={(e) => handleField("planned_end", e.target.value || null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Actual Start</label>
              <Input
                type="date"
                value={toDateInput(task.actual_start)}
                onChange={(e) => handleField("actual_start", e.target.value || null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Actual End</label>
              <Input
                type="date"
                value={toDateInput(task.actual_end)}
                onChange={(e) => handleField("actual_end", e.target.value || null)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Dependency */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Depends On Task</label>
            <Select
              value={task.depends_on_task_id?.toString() ?? ""}
              onChange={(e) =>
                handleField("depends_on_task_id", e.target.value ? Number(e.target.value) : null)
              }
              className="text-sm"
            >
              <option value="">None</option>
              {tasks
                .filter((t) => t.id !== taskId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.sequence} {t.title}
                  </option>
                ))}
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
            <EditableTextarea
              value={task.notes ?? ""}
              onSave={(v) => handleField("notes", v)}
              placeholder="Internal notes…"
            />
          </div>

          {/* Mark Done */}
          {task.status !== "Done" && (
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleMarkDone}
                disabled={updateMutation.isPending}
              >
                <CheckCircle size={14} />
                Mark Done
              </Button>
            </div>
          )}

          {/* Comments */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments</h3>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-sm text-gray-400">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-bold">
                    {c.user?.full_name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-700">
                        {c.user?.full_name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handlePostComment} className="flex gap-2">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="flex-1 min-h-0"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!commentBody.trim() || addCommentMutation.isPending}
                className="self-end"
              >
                <Send size={13} />
                Post
              </Button>
            </form>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ── Inline edit helpers ────────────────────────────────────────────────────────

function EditableField({
  value, onSave, className = "",
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
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        className={className}
      />
    );
  }
  return (
    <span
      className={`cursor-pointer hover:bg-gray-50 px-1 rounded ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span className="text-gray-400 italic">Click to edit</span>}
    </span>
  );
}

function EditableTextarea({
  value, onSave, placeholder = "",
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
        <div className="flex gap-2 mt-1">
          <Button size="sm" variant="primary" onClick={() => {
            setEditing(false);
            if (draft !== value) onSave(draft);
          }}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setEditing(false);
            setDraft(value);
          }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded border border-transparent hover:border-gray-200 min-h-[40px] text-sm text-gray-700 whitespace-pre-wrap"
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
    </div>
  );
}
