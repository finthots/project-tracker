"""Send the optional daily task digest. Schedule this command once a day."""
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.utils import timezone

from trackerapp.models import Task, User


class Command(BaseCommand):
    help = "Email opted-in users their overdue and due-today tasks"

    def handle(self, *args, **options):
        if not settings.EMAIL_DIGEST_ENABLED or not settings.EMAIL_HOST:
            self.stdout.write("Email digest is disabled or SMTP_HOST is unset.")
            return
        today = timezone.localdate()
        sent = 0
        for user in User.objects.filter(is_active=True, email_digest_enabled=True):
            open_tasks = Task.objects.filter(owner=user).exclude(status="Done").exclude(
                project__status__in=["Completed", "Cancelled"])
            overdue = list(open_tasks.filter(planned_end__date__lt=today).order_by("planned_end"))
            due_today = list(open_tasks.filter(planned_end__date=today).order_by("planned_end"))
            if not overdue and not due_today:
                continue
            lines = [f"Overdue: {len(overdue)}", *[f"- {task.title}" for task in overdue],
                     "", f"Due today: {len(due_today)}", *[f"- {task.title}" for task in due_today]]
            html = (f"<h2>Good morning, {escape(user.full_name)}</h2>"
                    + f"<h3>Overdue ({len(overdue)})</h3><ul>"
                    + "".join(f"<li>{escape(task.title)}</li>" for task in overdue)
                    + f"</ul><h3>Due today ({len(due_today)})</h3><ul>"
                    + "".join(f"<li>{escape(task.title)}</li>" for task in due_today) + "</ul>")
            message = EmailMultiAlternatives(f"[ProjectTracker] Daily digest — {today.isoformat()}",
                                             "\n".join(lines), settings.DEFAULT_FROM_EMAIL, [user.email])
            message.attach_alternative(html, "text/html")
            try:
                message.send()
                sent += 1
            except Exception as exc:
                self.stderr.write(f"Digest failed for user #{user.id}: {exc}")
        self.stdout.write(f"Sent {sent} digest(s).")
