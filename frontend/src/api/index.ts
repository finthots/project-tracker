import api from "./client";
import type {
  User, Project, Task, Milestone, MilestoneTemplate,
  Comment, ActivityLog, Venture, ProjectCategory, ProjectStatus,
  TaskStatus, TaskPriority, MilestoneStatus, Todo, TodoPriority, CategoryOption, UserNotification,
} from "./types";

export type {
  User, Project, Task, Milestone, MilestoneTemplate,
  Comment, ActivityLog, Venture, ProjectCategory, ProjectStatus,
  TaskStatus, TaskPriority, MilestoneStatus, Todo, TodoPriority, CategoryOption, UserNotification,
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username: string, password: string) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  return api.post<{ access_token: string; user: User }>("/auth/login", form);
};

export const logout = () => api.post("/auth/logout");
export const getMe = () => api.get<User>("/auth/me");
export const setupNeeded = () => api.get<{ setup_needed: boolean }>("/auth/setup-needed");
export const setupAdmin = (username: string, password: string) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  return api.post<{ access_token: string; user: User }>("/auth/setup", form);
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUsers = () => api.get<User[]>("/users");
export const createUser = (data: Partial<User> & { password: string }) =>
  api.post<User>("/users", data);
export const updateUser = (id: number, data: Partial<User> & { password?: string }) =>
  api.patch<User>(`/users/${id}`, data);
export const getCategories = () => api.get<CategoryOption[]>("/categories");
export const createCategory = (name: string) => api.post<{ name: string }>("/categories", { name });
export const deleteCategory = (id: number) => api.delete(`/categories/${id}`);

// ── Projects ──────────────────────────────────────────────────────────────────
export const getProjects = (params?: Record<string, string>) =>
  api.get<Project[]>("/projects", { params });
export const getProject = (id: number) => api.get<Project>(`/projects/${id}`);
export const createProject = (data: Partial<Project> & { milestone_template_id?: number }) =>
  api.post<Project>("/projects", data);
export const updateProject = (id: number, data: Partial<Project>) =>
  api.patch<Project>(`/projects/${id}`, data);
export const deleteProject = (id: number) => api.delete(`/projects/${id}`);

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const getTasks = (projectId: number) =>
  api.get<Task[]>(`/projects/${projectId}/tasks`);
export const createTask = (projectId: number, data: Partial<Task>) =>
  api.post<Task>(`/projects/${projectId}/tasks`, data);
export const getTask = (id: number) => api.get<Task>(`/tasks/${id}`);
export const updateTask = (id: number, data: Partial<Task>) =>
  api.patch<Task>(`/tasks/${id}`, data);
export const deleteTask = (id: number) => api.delete(`/tasks/${id}`);
export const reorderTasks = (projectId: number, taskIds: number[]) =>
  api.post(`/tasks/reorder?project_id=${projectId}`, taskIds);

// ── Milestones ────────────────────────────────────────────────────────────────
export const getMilestones = (projectId: number) =>
  api.get<Milestone[]>(`/projects/${projectId}/milestones`);
export const createMilestone = (projectId: number, data: Partial<Milestone>) =>
  api.post<Milestone>(`/projects/${projectId}/milestones`, data);
export const updateMilestone = (id: number, data: Partial<Milestone>) =>
  api.patch<Milestone>(`/milestones/${id}`, data);
export const deleteMilestone = (id: number) => api.delete(`/milestones/${id}`);
export const getMilestoneTemplates = () =>
  api.get<MilestoneTemplate[]>("/milestone-templates");
export const createMilestoneTemplate = (data: Partial<MilestoneTemplate>) =>
  api.post<MilestoneTemplate>("/milestone-templates", data);

// ── Comments ──────────────────────────────────────────────────────────────────
export const getProjectComments = (projectId: number) =>
  api.get<Comment[]>(`/projects/${projectId}/comments`);
export const addProjectComment = (projectId: number, body: string) =>
  api.post<Comment>(`/projects/${projectId}/comments`, { body });
export const getTaskComments = (taskId: number) =>
  api.get<Comment[]>(`/tasks/${taskId}/comments`);
export const addTaskComment = (taskId: number, body: string) =>
  api.post<Comment>(`/tasks/${taskId}/comments`, { body });
export const deleteComment = (id: number) => api.delete(`/comments/${id}`);

// ── Activity ──────────────────────────────────────────────────────────────────
export const getActivity = (params?: Record<string, string | number>) =>
  api.get<ActivityLog[]>("/activity", { params });
export const getNotifications = () => api.get<{ notifications: UserNotification[]; unread_count: number }>("/notifications");
export const markNotificationRead = (id: number) => api.post<UserNotification>(`/notifications/${id}/read`);

// ── Dashboard ─────────────────────────────────────────────────────────────────
const dashboardParams = (userId?: number) => userId ? { params: { user_id: userId } } : undefined;
export const getMyTasks = (userId?: number) => api.get<Task[]>("/dashboard/my-tasks", dashboardParams(userId));
export const getOverdueTasks = (userId?: number) => api.get<Task[]>("/dashboard/overdue", dashboardParams(userId));
export const getDueThisWeek = (userId?: number) => api.get<Task[]>("/dashboard/due-this-week", dashboardParams(userId));
export const getActiveProjects = (userId?: number) =>
  api.get<{ venture: string; count: number }[]>("/dashboard/active-projects", dashboardParams(userId));
export const getRecentActivity = (userId?: number) =>
  api.get<ActivityLog[]>("/dashboard/recent-activity", dashboardParams(userId));
export const getOverdueCount = (userId?: number) =>
  api.get<{ count: number }>("/dashboard/overdue-count", dashboardParams(userId));
export const getDashboardSummary = (userId?: number) => api.get<{
  active_projects: number; my_open_tasks: number; overdue_tasks: number;
  due_this_week: number; my_todos: number; completed_tasks: number;
}>("/dashboard/summary", dashboardParams(userId));

// ── Ask AI ────────────────────────────────────────────────────────────────────
export const askTracker = (question: string) =>
  api.post<{ answer: string; source: "local" | "tracker" | "huggingface" }>("/ai/ask", { question });

// ── Todos ─────────────────────────────────────────────────────────────────────
export const getTodos = (includeDone = false) =>
  api.get<Todo[]>(`/todos?include_done=${includeDone}`);
export const createTodo = (data: Partial<Todo>) => api.post<Todo>("/todos", data);
export const updateTodo = (id: number, data: Partial<Todo>) =>
  api.patch<Todo>(`/todos/${id}`, data);
export const deleteTodo = (id: number) => api.delete(`/todos/${id}`);

// ── Exports ───────────────────────────────────────────────────────────────────
export const exportProjectXlsx = (id: number) =>
  window.open(`/api/export/projects/${id}/xlsx`, "_blank");
export const exportProjectPdf = (id: number) =>
  window.open(`/api/export/projects/${id}/pdf`, "_blank");
export const exportAllActiveXlsx = () =>
  window.open("/api/export/active-projects/xlsx", "_blank");
