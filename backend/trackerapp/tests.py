import json

from django.test import Client, TestCase

from .api import sign_user
from .models import Milestone, MilestoneTemplate, MilestoneTemplateItem, Project, User


class ApplyMilestoneTemplateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            username="admin", password_hash="test-password-hash", full_name="Admin",
            email="admin@example.com", role="admin",
        )
        self.project = Project.objects.create(
            name="Launch", venture="Finthots", category="Marketing", created_by=self.user,
        )
        self.template = MilestoneTemplate.objects.create(name="Launch template")
        MilestoneTemplateItem.objects.create(template=self.template, name="Plan", sequence=0)
        MilestoneTemplateItem.objects.create(template=self.template, name="Publish", sequence=1)
        self.client = Client()
        self.client.cookies["tracker_auth"] = sign_user(self.user)

    def test_applies_template_to_empty_project(self):
        response = self.client.post(
            f"/api/projects/{self.project.id}/milestones/apply-template",
            data=json.dumps({"template_id": self.template.id}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            list(Milestone.objects.filter(project=self.project).order_by("sequence").values_list("name", flat=True)),
            ["Plan", "Publish"],
        )

    def test_rejects_template_when_project_has_milestones(self):
        Milestone.objects.create(project=self.project, name="Existing")

        response = self.client.post(
            f"/api/projects/{self.project.id}/milestones/apply-template",
            data=json.dumps({"template_id": self.template.id}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Milestone.objects.filter(project=self.project).count(), 1)
