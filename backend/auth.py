import os
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from starlette.config import Config
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

# Allow non-HTTPS for local dev
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENT_SECRETS_FILE = os.getenv("CLIENT_SECRETS_FILE", os.path.join(BASE_DIR, "client_secret.json"))

# Fallback: Check root directory if not found in backend or if explicitly set path missing
print(f"--- AUTH DEBUG ---")
print(f"Attempting to find client_secret.json...")
print(f"Primary path check: {CLIENT_SECRETS_FILE}")

if not os.path.exists(CLIENT_SECRETS_FILE):
    print(f"Primary path not found. Checking parent directory fallback...")
    root_secret = os.path.join(os.path.dirname(BASE_DIR), "client_secret.json")
    print(f"Secondary path check: {root_secret}")
    if os.path.exists(root_secret):
        CLIENT_SECRETS_FILE = root_secret
        print(f"Found secret at: {CLIENT_SECRETS_FILE}")
    else:
        print(f"CRITICAL: client_secret.json not found at {CLIENT_SECRETS_FILE} or {root_secret}")
else:
    print(f"Using secret at: {CLIENT_SECRETS_FILE}")
print(f"------------------")
SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
    'https://www.googleapis.com/auth/classroom.topics.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

def get_flow(redirect_uri: str = None):
    # Ensure redirect_uri is dynamic or fixed based on environment
    if not redirect_uri:
        redirect_uri = os.getenv("BACKEND_URL", "http://localhost:8000") + "/auth/callback"
    
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

@router.get("/login")
def login(request: Request):
    flow = get_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    request.session["state"] = state
    return RedirectResponse(authorization_url)

@router.get("/callback")
def callback(request: Request, code: str, state: str):
    if state != request.session.get("state"):
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    flow = get_flow()
    flow.fetch_token(code=code)
    
    credentials = flow.credentials
    
    request.session["credentials"] = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes
    }
    
    # Redirect to frontend dashboard (hardcoded for now, should be env var)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(f"{frontend_url}/dashboard")

@router.get("/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}

@router.get("/me")
def get_current_user(request: Request):
    creds_data = request.session.get("credentials")
    if not creds_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # You could fetch user info here using the credentials
    # For now, just return valid status
    return {"authenticated": True}

def get_credentials(request: Request) -> Credentials:
    creds_data = request.session.get("credentials")
    if not creds_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data["token_uri"],
        client_id=creds_data["client_id"],
        client_secret=creds_data["client_secret"],
        scopes=creds_data["scopes"]
    )
