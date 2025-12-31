import os
import io
import zipfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from typing import Generator
import mimetypes

def get_service(creds, service_name, version):
    return build(service_name, version, credentials=creds)

def list_courses(creds):
    service = get_service(creds, "classroom", "v1")
    results = service.courses().list(courseStates=["ACTIVE"]).execute()
    courses = results.get("courses", [])
    return [{"id": c["id"], "name": c["name"], "section": c.get("section", "")} for c in courses]

def list_course_work(creds, course_id):
    service = get_service(creds, "classroom", "v1")
    # Fetch announcements, courseWork, courseWorkMaterials
    # For simplicity, we'll start with courseWork
    results = service.courses().courseWork().list(courseId=course_id).execute()
    works = results.get("courseWork", [])
    return works


def safe_name(name):
    """Sanitize file/folder names for Windows/Zip"""
    import re
    name = re.sub(r'[<>:"/\\|?*\n]', '', name)
    name = name.strip()
    return name[:100] if len(name) > 100 else name

def get_folder_name(Title=None, Text=None):
    if Title:
        return safe_name(Title)
    elif Text:
        return safe_name(Text[:50])
    return "Other Materials"

def fix_extension_if_missing(filename, mime_type):
    import os
    root, ext = os.path.splitext(filename)
    if ext == "":
        ext_map = {
            "application/pdf": ".pdf",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "image/jpeg": ".jpg",
            "image/png": ".png"
        }
        if mime_type in ext_map:
            return filename + ext_map[mime_type]
    return filename

def download_file_content(drive_service, file_id):
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)
    return fh.read()

def traverse_and_collect(drive_service, folder_id, path_prefix, collected_files):
    """Recursive traversal of Drive Folder"""
    query = f"'{folder_id}' in parents and trashed = false"
    page_token = None
    while True:
        resp = drive_service.files().list(q=query, fields="nextPageToken, files(id, name, mimeType)", pageToken=page_token).execute()
        files = resp.get("files", [])
        for f in files:
            name = safe_name(f.get("name", f["id"]))
            if f.get("mimeType") == "application/vnd.google-apps.folder":
                new_prefix = os.path.join(path_prefix, name)
                traverse_and_collect(drive_service, f["id"], new_prefix, collected_files)
            else:
                full_path = os.path.join(path_prefix, name)
                # Store dict with metadata
                collected_files.append({
                    "id": f["id"],
                    "path": full_path,
                    "name": name,
                    "mimeType": f.get("mimeType")
                })
        
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

def collect_course_materials(classroom_service, drive_service, course_id):
    """
    Returns a list of file dictionaries
    """
    collected_files = [] # List of dicts

    # Announcements
    anns_resp = classroom_service.courses().announcements().list(courseId=course_id).execute()
    anns = anns_resp.get("announcements", [])
    for a in anns:
        folder_name = get_folder_name(a.get("title"), a.get("text"))
        for m in a.get("materials", []):
            if "driveFile" in m:
                df = m["driveFile"]["driveFile"]
                f_name = safe_name(df.get("title") or df.get("name") or df["id"])
                if df.get("mimeType") == "application/vnd.google-apps.folder":
                     traverse_and_collect(drive_service, df["id"], folder_name, collected_files)
                else:
                    mime = df.get("mimeType")
                    if not mime:
                        mime, _ = mimetypes.guess_type(f_name)
                    collected_files.append({
                        "id": df["id"],
                        "path": os.path.join(folder_name, f_name),
                        "name": f_name,
                        "mimeType": mime
                    })

    # Coursework Materials
    mats_resp = classroom_service.courses().courseWorkMaterials().list(courseId=course_id).execute()
    mats = mats_resp.get("courseWorkMaterial", [])
    for mat in mats:
        folder_name = get_folder_name(mat.get("title"))
        for m in mat.get("materials", []):
            if "driveFile" in m:
                df = m["driveFile"]["driveFile"]
                f_name = safe_name(df.get("title") or df.get("name") or df["id"])
                if df.get("mimeType") == "application/vnd.google-apps.folder":
                     traverse_and_collect(drive_service, df["id"], folder_name, collected_files)
                else:
                    mime = df.get("mimeType")
                    if not mime:
                        mime, _ = mimetypes.guess_type(f_name)
                    collected_files.append({
                        "id": df["id"],
                        "path": os.path.join(folder_name, f_name),
                        "name": f_name,
                        "mimeType": mime
                    })

    # Coursework (Assignments)
    works_resp = classroom_service.courses().courseWork().list(courseId=course_id).execute()
    works = works_resp.get("courseWork", [])
    for w in works:
        folder_name = get_folder_name(w.get("title"))
        for m in w.get("materials", []):
            if "driveFile" in m:
                df = m["driveFile"]["driveFile"]
                f_name = safe_name(df.get("title") or df.get("name") or df["id"])
                if df.get("mimeType") == "application/vnd.google-apps.folder":
                     traverse_and_collect(drive_service, df["id"], folder_name, collected_files)
                else:
                    mime = df.get("mimeType")
                    if not mime:
                        mime, _ = mimetypes.guess_type(f_name)
                    collected_files.append({
                        "id": df["id"],
                        "path": os.path.join(folder_name, f_name),
                        "name": f_name,
                        "mimeType": mime
                    })

    return collected_files


