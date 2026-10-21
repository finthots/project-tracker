export type UserRole = "admin" | "member";
export type Venture = "Finthots" | "Sunyukth" | "Personal";
export type ProjectCategory = string;
export interface CategoryOption { id: number; name: string }
export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed" | "Cancelled";
export type TaskStatus = "Not Started" | "In Progress" | "Blocked" | "Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";
export type TodoPriority = "Low" | "Medium" | "High" | "Critical";
export type MilestoneStatus = "Pending" | "Hit" | "Missed" | "Shared" | "Signed off";

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  email_digest_enabled: boolean;
  reports_to_id?: number | null;
  reports_to?: UserBrief | null;
  created_at?: string;
}

export interface UserBrief {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
}

export interface Project {
  id: number;
  name: string;
  client?: string;
  venture: Venture;
  category: ProjectCategory;
  status: ProjectStatus;
  start_date?: string;
  target_end_date?: string;
  actual_end_date?: string;
  description?: string;
  created_by_id: number;
  created_by?: UserBrief;
  collaborators_ids?: number[];
  collaborators?: UserBrief[];
  created_at?: string;
  updated_at?: string;
  task_count: number;
  done_task_count: number;
}

export interface Task {
  id: number;
  project_id: number;
  sequence: number;
  title: string;
  description?: string;
  owner_id?: number;
  owner?: UserBrief;
  status: TaskStatus;
  priority: TaskPriority;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string;
  actual_end?: string;
  depends_on_task_id?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  target_date?: string;
  status: MilestoneStatus;
  notes?: string;
  sequence: number;
  pending_with?: string;  // "u:<id>" | "Freelancer" | "Client" | undefined
}

export interface MilestoneTemplateItem {
  id: number;
  name: string;
  sequence: number;
}

export interface MilestoneTemplate {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  items: MilestoneTemplateItem[];
}

export interface Comment {
  id: number;
  task_id?: number;
  project_id?: number;
  user_id: number;
  user?: UserBrief;
  body: string;
  created_at?: string;
}

export interface ActivityLog {
  id: number;
  user_id?: number;
  user?: UserBrief;
  entity_type: string;
  entity_id: number;
  action: string;
  before_json?: string;
  after_json?: string;
  created_at?: string;
}

export interface UserNotification {
  id: number;
  kind: "collaboration_added" | "task_assigned";
  message: string;
  project_id?: number | null;
  task_id?: number | null;
  created_at?: string;
  read_at?: string | null;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  notes?: string;
  priority: TodoPriority;
  due_date?: string;
  is_done: boolean;
  created_at?: string;
  updated_at?: string;
}
