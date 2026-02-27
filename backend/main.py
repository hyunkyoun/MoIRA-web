"""
MoIRA FastAPI backend.

Endpoints:
  GET  /health                     - Liveness probe
  POST /upload                     - Upload dataset (zip) + samplesheet
  POST /analyze                    - AI samplesheet analysis → mappings + workflow
  POST /run                        - Launch background workflow job
  GET  /jobs/{job_id}              - Job status + progress
  GET  /jobs/{job_id}/result       - Completed job results
  GET  /plots/{user_id}/{filename} - Serve a plot PNG
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from jwt import PyJWKClient
from pydantic import BaseModel

# ─── App setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="MoIRA API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.environ.get("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = Path(__file__).parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".zip"}

# ─── Auth config ──────────────────────────────────────────────────────────────

_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
_SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
_ASYMMETRIC_ALGS = {"RS256", "ES256"}
_OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ─── In-memory job store ──────────────────────────────────────────────────────
# Structure:
#   job_id → {
#       status:      "pending" | "running" | "completed" | "failed"
#       step:        str | None          current step name
#       step_idx:    int                 1-based
#       total_steps: int
#       result:      dict | None
#       error:       str | None
#       user_id:     str
#       created_at:  ISO str
#   }

_jobs: Dict[str, Dict[str, Any]] = {}
_executor = ThreadPoolExecutor(max_workers=2)


# ─── Auth helpers ─────────────────────────────────────────────────────────────


def verify_token(authorization: str | None) -> str:
    """
    Validate a Supabase JWT (supports HS256 and ES256/RS256).
    Returns the authenticated user_id (sub claim).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    try:
        if alg in _ASYMMETRIC_ALGS:
            if not _SUPABASE_URL:
                raise HTTPException(
                    status_code=500,
                    detail="Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL is not set",
                )
            jwks_url = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            signing_key = PyJWKClient(jwks_url).get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=list(_ASYMMETRIC_ALGS),
                audience="authenticated",
                options={"require": ["sub", "exp"]},
            )
        else:
            if not _JWT_SECRET:
                raise HTTPException(
                    status_code=500,
                    detail="Server misconfiguration: SUPABASE_JWT_SECRET is not set",
                )
            payload = jwt.decode(
                token,
                _JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["sub", "exp"]},
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")

    return user_id


def validate_extension(upload: UploadFile) -> None:
    """Reject files whose extension is not in ALLOWED_EXTENSIONS."""
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{upload.filename}' has unsupported extension '{ext}'. "
                f"Allowed: {allowed}"
            ),
        )


# ─── Path helpers ─────────────────────────────────────────────────────────────


def _user_dir(user_id: str) -> Path:
    return TEMP_DIR / user_id


def _output_dir(user_id: str) -> Path:
    return _user_dir(user_id) / "outputs"


def _get_project_meta(user_id: str) -> dict:
    meta_path = _user_dir(user_id) / "project_meta.json"
    if not meta_path.exists():
        raise HTTPException(
            status_code=404,
            detail="No uploaded project found for this user. Please upload files first.",
        )
    with open(meta_path, encoding="utf-8") as f:
        return json.load(f)


# ─── Request models ───────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    analysis_prompt: str


class RunRequest(BaseModel):
    workflow_steps: List[str]
    column_mappings: Dict[str, str]


# ─── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "version": app.version}


@app.post("/upload")
async def upload_files(
    dataset: UploadFile = File(...),
    samplesheet: UploadFile = File(...),
    project_title: str = Form(default="Untitled Project"),
    analysis_prompt: str = Form(default=""),
    authorization: str | None = Header(default=None),
):
    """
    Upload the dataset (IDAT zip or CSV) and samplesheet.

    - ZIP datasets are automatically extracted to idat_files/ inside the user directory.
    - Metadata is written to project_meta.json for use by subsequent endpoints.
    """
    user_id = verify_token(authorization)
    validate_extension(dataset)
    validate_extension(samplesheet)

    user_dir = _user_dir(user_id)
    user_dir.mkdir(exist_ok=True)

    # Sanitise filenames to prevent path traversal
    dataset_name = Path(dataset.filename or "dataset").name
    samplesheet_name = Path(samplesheet.filename or "samplesheet").name

    with (user_dir / dataset_name).open("wb") as f:
        shutil.copyfileobj(dataset.file, f)
    with (user_dir / samplesheet_name).open("wb") as f:
        shutil.copyfileobj(samplesheet.file, f)

    # Build initial metadata
    meta: Dict[str, Any] = {
        "project_title": project_title,
        "user_id": user_id,
        "dataset": dataset_name,
        "samplesheet": samplesheet_name,
        "analysis_prompt": analysis_prompt,
        "uploaded_at": datetime.utcnow().isoformat(),
    }

    # Auto-extract ZIP datasets → idat_files/
    if dataset_name.lower().endswith(".zip"):
        idat_dir = user_dir / "idat_files"
        idat_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(user_dir / dataset_name) as zf:
            # Guard against absolute paths / path traversal inside the zip
            for member in zf.namelist():
                member_path = (idat_dir / member).resolve()
                if not str(member_path).startswith(str(idat_dir.resolve())):
                    continue  # skip unsafe members
                zf.extract(member, idat_dir)
        meta["idat_folder"] = str(idat_dir)

    with (user_dir / "project_meta.json").open("w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return {
        "status": "success",
        "user_id": user_id,
        "dataset": dataset_name,
        "samplesheet": samplesheet_name,
        "idat_extracted": dataset_name.lower().endswith(".zip"),
    }


