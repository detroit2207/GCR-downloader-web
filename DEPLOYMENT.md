# Deployment Guide to Render.com

This guide will help you host your **Google Classroom Downloader** so your friends can access it. We will use **Render** because it has a generous free tier and supports both Python (Backend) and React (Frontend).

## Prerequisites

1.  **GitHub Account**: Ensure your code is pushed to GitHub (you've already done this!).
2.  **Render Account**: Sign up at [render.com](https://render.com/).

---

## Part 1: Deploying the Backend (Python)

1.  **Create New Web Service**:
    *   Go to Render Dashboard -> **New +** -> **Web Service**.
    *   Connect your GitHub repository.

2.  **Configure Settings**:
    *   **Name**: `gcr-backend` (or similar).
    *   **Root Directory**: `.` (Keep it empty or dot. Do NOT set it to `backend`, otherwise imports break).
    *   **Runtime**: **Python 3**.
    *   **Build Command**: `pip install -r backend/requirements.txt`.
    *   **Start Command**: `gunicorn -k uvicorn.workers.UvicornWorker backend.main:app`.

3.  **Environment Variables**:
    *   Scroll down to **Environment Variables** and add:
        *   `PYTHON_VERSION`: `3.9.0` (or similar).
        *   `SECRET_KEY`: (Generate a random string).
        *   `FRONTEND_URL`: (Leave empty for now, we'll fill it after deploying frontend).
        *   `ALLOWED_ORIGINS`: (Leave empty for now).
        *   `BACKEND_URL`: (This will be the Render URL, e.g., `https://gcr-backend.onrender.com`).
    *   **Secret Files**:
        *   Click **"Add Secret File"**.
        *   **Filename**: `backend/client_secret.json`.
        *   **Content**: Copy-paste the content of your local `client_secret.json`.

4.  **Deploy**: Click **Create Web Service**. It will start building.

---

## Part 2: Deploying the Frontend (React)

1.  **Create New Static Site**:
    *   Go to Dashboard -> **New +** -> **Static Site**.
    *   Connect the same GitHub repository.

2.  **Configure Settings**:
    *   **Name**: `gcr-frontend`.
    *   **Root Directory**: `frontend`.
    *   **Build Command**: `npm install && npm run build`.
    *   **Publish Directory**: `dist`.

3.  **Environment Variables**:
    *   Add the following variable:
        *   `VITE_API_URL`: The URL of your **Backend** from Part 1 (e.g., `https://gcr-backend.onrender.com`). **Note: No trailing slash!**

4.  **Deploy**: Click **Create Static Site**.

5.  **Fix "Not Found" on Refresh (SPA Routing)**:
    *   In Render, go to your **Frontend** service -> **Settings**.
    *   Scroll down to **Redirects and Rewrites**.
    *   Click **Add Rule**.
    *   **Source**: `/*`
    *   **Destination**: `/index.html`
    *   **Action**: `Rewrite`
    *   **Save**. This ensures that if you refresh on `/dashboard`, it doesn't return "Not Found".

---

## Part 3: Connecting Them & Google Auth

1.  **Update Backend Environment**:
    *   Go back to your **Backend** service settings on Render.
    *   Update `FRONTEND_URL` to your new **Frontend** URL (e.g., `https://gcr-frontend.onrender.com`).
    *   Update `ALLOWED_ORIGINS` to include your frontend URL (e.g., `https://gcr-frontend.onrender.com`).
    *   **Save Changes**. The backend will restart.

2.  **Update Google Cloud Console**:
    *   Go to [console.cloud.google.com](https://console.cloud.google.com/).
    *   Navigate to **APIs & Services** -> **Credentials**.
    *   Edit your OAuth 2.0 Client ID.
    *   **Authorized JavaScript Origins**: Add your **Frontend URL** (e.g., `https://gcr-frontend.onrender.com`).
    *   **Authorized Redirect URIs**: Add your **Backend Auth Callback URL**. It MUST look like this: `https://YOUR-BACKEND-NAME.onrender.com/auth/callback`.
    *   **Save**.

> [!IMPORTANT]
> Make sure your Render **Backend** has the environment variable `BACKEND_URL` set to `https://YOUR-BACKEND-NAME.onrender.com` (no trailing slash). Google is very picky about exact matches!


---

## Done!

Send the **Frontend URL** to your friends. They can now log in and download their courses!

> **Note on Free Tier**: Render's free tier spins down server instances after inactivity. The first request might take 50+ seconds to wake up the backend. Tell your friends to be patient on the first login!
