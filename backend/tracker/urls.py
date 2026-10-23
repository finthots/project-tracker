from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import TemplateView
from trackerapp import views
from trackerapp.ai import ask_view

urlpatterns = [
    path("sw.js", views.service_worker),
    path("admin/", admin.site.urls),
    path("api/ai/ask", ask_view),
    path("api/auth/<str:action>", views.auth_view),
    path("api/users", views.users_view),
    path("api/users/<int:pk>", views.user_detail),
    path("api/categories", views.categories_view),
    path("api/categories/<int:pk>", views.category_detail),
    path("api/projects", views.projects_view),
    path("api/projects/<int:pk>", views.project_detail),
    path("api/projects/<int:pk>/tasks", views.project_tasks),
    path("api/projects/<int:pk>/milestones", views.project_milestones),
    path("api/projects/<int:pk>/milestones/apply-template", views.apply_milestone_template),
    path("api/projects/<int:pk>/comments", views.project_comments),
    path("api/tasks/reorder", views.reorder_tasks),
    path("api/tasks/<int:pk>", views.task_detail),
    path("api/tasks/<int:pk>/comments", views.task_comments),
    path("api/milestones/<int:pk>", views.milestone_detail),
    path("api/milestone-templates", views.templates_view),
    path("api/milestone-templates/<int:pk>", views.template_detail),
    path("api/comments/<int:pk>", views.comment_detail),
    path("api/activity", views.activity_view),
    path("api/notifications", views.notifications_view),
    path("api/notifications/<int:pk>/read", views.notification_read),
    path("api/dashboard/<str:action>", views.dashboard_view),
    path("api/todos", views.todos_view),
    path("api/todos/<int:pk>", views.todo_detail),
    path("api/export/projects/<int:pk>/<str:format>", views.project_export),
    path("api/export/active-projects/xlsx", views.active_export),
    re_path(r"^(?!api/|admin/|static/).*$", TemplateView.as_view(template_name="index.html")),
]
