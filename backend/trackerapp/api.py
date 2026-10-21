import json
from datetime import datetime, time
from functools import wraps

import bcrypt
from django.conf import settings
from django.core import signing
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from .models import ActivityLog, Notification, User

PROJECT_STATUSES = {"On Hold": "OnHold"}
TASK_STATUSES = {"Not Started": "NotStarted", "In Progress": "InProgress"}
MILESTONE_STATUSES = {"Signed off": "SignedOff"}


def outward(value, kind):
    reverse = {v: k for k, v in kind.items()}
    return reverse.get(value, value)


def inward(value, kind):
    return kind.get(value, value)


def date_value(value):
    return value.isoformat() if value else None


def user_brief(user):
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "role": user.role} if user else None


def user_data(user):
    return {**user_brief(user), "email": user.email, "is_active": user.is_active,
            "email_digest_enabled": user.email_digest_enabled,
            "reports_to_id": user.reports_to_id,
            "reports_to": user_brief(user.reports_to),
            "created_at": date_value(user.created_at)}


def task_data(task):
    return {"id": task.id, "project_id": task.project_id, "sequence": task.sequence,
            "title": task.title, "description": task.description, "owner_id": task.owner_id,
            "owner": user_brief(task.owner), "status": outward(task.status, TASK_STATUSES),
            "priority": task.priority, "planned_start": date_value(task.planned_start),
            "planned_end": date_value(task.planned_end), "actual_start": date_value(task.actual_start),
            "actual_end": date_value(task.actual_end), "depends_on_task_id": task.depends_on_task_id,
            "notes": task.notes, "created_at": date_value(task.created_at), "updated_at": date_value(task.updated_at)}


def project_data(project):
    return {"id": project.id, "name": project.name, "client": project.client,
            "venture": project.venture, "category": project.category,
            "status": outward(project.status, PROJECT_STATUSES),
            "start_date": date_value(project.start_date), "target_end_date": date_value(project.target_end_date),
            "actual_end_date": date_value(project.actual_end_date), "description": project.description,
            "created_by_id": project.created_by_id, "created_by": user_brief(project.created_by),
            "collaborators": [user_brief(user) for user in project.collaborators.all()],
            "collaborators_ids": list(project.collaborators.values_list("id", flat=True)),
            "created_at": date_value(project.created_at), "updated_at": date_value(project.updated_at),
            "task_count": project.tasks.count(), "done_task_count": project.tasks.filter(status="Done").count()}


def milestone_data(m):
    return {"id": m.id, "project_id": m.project_id, "name": m.name,
            "target_date": date_value(m.target_date), "status": outward(m.status, MILESTONE_STATUSES),
            "notes": m.notes, "sequence": m.sequence, "pending_with": m.pending_with}


def template_data(t):
    return {"id": t.id, "name": t.name, "description": t.description,
            "created_at": date_value(t.created_at),
            "items": [{"id": i.id, "name": i.name, "sequence": i.sequence} for i in t.items.order_by("sequence", "id")]}


def comment_data(c):
    return {"id": c.id, "task_id": c.task_id, "project_id": c.project_id,
            "user_id": c.user_id, "user": user_brief(c.user), "body": c.body,
            "created_at": date_value(c.created_at)}


def activity_data(a):
    return {"id": a.id, "user_id": a.user_id, "user": user_brief(a.user),
            "entity_type": a.entity_type, "entity_id": a.entity_id, "action": a.action,
            "before_json": a.before_json, "after_json": a.after_json,
            "created_at": date_value(a.created_at)}


def notification_data(notification):
    return {"id": notification.id, "kind": notification.kind, "message": notification.message,
            "project_id": notification.project_id, "task_id": notification.task_id,
            "created_at": date_value(notification.created_at),
            "read_at": date_value(notification.read_at)}


def todo_data(t):
    return {"id": t.id, "user_id": t.user_id, "title": t.title, "notes": t.notes,
            "priority": t.priority, "due_date": date_value(t.due_date), "is_done": t.is_done,
            "created_at": date_value(t.created_at), "updated_at": date_value(t.updated_at)}


def error(message, status=400):
    return JsonResponse({"detail": message}, status=status)


def body_data(request):
    if request.content_type and request.content_type.startswith("application/json"):
        try:
            data = json.loads(request.body or b"{}")
            return data if isinstance(data, (dict, list)) else {}
        except (ValueError, UnicodeDecodeError):
            return {}
    return request.POST.dict()


def parse_date_time(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    parsed = parse_datetime(str(value))
    if parsed is None:
        day = parse_date(str(value))
        if day:
            parsed = datetime.combine(day, time.min)
    if parsed is None:
        raise ValueError("Invalid date")
    return timezone.make_aware(parsed) if timezone.is_naive(parsed) else parsed


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password, stored):
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored.encode("ascii"))
    except (ValueError, TypeError):
        return False


def sign_user(user):
    return signing.dumps({"uid": user.id, "hash": user.password_hash[-12:]}, salt="tracker-auth")


def current_user(request):
    token = request.COOKIES.get("tracker_auth")
    if not token:
        return None
    try:
        payload = signing.loads(token, salt="tracker-auth", max_age=60 * 60 * 24 * 7)
        user = User.objects.filter(pk=payload["uid"], is_active=True).first()
        return user if user and payload.get("hash") == user.password_hash[-12:] else None
    except (signing.BadSignature, KeyError):
        return None


def require_user(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        request.tracker_user = current_user(request)
        if request.tracker_user is None:
            return error("Please sign in", 401)
        return view(request, *args, **kwargs)
    return wrapped


def log_activity(user, entity_type, entity_id, action, before=None, after=None):
    ActivityLog.objects.create(user=user, entity_type=entity_type, entity_id=entity_id,
                               action=action, before_json=json.dumps(before, default=str) if before else None,
                               after_json=json.dumps(after, default=str) if after else None)


def set_cookie(response, user):
    response.set_cookie("tracker_auth", sign_user(user), max_age=60 * 60 * 24 * 7,
                        httponly=True, secure=not settings.DEBUG, samesite="Lax")
    return response