import threading
import uuid
import tempfile
import time

# Simple in-memory job store
jobs = {}

def update_job(job_id, status, progress=0, message="", file_path=None, filename=None):
    if job_id in jobs:
        jobs[job_id].update({
            "status": status,
            "progress": progress,
            "message": message,
            "file_path": file_path,
            "filename": filename
        })

def download_file_content_to_zip(drive_service, file_id, zip_file, zip_path):
    try:
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        fh.seek(0)
        zip_file.writestr(zip_path, fh.read())
        return True
    except Exception as e:
        print(f"Error downloading {zip_path}: {e}")
        zip_file.writestr(f"{zip_path}.error.txt", f"Failed: {e}")
        return False

def background_zip_task(creds, course_id, job_id, course_name, selected_ids=None):
    try:
        update_job(job_id, "PROCESSING", 0, "Scanning course materials...")
        
        classroom_service = get_service(creds, "classroom", "v1")
        drive_service = get_service(creds, "drive", "v3")

        all_files = collect_course_materials(classroom_service, drive_service, course_id)
        
        # Filter if selected_ids is provided
        if selected_ids is not None:
            # Use set for faster lookups
            selected_set = set(selected_ids)
            files_to_download = [f for f in all_files if f["id"] in selected_set]
        else:
            files_to_download = all_files
            
        total_files = len(files_to_download)
        
        if total_files == 0:
            update_job(job_id, "FAILED", 0, "No files selected or found.")
            return

        # Create temp file
        temp_dir = tempfile.gettempdir()
        safe_course_name = safe_name(course_name)
        zip_filename = f"{safe_course_name}.zip"
        temp_zip_path = os.path.join(temp_dir, f"gcr_{job_id}.zip")

        update_job(job_id, "PROCESSING", 0, f"Preparing to download {total_files} files...")

        with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for idx, file_data in enumerate(files_to_download):
                path = file_data["path"]
                file_id = file_data["id"]
                mime_type = file_data["mimeType"]
                
                # Update progress
                percent = int((idx / total_files) * 100)
                update_job(job_id, "PROCESSING", percent, f"Downloading {os.path.basename(path)}...")
                
                final_name = fix_extension_if_missing(path, mime_type)
                download_file_content_to_zip(drive_service, file_id, zf, final_name)

        update_job(job_id, "COMPLETED", 100, "Download ready!", file_path=temp_zip_path, filename=zip_filename)

    except Exception as e:
        import traceback
        traceback.print_exc()
        update_job(job_id, "FAILED", 0, str(e))

def start_zip_job(creds, course_id, course_name, selected_ids=None):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "QUEUED",
        "progress": 0,
        "message": "Queued...",
        "created_at": time.time()
    }
    
    # Start thread
    t = threading.Thread(target=background_zip_task, args=(creds, course_id, job_id, course_name, selected_ids))
    t.start()
    
    return job_id


