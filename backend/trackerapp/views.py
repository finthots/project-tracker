from datetime import timedelta
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from .api import (
    PROJECT_STATUSES, TASK_STATUSES, MILESTONE_STATUSES, activity_data, body_data,
    comment_data, current_user, error, hash_password, inward, log_activity,
    milestone_data, parse_date_time, project_data, require_user, set_cookie,
    task_data, template_data, todo_data, user_data, verify_password,
)
from .models import (ActivityLog, Comment, Milestone, MilestoneTemplate,
                     MilestoneTemplateItem, Project, ProjectCategory, Task, Todo, User)


def service_worker(request):
    service_worker_path = Path(settings.FRONTEND_DIST_DIR) / "sw.js"
    response = FileResponse(service_worker_path.open("rb"), content_type="application/javascript")
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache"
    return response


def method(request, *allowed):
    return None if request.method in allowed else error("Method not allowed", 405)


def data_list(items, serialize):
    return JsonResponse([serialize(item) for item in items], safe=False)


def not_found(model, pk):
    return model.objects.filter(pk=pk).first()


def report_ids_for(user):
    """Return all users in a manager's reporting tree, including direct reports."""
    seen = set()
    pending = [user.id]
    while pending:
        ids = list(User.objects.filter(reports_to_id__in=pending).values_list("id", flat=True))
        pending = [pk for pk in ids if pk not in seen]
        seen.update(pending)
    return seen


def dashboard_subject(request):
    actor = request.tracker_user
    raw_id = request.GET.get("user_id")
    if not raw_id:
        return actor, None
    try:
        subject = User.objects.select_related("reports_to").get(pk=int(raw_id), is_active=True)
    except (ValueError, User.DoesNotExist):
        return None, error("Member not found", 404)
    if actor.role != "admin" and subject.id != actor.id and (subject.role == "admin" or subject.id not in report_ids_for(actor)):
        return None, error("You can only view your own dashboard or a member in your reporting line", 403)
    return subject, None


def assign_fields(obj, data, fields, date_fields=(), enum_fields=None):
    enum_fields = enum_fields or {}
    for key in fields:
        if key not in data:
            continue
        value = data[key]
        if key in date_fields:
            value = parse_date_time(value)
        if key in enum_fields:
            value = inward(value, enum_fields[key])
        if key in ("name", "title", "username", "body") and not str(value or "").strip():
            raise ValueError(f"{key} cannot be empty")
        setattr(obj, key, value)


@ensure_csrf_cookie
def auth_view(request, action):
    if action == "setup-needed" and request.method == "GET":
        return JsonResponse({"setup_needed": not User.objects.exists()})
    if action == "me" and request.method == "GET":
        user = current_user(request)
        return JsonResponse(user_data(user)) if user else error("Please sign in", 401)
    if action == "logout" and request.method == "POST":
        response = JsonResponse({"message": "Logged out"})
        response.delete_cookie("tracker_auth")
        return response
    if action not in ("login", "setup") or request.method != "POST":
        return error("Not found", 404)
    data = body_data(request)
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    if not username or not password:
        return error("Username and password are required")
    if action == "setup":
        if User.objects.exists():
            return error("Setup already complete")
        user = User.objects.create(username=username, password_hash=hash_password(password),
                                   full_name="Administrator", email=f"{username}@localhost", role="admin")
    else:
        user = User.objects.filter(username=username).first()
        if not user or not verify_password(password, user.password_hash):
            return error("Invalid credentials", 401)
        if not user.is_active:
            return error("Account disabled", 403)
    return set_cookie(JsonResponse({"access_token": "cookie", "user": user_data(user)}), user)


