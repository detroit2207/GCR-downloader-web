from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from starlette.middleware.sessions import SessionMiddleware
from backend.auth import router as auth_router, get_credentials
import os

app = FastAPI(title="Google Classroom Downloader API")

# Add Session Middleware (Secret key should be in env var for prod)
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SECRET_KEY", "supersecretkey"),
    same_site="none",
    https_only=True  # Required for SameSite=None
)

# Custom middleware to handle Render's proxy headers
# This ensures Starlette sees 'https' and sends the session cookie
@app.middleware("http")
async def fix_proxy_headers(request: Request, call_next):
    if request.headers.get("x-forwarded-proto") == "https":
        request.scope["scheme"] = "https"
    return await call_next(request)

# Configure CORS
# Clean origins to avoid trailing slash or whitespace mismatches
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173").split(",")
origins = [o.strip().rstrip("/") for o in raw_origins]
if os.getenv("FRONTEND_URL"):
    origins.append(os.getenv("FRONTEND_URL").strip().rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/debug-session")
def debug_session(request: Request):
    return {
        "session_keys": list(request.session.keys()),
        "url_scheme": request.url.scheme,
        "x_forwarded_proto": request.headers.get("x-forwarded-proto"),
        "origins_allowed": origins
    }

app.include_router(auth_router)

@app.get("/")
def read_root():
    return {"message": "Google Classroom Downloader API is running"}


@app.get("/courses")
def get_courses(request: Request):
    print(f"DEBUG: Session keys: {list(request.session.keys())}")
    try:
        creds = get_credentials(request)
        print("DEBUG: Credentials retrieved successfully")
        from backend.core import list_courses
        return list_courses(creds)
    except Exception as e:
        import traceback
        traceback.print_exc()
        # If not auth, 401
        if "Not authenticated" in str(e):
             raise HTTPException(status_code=401, detail="Not authenticated")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional

class JobStartRequest(BaseModel):
    courseName: str
    selectedFileIds: Optional[List[str]] = None

@app.get("/courses/{course_id}/materials")
def get_course_materials(course_id: str, request: Request):
    try:
        creds = get_credentials(request)
        from backend.core import collect_course_materials, get_service
        # We need services to pass to collect_course_materials
        classroom_service = get_service(creds, "classroom", "v1")
        drive_service = get_service(creds, "drive", "v3")
        
        materials = collect_course_materials(classroom_service, drive_service, course_id)
        return materials
    except Exception as e:
        if "Not authenticated" in str(e):
             raise HTTPException(status_code=401, detail="Not authenticated")
        print(f"Error fetching materials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/courses/{course_id}/download/start")
def start_download(course_id: str, job_req: JobStartRequest, request: Request):
    try:
        creds = get_credentials(request)
        from backend.core import start_zip_job
        job_id = start_zip_job(creds, course_id, job_req.courseName, job_req.selectedFileIds)
        return {"job_id": job_id}
    except Exception as e:
        if "Not authenticated" in str(e):
             raise HTTPException(status_code=401, detail="Not authenticated")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/status/{job_id}")
def get_job_status(job_id: str):
    from backend.core import jobs
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/download/result/{job_id}")
def get_job_result(job_id: str):
    from backend.core import jobs
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job not complete")
    
    return FileResponse(
        job["file_path"],
        media_type="application/zip",
        filename=job["filename"]
    )