@app.post("/analyze")
async def analyze(
    body: AnalyzeRequest,
    authorization: str | None = Header(default=None),
):
    """
    AI samplesheet analysis.

    Reads the previously uploaded samplesheet, sends it to OpenRouter,
    and returns:
      - column_mappings: {concept → actual column name}
      - workflow_steps:  ordered list of tool names
    """
    user_id = verify_token(authorization)
    meta = _get_project_meta(user_id)

    samplesheet_path = str(_user_dir(user_id) / meta["samplesheet"])
    idat_folder = meta.get("idat_folder", str(_user_dir(user_id)))
    output_dir = str(_output_dir(user_id))

    if not _OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: OPENAI_API_KEY is not set.",
        )

    try:
        from moira.core import MoIRA

        moira = MoIRA(
            samplesheet_path=samplesheet_path,
            idat_folder=idat_folder,
            output_dir=output_dir,
            openrouter_api_key=_OPENAI_API_KEY,
        )
        moira.load_samplesheet()
        column_mappings, workflow_steps = moira.analyze_with_ai(body.analysis_prompt)

    except Exception as exc:
        import traceback
        traceback.print_exc()          # full traceback in the uvicorn terminal
        raise HTTPException(status_code=500, detail=str(exc))

    if not column_mappings:
        raise HTTPException(
            status_code=422,
            detail=(
                "AI could not extract column mappings from the samplesheet. "
                "Please check the samplesheet format and try a more descriptive prompt."
            ),
        )

    return {
        "column_mappings": column_mappings,
        "workflow_steps": workflow_steps,
    }


@app.post("/run")
async def run_workflow(
    body: RunRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    """
    Start a background workflow execution job.

    Returns immediately with a job_id. Poll GET /jobs/{job_id} for status.
    """
    user_id = verify_token(authorization)
    meta = _get_project_meta(user_id)

    if not body.workflow_steps:
        raise HTTPException(status_code=400, detail="workflow_steps cannot be empty.")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "pending",
        "step": None,
        "step_idx": 0,
        "total_steps": len(body.workflow_steps),
        "result": None,
        "error": None,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
    }

    background_tasks.add_task(
        _run_workflow_task,
        job_id=job_id,
        user_id=user_id,
        meta=meta,
        workflow_steps=body.workflow_steps,
        column_mappings=body.column_mappings,
    )

    return {"job_id": job_id, "status": "pending"}


@app.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    authorization: str | None = Header(default=None),
):
    """Return current job status and progress."""
    user_id = verify_token(authorization)
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")

    return {
        "job_id": job_id,
        "status": job["status"],
        "step": job["step"],
        "step_idx": job["step_idx"],
        "total_steps": job["total_steps"],
        "error": job["error"],
        "created_at": job["created_at"],
    }


@app.get("/jobs/{job_id}/result")
def get_job_result(
    job_id: str,
    authorization: str | None = Header(default=None),
):
    """Return the results of a completed job."""
    user_id = verify_token(authorization)
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed yet (current status: '{job['status']}').",
        )

    return {"job_id": job_id, "result": job["result"]}


@app.get("/plots/{user_id}/{filename}")
def get_plot(
    user_id: str,
    filename: str,
    authorization: str | None = Header(default=None),
):
    """
    Serve a plot PNG generated by a workflow run.

    Authorization: the requesting user must match the path user_id.
    """
    token_user = verify_token(authorization)
    if token_user != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")

    # Sanitise filename to prevent path traversal
    safe_name = Path(filename).name
    plot_path = _output_dir(user_id) / "plots" / safe_name

    if not plot_path.exists():
        raise HTTPException(status_code=404, detail=f"Plot '{safe_name}' not found.")

    return FileResponse(str(plot_path), media_type="image/png")


# ─── Background job logic ─────────────────────────────────────────────────────


async def _run_workflow_task(
    job_id: str,
    user_id: str,
    meta: dict,
    workflow_steps: List[str],
    column_mappings: Dict[str, str],
) -> None:
    """Async wrapper that offloads the synchronous pipeline to a thread."""
    _jobs[job_id]["status"] = "running"
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            _executor,
            _run_workflow_sync,
            job_id,
            user_id,
            meta,
            workflow_steps,
            column_mappings,
        )
        _jobs[job_id]["status"] = "completed"
        _jobs[job_id]["result"] = result
    except Exception as exc:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(exc)


def _run_workflow_sync(
    job_id: str,
    user_id: str,
    meta: dict,
    workflow_steps: List[str],
    column_mappings: Dict[str, str],
) -> dict:
    """Synchronous pipeline runner — executed inside a ThreadPoolExecutor worker."""
    from moira.core import MoIRA

    samplesheet_path = str(TEMP_DIR / user_id / meta["samplesheet"])
    idat_folder = meta.get("idat_folder", str(TEMP_DIR / user_id))
    output_dir = str(TEMP_DIR / user_id / "outputs")

    moira = MoIRA(
        samplesheet_path=samplesheet_path,
        idat_folder=idat_folder,
        output_dir=output_dir,
        openrouter_api_key=_OPENAI_API_KEY,
    )
    moira.load_samplesheet()
    moira.column_mappings = column_mappings

    def _progress(step_name: str, step_idx: int, total: int) -> None:
        _jobs[job_id]["step"] = step_name
        _jobs[job_id]["step_idx"] = step_idx
        _jobs[job_id]["total_steps"] = total

    return moira.run_workflow(workflow_steps, on_progress=_progress)
