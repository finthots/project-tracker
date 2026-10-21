from django.db import models
from django.utils import timezone


class ExistingTable(models.Model):
    class Meta:
        abstract = True
        managed = True


class User(ExistingTable):
    username = models.CharField(max_length=64, unique=True)
    password_hash = models.CharField(max_length=256)
    full_name = models.CharField(max_length=128)
    email = models.EmailField(max_length=256, unique=True)
    role = models.CharField(max_length=6, default="member")
    is_active = models.BooleanField(default=True)
    email_digest_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "users"

    def __str__(self):
        return self.username


class Project(ExistingTable):
    name = models.CharField(max_length=256)
    client = models.CharField(max_length=256, null=True, blank=True)
    venture = models.CharField(max_length=8)
    category = models.CharField(max_length=10)
    status = models.CharField(max_length=9, default="Planning")
    start_date = models.DateTimeField(null=True, blank=True)
    target_end_date = models.DateTimeField(null=True, blank=True)
    actual_end_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="projects_created")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "projects"

    def __str__(self):
        return self.name


class Task(ExistingTable):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    sequence = models.IntegerField(default=0)
    title = models.CharField(max_length=256)
    description = models.TextField(null=True, blank=True)
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks_owned")
    status = models.CharField(max_length=10, default="NotStarted")
    priority = models.CharField(max_length=8, default="Medium")
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    depends_on_task = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "tasks"

    def __str__(self):
        return self.title


class Milestone(ExistingTable):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    name = models.CharField(max_length=256)
    target_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=7, default="Pending")
    notes = models.TextField(null=True, blank=True)
    sequence = models.IntegerField(default=0)
    pending_with = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        managed = True
        db_table = "milestones"

    def __str__(self):
        return self.name


class MilestoneTemplate(ExistingTable):
    name = models.CharField(max_length=256, unique=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "milestone_templates"

    def __str__(self):
        return self.name


class MilestoneTemplateItem(ExistingTable):
    template = models.ForeignKey(MilestoneTemplate, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=256)
    sequence = models.IntegerField(default=0)

    class Meta:
        managed = True
        db_table = "milestone_template_items"

    def __str__(self):
        return self.name


class Comment(ExistingTable):
    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "comments"

    def __str__(self):
        return f"Comment by {self.user}"


class ActivityLog(ExistingTable):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    entity_type = models.CharField(max_length=64)
    entity_id = models.IntegerField()
    action = models.CharField(max_length=64)
    before_json = models.TextField(null=True, blank=True)
    after_json = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "activity_logs"

    def __str__(self):
        return f"{self.action} {self.entity_type} #{self.entity_id}"


class Todo(ExistingTable):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=256)
    notes = models.TextField(null=True, blank=True)
    priority = models.CharField(max_length=8, default="Medium")
    due_date = models.DateTimeField(null=True, blank=True)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = True
        db_table = "todos"

    def __str__(self):
        return self.title
