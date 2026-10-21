from django import forms
from django.contrib import admin

from .api import hash_password
from .models import (
    ActivityLog,
    Comment,
    Milestone,
    MilestoneTemplate,
    MilestoneTemplateItem,
    Project,
    ProjectCategory,
    Task,
    Todo,
    User,
)


admin.site.site_header = "Project Tracker Administration"
admin.site.site_title = "Project Tracker Admin"
admin.site.index_title = "Project Tracker"


class TrackerUserAdminForm(forms.ModelForm):
    password = forms.CharField(
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Enter a value to set or reset this user's dashboard password. Leave blank to keep it unchanged.",
    )

    class Meta:
        model = User
        fields = (
            "username",
            "password",
            "full_name",
            "email",
            "role",
            "reports_to",
            "is_active",
            "email_digest_enabled",
        )

    def clean_password(self):
        password = self.cleaned_data.get("password")
        if not self.instance.pk and not password:
            raise forms.ValidationError("A password is required for a new dashboard user.")
        return password

    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get("password")
        if password:
            user.password_hash = hash_password(password)
        if commit:
            user.save()
        return user


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    form = TrackerUserAdminForm
    list_display = ("username", "full_name", "email", "role", "reports_to", "is_active", "email_digest_enabled")
    list_filter = ("role", "reports_to", "is_active", "email_digest_enabled")
    search_fields = ("username", "full_name", "email", "reports_to__username", "reports_to__full_name")
    autocomplete_fields = ("reports_to",)
    readonly_fields = ("created_at",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "client", "venture", "category", "status", "target_end_date", "created_by")
    list_filter = ("venture", "category", "status")
    search_fields = ("name", "client", "description")
    autocomplete_fields = ("created_by",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProjectCategory)
class ProjectCategoryAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "owner", "status", "priority", "planned_end", "sequence")
    list_filter = ("status", "priority")
    search_fields = ("title", "description", "notes", "project__name")
    autocomplete_fields = ("project", "owner", "depends_on_task")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "target_date", "status", "pending_with", "sequence")
    list_filter = ("status",)
    search_fields = ("name", "notes", "project__name", "pending_with")
    autocomplete_fields = ("project",)


class MilestoneTemplateItemInline(admin.TabularInline):
    model = MilestoneTemplateItem
    extra = 0
    ordering = ("sequence",)


@admin.register(MilestoneTemplate)
class MilestoneTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("created_at",)
    inlines = (MilestoneTemplateItemInline,)


@admin.register(MilestoneTemplateItem)
class MilestoneTemplateItemAdmin(admin.ModelAdmin):
    list_display = ("name", "template", "sequence")
    search_fields = ("name", "template__name")
    autocomplete_fields = ("template",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("user", "project", "task", "created_at")
    search_fields = ("body", "user__username", "project__name", "task__title")
    autocomplete_fields = ("user", "project", "task")
    readonly_fields = ("created_at",)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "entity_type", "entity_id", "action")
    list_filter = ("entity_type", "action")
    search_fields = ("user__username", "entity_type", "action")
    autocomplete_fields = ("user",)
    readonly_fields = ("user", "entity_type", "entity_id", "action", "before_json", "after_json", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Todo)
class TodoAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "priority", "due_date", "is_done", "updated_at")
    list_filter = ("priority", "is_done")
    search_fields = ("title", "notes", "user__username")
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
