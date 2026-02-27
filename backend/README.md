# MoIRA Backend

FastAPI backend for the MoIRA web application.

## Requirements

- Python 3.11.x
- R 4.0+ (with Rtools 4.5 on Windows)
- OpenRouter API key

## Setup

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Install R packages

Run once to install all required R packages into `backend/r_packages/`:

```bash
Rscript install_r_packages.R
```

This installs:
- **Bioconductor**: sesame, minfi, limma, sva, wateRmelon, BiocParallel
- **CRAN**: snow, ggplot2, RColorBrewer, ggsci, readxl, openxlsx
- **GitHub**: IlluminaMouseMethylationmanifest, IlluminaMouseMethylationanno.12.v1.mm10

### 3. Configure environment variables

Edit `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret          # Supabase > Settings > API > JWT Secret
OPENROUTER_API_KEY=your-openrouter-key
R_LIBS_USER=./r_packages                     # optional, this is the default
```

### 4. Start the server

```bash
uvicorn main:app --reload --env-file .env
```

Server runs at `http://localhost:8000`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `POST` | `/upload` | Upload dataset (ZIP) + samplesheet |
| `POST` | `/analyze` | AI samplesheet analysis → column mappings + workflow steps |
| `POST` | `/run` | Start background workflow job |
| `GET` | `/jobs/{job_id}` | Job status + progress |
| `GET` | `/jobs/{job_id}/result` | Completed job results |
| `GET` | `/plots/{user_id}/{filename}` | Serve plot PNG |

All endpoints (except `/health`) require `Authorization: Bearer <supabase_jwt>`.

---

## Package structure

```
backend/
  main.py                  # FastAPI app
  moira/
    __init__.py
    core.py                # OpenRouterAI + MoIRA orchestrator
    preprocessing.py       # R-based steps (read_idat_files, quality_control, combat_normalization)
    analysis.py            # Python analysis (PCA, heatmap, differential analysis, volcano plot)
  install_r_packages.R     # One-time R package installer
  requirements.txt
  .env
  r_packages/              # R library directory (created by install_r_packages.R)
  temp/                    # Per-user uploaded files and outputs
```

## How the pipeline works

1. **Upload** — dataset zip (IDAT files) + samplesheet CSV are saved to `temp/{user_id}/`; zip is auto-extracted to `idat_files/`
2. **Analyze** — samplesheet is sent to OpenRouter AI which returns `column_mappings` + an ordered list of `workflow_steps`
3. **Run** — workflow steps execute sequentially in a background thread:
   - `read_idat_files` → calls R's sesame via rpy2
   - `quality_control` → filters probes/samples, removes sex CpGs using R annotation
   - `combat_normalization` → ComBat via sva R package
   - `basic_statistics` → pure Python / pandas
   - `perform_pca` → scikit-learn PCA, saves PNG plots
   - `create_heatmap` → seaborn correlation heatmap
   - `differential_analysis` → Welch t-test + BH FDR (scipy, pure Python)
   - `create_volcano_plot` → matplotlib, uses differential analysis results
4. **Poll** — `GET /jobs/{job_id}` until `status == "completed"` or `"failed"`
5. **Results** — `GET /jobs/{job_id}/result` returns the full results dict; `GET /plots/...` serves PNG files
