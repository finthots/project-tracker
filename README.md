# Project Tracker — Django + React

This Desktop project is a copy of the existing tracker, with a Django API and the React frontend. Its SQLite database was copied from `Downloads\ProjectTracker\backend\data\tracker.db` when this project was created. The original folder is untouched.

## Run locally

Double-click `run.bat`, then open http://127.0.0.1:5175. Django runs at http://127.0.0.1:8000 and Vite proxies `/api` to it. The copied user accounts and passwords remain the same. Change all demo passwords before any public deployment.

## Django admin

Open http://127.0.0.1:8000/admin/ and sign in with a Django superuser account. This is separate from the dashboard's custom user authentication. Create or reset the account locally with Django's `createsuperuser` command rather than publishing credentials in source control.

If you replace the database, create a new Django admin account from the `backend` directory:

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
```

If the environment needs to be rebuilt:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\frontend
npm ci --cache .npm-cache
```

The app tables use Django models mapped to the existing SQLite schema, so no data conversion is needed locally. `run.bat` applies Django migrations; on a fresh database it creates the tables and shows the first-admin setup form. Keep `backend/data/tracker.db` backed up. For PythonAnywhere, upload this database and configure the WSGI file to import `tracker.wsgi.application`, install `backend/requirements.txt`, run `python manage.py migrate --fake-initial`, and set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS`, and `DJANGO_CSRF_TRUSTED_ORIGINS`. The frontend still requires a same-origin `/api` route or an API URL and cookie/CORS configuration for a separate Netlify domain.

The dashboard excludes Done tasks and completed/cancelled projects from overdue counts. To-dos now show completed items, search, priority filters, due-date groups, and quick progress cards. Mobile navigation uses a bottom bar.

## Ask AI

The **Ask AI** page is hidden by default while the configured account has no inference credits. To show it later, set `VITE_ENABLE_AI=true` in the frontend environment and restart Vite (or rebuild the production frontend). Django reads a bounded, read-only snapshot of projects, tasks, milestones, recent comments, and the signed-in user's to-dos. It sends that snapshot and the question to Hugging Face's chat completion API; no model-generated SQL is executed. Common count, overdue, to-do, active-project, and weekly-priority questions are answered directly from the database without using inference credits. Responses label which source answered them.

Set `HF_TOKEN` in `backend/.env` or the backend host's environment. You can optionally set `HF_MODEL`; the default is `meta-llama/Llama-3.1-8B-Instruct:cheapest`. Keep the token on the backend only. A Hugging Face token needs Inference Providers permission and available monthly credits. When credits are exhausted, direct database answers continue to work and other questions show a clear error. Hugging Face receives the data included in each AI question's snapshot, so review your data policy before putting sensitive client details in the tracker.

Optional daily email digests use the existing `SMTP_*` and `EMAIL_DIGEST_ENABLED=true` settings in `backend/.env`. Schedule `backend/.venv/Scripts/python.exe backend/manage.py send_digest` once a day if your host supports scheduled jobs. The free PythonAnywhere account may not provide scheduled tasks.

## Deploy to PythonAnywhere

The production build is set up so Django serves the React single-page app, `/api`, and `/admin` from one PythonAnywhere domain. The compiled `frontend/dist` directory is intentionally committed because PythonAnywhere does not provide a Node.js web server.

1. Build before pushing: `cd frontend` then `npm ci` and `npm run build`.
2. Clone the GitHub repository under `/home/YOUR_USERNAME/Project-Tracker` on PythonAnywhere.
3. Create a virtual environment, install `backend/requirements.txt`, and copy `backend/.env.example` to `backend/.env` with a new secret and your PythonAnywhere hostname.
4. From `backend`, run `python manage.py migrate` and `python manage.py collectstatic --noinput`.
5. Set the PythonAnywhere web app source directory to `/home/YOUR_USERNAME/Project-Tracker/backend`, virtualenv to your environment, and copy `deploy/pythonanywhere_wsgi.py.example` into the web app's WSGI file after replacing `YOUR_USERNAME`.
6. Reload the web app. On a fresh database, the frontend displays the first-admin setup form. Run `python manage.py createsuperuser` separately if Django Admin access is needed.

Never commit `backend/.env` or `backend/data/tracker.db`. Upload a database privately to PythonAnywhere only if you intentionally want the local tracker data online.