@require_user
def users_view(request):
    if request.method == "GET":
        return data_list(User.objects.order_by("id"), user_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    if request.tracker_user.role != "admin":
        return error("Admin required", 403)
    data = body_data(request)
    required = ("username", "password", "full_name", "email")
    if any(not str(data.get(key, "")).strip() for key in required):
        return error("Username, password, name and email are required")
    reports_to = None
    reports_to_id = data.get("reports_to_id")
    if reports_to_id not in (None, ""):
        reports_to = User.objects.filter(pk=reports_to_id, is_active=True).first()
        if not reports_to:
            return error("Reporting user not found")
    try:
        user = User.objects.create(username=data["username"].strip(),
                                   password_hash=hash_password(data["password"]),
                                   full_name=data["full_name"].strip(), email=data["email"].strip(),
                                   role=data.get("role", "member"), reports_to=reports_to)
    except IntegrityError:
        return error("Username or email already exists")
    log_activity(request.tracker_user, "user", user.id, "create", after={"username": user.username})
    return JsonResponse(user_data(user), status=201)


@require_user
def user_detail(request, pk):
    user = not_found(User, pk)
    if not user:
        return error("User not found", 404)
    if request.method == "GET":
        return JsonResponse(user_data(user))
    if request.method != "PATCH":
        return error("Method not allowed", 405)
    actor = request.tracker_user
    if actor.role != "admin" and actor.id != user.id:
        return error("Cannot edit other users", 403)
    data = body_data(request)
    before = {"full_name": user.full_name, "email": user.email, "role": user.role,
              "reports_to_id": user.reports_to_id}
    allowed = ("full_name", "email", "email_digest_enabled")
    if actor.role == "admin":
        allowed += ("role", "is_active")
        reports_to_id = data.get("reports_to_id", user.reports_to_id)
        if reports_to_id in (None, ""):
            user.reports_to = None
        else:
            manager = User.objects.filter(pk=reports_to_id, is_active=True).first()
            if not manager:
                return error("Reporting user not found")
            if manager.id == user.id:
                return error("A user cannot report to themselves")
            if user.id in report_ids_for(manager):
                return error("Reporting assignments cannot create a cycle")
            user.reports_to = manager
    try:
        assign_fields(user, data, allowed)
        if data.get("password"):
            user.password_hash = hash_password(data["password"])
        user.save()
    except IntegrityError:
        return error("Email already exists")
    log_activity(actor, "user", user.id, "update", before=before,
                 after={"full_name": user.full_name, "email": user.email})
    response = JsonResponse(user_data(user))
    if actor.id == user.id and data.get("password"):
        set_cookie(response, user)
    return response


@require_user
def projects_view(request):
    if request.method == "GET":
        projects = Project.objects.select_related("created_by").order_by("-created_at")
        if request.GET.get("user_id"):
            subject, denied = dashboard_subject(request)
            if denied:
                return denied
            projects = projects.filter(Q(created_by=subject) | Q(tasks__owner=subject)).distinct()
        elif request.tracker_user.role != "admin":
            visible_user_ids = report_ids_for(request.tracker_user) | {request.tracker_user.id}
            projects = projects.filter(
                Q(created_by_id__in=visible_user_ids) | Q(tasks__owner_id__in=visible_user_ids)
            ).distinct()
        for key in ("venture", "category", "status"):
            value = request.GET.get(key)
            if value:
                projects = projects.filter(**{key: inward(value, PROJECT_STATUSES) if key == "status" else value})
        if request.GET.get("client"):
            projects = projects.filter(client__icontains=request.GET["client"])
        return data_list(projects, project_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    data = body_data(request)
    project = Project(created_by=request.tracker_user)
    try:
        assign_fields(project, data, ("name", "client", "venture", "category", "status", "start_date",
                                      "target_end_date", "description"),
                      ("start_date", "target_end_date"), {"status": PROJECT_STATUSES})
        if not project.name or not project.venture or not project.category:
            return error("Name, venture and category are required")
        if project.start_date and project.target_end_date and project.target_end_date < project.start_date:
            return error("Target date cannot precede start date")
        with transaction.atomic():
            project.save()
            template_id = data.get("milestone_template_id")
            template = MilestoneTemplate.objects.filter(pk=template_id).first() if template_id else None
            if template:
                for item in template.items.all():
                    Milestone.objects.create(project=project, name=item.name, sequence=item.sequence)
    except ValueError as exc:
        return error(str(exc))
    log_activity(request.tracker_user, "project", project.id, "create", after={"name": project.name})
    return JsonResponse(project_data(project), status=201)


@require_user
def project_detail(request, pk):
    project = Project.objects.select_related("created_by").filter(pk=pk).first()
    if not project:
        return error("Project not found", 404)
    if request.method == "GET":
        return JsonResponse(project_data(project))
    if request.method == "DELETE":
        log_activity(request.tracker_user, "project", pk, "delete", before={"name": project.name})
        project.delete()
        return HttpResponse(status=204)
    if request.method != "PATCH":
        return error("Method not allowed", 405)
    data = body_data(request)
    before = {"name": project.name, "status": project.status}
    try:
        assign_fields(project, data, ("name", "client", "venture", "category", "status", "start_date",
                                      "target_end_date", "actual_end_date", "description"),
                      ("start_date", "target_end_date", "actual_end_date"), {"status": PROJECT_STATUSES})
        if request.tracker_user.role == "admin" and "created_by_id" in data:
            creator = User.objects.filter(pk=data["created_by_id"]).first()
            if not creator:
                return error("Project creator not found")
            project.created_by = creator
        project.updated_at = timezone.now()
        project.save()
    except ValueError as exc:
        return error(str(exc))
    log_activity(request.tracker_user, "project", pk, "update", before=before,
                 after={"name": project.name, "status": project.status})
    return JsonResponse(project_data(project))


@require_user
def categories_view(request):
    if request.method == "GET":
        return data_list(ProjectCategory.objects.order_by("name"),
                         lambda category: {"id": category.id, "name": category.name})
    if request.method != "POST":
        return error("Method not allowed", 405)
    if request.tracker_user.role != "admin":
        return error("Admin required", 403)
    name = str(body_data(request).get("name", "")).strip()
    if not name:
        return error("Category name is required")
    if len(name) > 64:
        return error("Category name must be 64 characters or fewer")
    category, created = ProjectCategory.objects.get_or_create(name=name)
    if not created:
        return error("Category already exists", 409)
    return JsonResponse({"name": category.name}, status=201)


@require_user
def category_detail(request, pk):
    if request.method != "DELETE":
        return error("Method not allowed", 405)
    if request.tracker_user.role != "admin":
        return error("Admin required", 403)
    category = ProjectCategory.objects.filter(pk=pk).first()
    if not category:
        return error("Category not found", 404)
    if Project.objects.filter(category=category.name).exists():
        return error("This category is assigned to projects. Reassign those projects before deleting it.", 409)
    category.delete()
    return HttpResponse(status=204)


def validate_task_refs(project_id, owner_id, dependency_id, self_id=None):
    if owner_id is not None and not User.objects.filter(pk=owner_id).exists():
        return "Owner does not exist"
    if dependency_id is not None:
        if self_id == dependency_id:
            return "A task cannot depend on itself"
        dep = Task.objects.filter(pk=dependency_id).first()
        if not dep or dep.project_id != project_id:
            return "Dependency must be a task in the same project"
    return None


TASK_FIELDS = ("title", "description", "owner_id", "status", "priority", "planned_start",
               "planned_end", "actual_start", "actual_end", "depends_on_task_id", "notes", "sequence")
TASK_DATES = ("planned_start", "planned_end", "actual_start", "actual_end")


@require_user
def project_tasks(request, pk):
    if not Project.objects.filter(pk=pk).exists():
        return error("Project not found", 404)
    if request.method == "GET":
        return data_list(Task.objects.filter(project_id=pk).select_related("owner").order_by("sequence", "id"), task_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    data = body_data(request)
    problem = validate_task_refs(pk, data.get("owner_id"), data.get("depends_on_task_id"))
    if problem:
        return error(problem, 422)
    task = Task(project_id=pk)
    try:
        assign_fields(task, data, TASK_FIELDS, TASK_DATES, {"status": TASK_STATUSES})
        if not task.title:
            return error("Task title is required")
        task.save()
    except ValueError as exc:
        return error(str(exc))
    log_activity(request.tracker_user, "task", task.id, "create", after={"title": task.title, "project_id": pk})
    return JsonResponse(task_data(task), status=201)


@require_user
def task_detail(request, pk):
    task = Task.objects.select_related("owner").filter(pk=pk).first()
    if not task:
        return error("Task not found", 404)
    if request.method == "GET":
        return JsonResponse(task_data(task))
    if request.method == "DELETE":
        log_activity(request.tracker_user, "task", pk, "delete", before={"title": task.title})
        task.delete()
        return HttpResponse(status=204)
    if request.method != "PATCH":
        return error("Method not allowed", 405)
    data = body_data(request)
    problem = validate_task_refs(task.project_id, data.get("owner_id", task.owner_id),
                                 data.get("depends_on_task_id", task.depends_on_task_id), task.id)
    if problem:
        return error(problem, 422)
    before = {"title": task.title, "status": task.status}
    try:
        assign_fields(task, data, TASK_FIELDS, TASK_DATES, {"status": TASK_STATUSES})
        if task.status == "Done" and task.actual_end is None:
            task.actual_end = timezone.now()
        if task.status == "InProgress" and task.actual_start is None:
            task.actual_start = timezone.now()
        task.updated_at = timezone.now()
        task.save()
    except ValueError as exc:
        return error(str(exc))
    log_activity(request.tracker_user, "task", pk, "update", before=before,
                 after={"title": task.title, "status": task.status})
    return JsonResponse(task_data(task))


@require_user
def reorder_tasks(request):
    if request.method != "POST":
        return error("Method not allowed", 405)
    project_id = request.GET.get("project_id")
    ids = body_data(request)
    if not isinstance(ids, list) or not Project.objects.filter(pk=project_id).exists():
        return error("Invalid task order")
    for sequence, task_id in enumerate(ids):
        Task.objects.filter(pk=task_id, project_id=project_id).update(sequence=sequence)
    return JsonResponse({"ok": True})


MILESTONE_FIELDS = ("name", "target_date", "status", "notes", "sequence", "pending_with")


@require_user
def project_milestones(request, pk):
    if not Project.objects.filter(pk=pk).exists():
        return error("Project not found", 404)
    if request.method == "GET":
        return data_list(Milestone.objects.filter(project_id=pk).order_by("sequence", "id"), milestone_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    m = Milestone(project_id=pk)
    try:
        assign_fields(m, body_data(request), MILESTONE_FIELDS, ("target_date",), {"status": MILESTONE_STATUSES})
        if not m.name:
            return error("Milestone name is required")
        m.save()
    except ValueError as exc:
        return error(str(exc))
    log_activity(request.tracker_user, "milestone", m.id, "create", after={"name": m.name})
    return JsonResponse(milestone_data(m), status=201)


@require_user
def milestone_detail(request, pk):
    m = not_found(Milestone, pk)
    if not m:
        return error("Milestone not found", 404)
    if request.method == "DELETE":
        log_activity(request.tracker_user, "milestone", pk, "delete", before={"name": m.name})
        m.delete()
        return HttpResponse(status=204)
    if request.method != "PATCH":
        return error("Method not allowed", 405)
    before = {"name": m.name, "status": m.status}
    try:
        assign_fields(m, body_data(request), MILESTONE_FIELDS, ("target_date",), {"status": MILESTONE_STATUSES})
        m.save()
    except ValueError as exc:
        return error(str(exc))
    log_activity(request.tracker_user, "milestone", pk, "update", before=before,
                 after={"name": m.name, "status": m.status})
    return JsonResponse(milestone_data(m))


@require_user
def templates_view(request):
    if request.method == "GET":
        return data_list(MilestoneTemplate.objects.order_by("name"), template_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    if request.tracker_user.role != "admin":
        return error("Admin required", 403)
    data = body_data(request)
    if not str(data.get("name", "")).strip():
        return error("Template name is required")
    try:
        with transaction.atomic():
            template = MilestoneTemplate.objects.create(name=data["name"].strip(), description=data.get("description"))
            for sequence, item in enumerate(data.get("items", [])):
                MilestoneTemplateItem.objects.create(template=template, name=item["name"],
                                                     sequence=item.get("sequence", sequence))
    except (IntegrityError, KeyError, TypeError):
        return error("Template name already exists or items are invalid")
    return JsonResponse(template_data(template), status=201)


@require_user
def template_detail(request, pk):
    if request.method != "DELETE":
        return error("Method not allowed", 405)
    if request.tracker_user.role != "admin":
        return error("Admin required", 403)
    template = not_found(MilestoneTemplate, pk)
    if not template:
        return error("Template not found", 404)
    template.delete()
    return HttpResponse(status=204)


def comments_for(request, project_id=None, task_id=None):
    if request.method == "GET":
        return data_list(Comment.objects.filter(project_id=project_id, task_id=task_id)
                         .select_related("user").order_by("created_at"), comment_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    body = str(body_data(request).get("body", "")).strip()
    if not body:
        return error("Comment cannot be empty")
    c = Comment.objects.create(project_id=project_id, task_id=task_id,
                               user=request.tracker_user, body=body)
    return JsonResponse(comment_data(c), status=201)


@require_user
def project_comments(request, pk):
    if not Project.objects.filter(pk=pk).exists():
        return error("Project not found", 404)
    return comments_for(request, project_id=pk)


@require_user
def task_comments(request, pk):
    if not Task.objects.filter(pk=pk).exists():
        return error("Task not found", 404)
    return comments_for(request, task_id=pk)


@require_user
def comment_detail(request, pk):
    if request.method != "DELETE":
        return error("Method not allowed", 405)
    comment = not_found(Comment, pk)
    if not comment:
        return error("Comment not found", 404)
    if comment.user_id != request.tracker_user.id and request.tracker_user.role != "admin":
        return error("Cannot delete another user's comment", 403)
    comment.delete()
    return HttpResponse(status=204)


@require_user
def activity_view(request):
    if request.method != "GET":
        return error("Method not allowed", 405)
    qs = ActivityLog.objects.select_related("user").order_by("-created_at")
    if request.GET.get("entity_type"):
        qs = qs.filter(entity_type=request.GET["entity_type"])
    if request.GET.get("entity_id"):
        qs = qs.filter(entity_id=request.GET["entity_id"])
    try:
        offset = max(0, int(request.GET.get("offset", 0)))
        limit = min(200, max(1, int(request.GET.get("limit", 50))))
    except ValueError:
        return error("Invalid pagination")
    return data_list(qs[offset:offset + limit], activity_data)


def open_tasks_for(user):
    qs = Task.objects.select_related("owner", "project").exclude(status="Done")
    qs = qs.exclude(project__status__in=["Completed", "Cancelled"])
    if user.role != "admin":
        qs = qs.filter(owner_id=user.id)
    return qs


@require_user
def dashboard_view(request, action):
    if request.method != "GET":
        return error("Method not allowed", 405)
    today = timezone.localdate()
    user, denied = dashboard_subject(request)
    if denied:
        return denied
    project_scope = Project.objects.all()
    if user.role != "admin":
        project_scope = project_scope.filter(Q(created_by=user) | Q(tasks__owner=user)).distinct()
    if action == "my-tasks":
        qs = Task.objects.filter(owner_id=user.id).exclude(status="Done").exclude(
            project__status__in=["Completed", "Cancelled"]).select_related("owner")
        return data_list(qs.order_by("planned_end", "id")[:50], task_data)
    if action == "overdue":
        qs = open_tasks_for(user).filter(planned_end__date__lt=today)
        return data_list(qs.order_by("planned_end")[:100], task_data)
    if action == "due-this-week":
        qs = open_tasks_for(user).filter(planned_end__date__gte=today,
                                         planned_end__date__lte=today + timedelta(days=7))
        return data_list(qs.order_by("planned_end")[:50], task_data)
    if action == "overdue-count":
        count = open_tasks_for(user).filter(planned_end__date__lt=today).count()
        return JsonResponse({"count": count})
    if action == "active-projects":
        rows = project_scope.filter(status="Active").values("venture").annotate(count=Count("id"))
        return JsonResponse(list(rows), safe=False)
    if action == "recent-activity":
        activity = ActivityLog.objects.select_related("user").order_by("-created_at")
        if user.role != "admin" or request.GET.get("user_id"):
            activity = activity.filter(user=user)
        return data_list(activity[:20], activity_data)
    if action == "summary":
        open_tasks = open_tasks_for(user)
        return JsonResponse({"active_projects": project_scope.filter(status="Active").count(),
                             "my_open_tasks": open_tasks.filter(owner_id=user.id).count(),
                             "overdue_tasks": open_tasks.filter(planned_end__date__lt=today).count(),
                             "due_this_week": open_tasks.filter(planned_end__date__gte=today,
                                                                  planned_end__date__lte=today + timedelta(days=7)).count(),
                             "my_todos": Todo.objects.filter(user=user, is_done=False).count(),
                             "completed_tasks": Task.objects.filter(owner_id=user.id, status="Done").count()})
    return error("Not found", 404)


@require_user
def todos_view(request):
    if request.method == "GET":
        qs = Todo.objects.filter(user=request.tracker_user)
        if request.GET.get("include_done", "false").lower() != "true":
            qs = qs.filter(is_done=False)
        return data_list(qs.order_by("is_done", "due_date", "-created_at"), todo_data)
    if request.method != "POST":
        return error("Method not allowed", 405)
    todo = Todo(user=request.tracker_user)
    try:
        assign_fields(todo, body_data(request), ("title", "notes", "priority", "due_date", "is_done"), ("due_date",))
        if not todo.title:
            return error("To-do title is required")
        todo.save()
    except ValueError as exc:
        return error(str(exc))
    return JsonResponse(todo_data(todo), status=201)


@require_user
def todo_detail(request, pk):
    todo = Todo.objects.filter(pk=pk, user=request.tracker_user).first()
    if not todo:
        return error("To-do not found", 404)
    if request.method == "DELETE":
        todo.delete()
        return HttpResponse(status=204)
    if request.method != "PATCH":
        return error("Method not allowed", 405)
    try:
        assign_fields(todo, body_data(request), ("title", "notes", "priority", "due_date", "is_done"), ("due_date",))
        todo.updated_at = timezone.now()
        todo.save()
    except ValueError as exc:
        return error(str(exc))
    return JsonResponse(todo_data(todo))


def export_rows(projects):
    rows = []
    for project in projects:
        tasks = Task.objects.filter(project=project).order_by("sequence", "id")
        if not tasks:
            rows.append([project.name, project.venture, project.client or "", "", "", "", "", ""])
        for task in tasks:
            rows.append([project.name, project.venture, project.client or "", task.title,
                         task_data(task)["status"], task.priority,
                         task.owner.full_name if task.owner else "",
                         task.planned_end.date().isoformat() if task.planned_end else ""])
    return rows


def xlsx_response(projects, filename):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Projects and tasks"
    sheet.append(["Project", "Venture", "Client", "Task", "Status", "Priority", "Owner", "Due date"])
    for row in export_rows(projects):
        sheet.append(row)
    for column, width in {"A": 30, "B": 16, "C": 24, "D": 45, "E": 20, "F": 15, "G": 25, "H": 16}.items():
        sheet.column_dimensions[column].width = width
    content = BytesIO()
    workbook.save(content)
    response = HttpResponse(content.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
    return response


@require_user
def project_export(request, pk, format):
    project = Project.objects.filter(pk=pk).first()
    if not project:
        return error("Project not found", 404)
    if format == "xlsx":
        return xlsx_response([project], f"project-{pk}")
    if format != "pdf":
        return error("Unknown export format", 404)
    content = BytesIO()
    pdf = canvas.Canvas(content, pagesize=A4)
    width, height = A4
    y = height - 50
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(45, y, project.name[:65])
    y -= 24
    pdf.setFont("Helvetica", 10)
    pdf.drawString(45, y, f"{project.venture}  |  {project.client or 'No client'}  |  {project_data(project)['status']}")
    y -= 28
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(45, y, "Tasks")
    y -= 20
    pdf.setFont("Helvetica", 9)
    for row in export_rows([project]):
        if y < 50:
            pdf.showPage()
            y = height - 50
            pdf.setFont("Helvetica", 9)
        pdf.drawString(45, y, f"{row[3][:62]}  |  {row[4]}  |  {row[7]}")
        y -= 16
    pdf.save()
    response = HttpResponse(content.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="project-{pk}.pdf"'
    return response


@require_user
def active_export(request):
    return xlsx_response(Project.objects.filter(status="Active").order_by("venture", "name"), "active-projects")
