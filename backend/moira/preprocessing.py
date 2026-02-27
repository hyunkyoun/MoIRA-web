"""
MoIRA Preprocessing - R-based methylation data preprocessing.
Web backend version: no YAML config; R library path via R_LIBS_USER env var.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ─── R environment setup ──────────────────────────────────────────────────────
# Use R_LIBS_USER from the environment (set by the user or a .env file).
# Falls back to a local "r_packages" directory next to this file.

_default_r_libs = str(Path(__file__).parent.parent / "r_packages")
_r_libs = os.environ.get("R_LIBS_USER", _default_r_libs)

# Ensure the directory exists and R picks it up before rpy2 is imported
Path(_r_libs).mkdir(parents=True, exist_ok=True)
os.environ.setdefault("R_LIBS_USER", _r_libs)
os.environ.setdefault("R_LIBS", _r_libs)
os.environ.setdefault("R_LIBS_SITE", "")

# Lazy rpy2 imports — rpy2 is only required when R steps are actually run
_rpy2_initialized: bool = False
_loaded_packages: Dict[str, Any] = {}
ro = None
pandas2ri = None
numpy2ri = None
localconverter = None


def _init_rpy2() -> None:
    """Import and initialise rpy2 on first use."""
    global _rpy2_initialized, ro, pandas2ri, numpy2ri, localconverter, _loaded_packages

    if _rpy2_initialized:
        return

    import rpy2.robjects as _ro
    from rpy2.robjects import pandas2ri as _p2r, numpy2ri as _n2r
    from rpy2.robjects.conversion import localconverter as _lc
    from rpy2.robjects.packages import importr

    ro = _ro
    pandas2ri = _p2r
    numpy2ri = _n2r
    localconverter = _lc

    # Prepend our lib path to .libPaths() so installed packages are found first
    ro.r(
        f"""
        try({{
            .libPaths(unique(c('{_r_libs.replace(chr(92), "/")}', .libPaths())))
            invisible(gc())
        }}, silent = TRUE)
        """
    )

    # Sanity-check base R
    importr("base")
    importr("utils")

    _rpy2_initialized = True
    logger.info("rpy2 initialised. R_LIBS_USER=%s", _r_libs)


def _require_packages(*names: str) -> None:
    """Load R packages on demand, caching them after first import."""
    _init_rpy2()
    from rpy2.robjects.packages import importr

    for pkg in names:
        if pkg in _loaded_packages:
            continue
        try:
            _loaded_packages[pkg] = importr(pkg)
        except Exception as exc:
            import rpy2.robjects as _ro

            libpaths = list(_ro.r(".libPaths()"))
            raise RuntimeError(
                f"R package '{pkg}' not found.\n"
                f"Expected in: {_r_libs}\n"
                f"Current R library paths: {libpaths}\n"
                f"Original error: {exc}"
            ) from exc


def _get_parallel_param(n_cores: int = 4) -> str:
    """Return the appropriate BiocParallel parameter string for the current OS."""
    if os.name == "posix":  # macOS / Linux
        return f"MulticoreParam(workers = {n_cores})"
    return f"SnowParam(workers = {n_cores})"  # Windows


# ─── Public functions ─────────────────────────────────────────────────────────


def read_idat_files(
    idat_directory: str,
    targets_file: Optional[str] = None,
    column_mappings: Optional[Dict[str, str]] = None,
    n_cores: int = 4,
) -> Dict[str, Any]:
    """
    Read IDAT files with sesame and return beta values + detection p-values.

    Args:
        idat_directory: Directory containing IDAT files.
        targets_file: Path to samplesheet CSV.
        column_mappings: Mapping from concept names to actual column names.
        n_cores: Number of parallel cores for BiocParallel.

    Returns:
        {
            "betas": pd.DataFrame (probes × samples),
            "detP": pd.DataFrame  (probes × samples),
            "n_probes": int,
            "n_samples": int,
            "targets": pd.DataFrame | None,
        }
    """
    logger.info("Reading IDAT files from: %s", idat_directory)

    _require_packages(
        "sesame",
        "BiocParallel",
        "parallel",
        "snow",
        "minfi",
        "limma",
        "sva",
        "wateRmelon",
        "IlluminaMouseMethylationmanifest",
        "IlluminaMouseMethylationanno.12.v1.mm10",
        "readxl",
        "openxlsx",
    )

    parallel_param = _get_parallel_param(n_cores)
    idat_dir_r = idat_directory.replace("\\", "/")

    ro.r(
        f"""
        betas  <- openSesame('{idat_dir_r}', BPPARAM = {parallel_param}, collapseToPfx = TRUE)
        detP   <- openSesame('{idat_dir_r}', func = pOOBAH, return.pval = TRUE,
                             BPPARAM = {parallel_param})
        detP   <- betasCollapseToPfx(detP)
        betas_df <- as.data.frame(betas,  stringsAsFactors = FALSE)
        detP_df  <- as.data.frame(detP,   stringsAsFactors = FALSE)
        """
    )

    with localconverter(ro.default_converter + pandas2ri.converter):
        betas_py = ro.conversion.rpy2py(ro.r("betas_df"))
        detP_py = ro.conversion.rpy2py(ro.r("detP_df"))

    common_samples = betas_py.columns.intersection(detP_py.columns)
    betas_df = betas_py[common_samples]
    detP_df = detP_py[common_samples]

    logger.info(
        "IDAT read: %d probes × %d samples", betas_df.shape[0], betas_df.shape[1]
    )

    # ── Prepare targets ───────────────────────────────────────────────────────
    targets: Optional[pd.DataFrame] = None
    if targets_file and column_mappings:
        targets = _prepare_targets(targets_file, column_mappings)

        # Filter to samples present in both betas and targets
        if targets is not None:
            target_basenames = targets.index.tolist()
            matching = [c for c in betas_df.columns if c in target_basenames]
            if matching:
                betas_df = betas_df[matching]
                detP_df = detP_df[matching]
                logger.info(
                    "Filtered to %d matched samples (%d unmatched dropped)",
                    len(matching),
                    len(betas_df.columns) - len(matching),
                )
            else:
                logger.warning(
                    "No matching samples found between IDAT data and targets."
                )

    return {
        "betas": betas_df,
        "detP": detP_df,
        "n_probes": betas_df.shape[0],
        "n_samples": betas_df.shape[1],
        "targets": targets,
    }


def _prepare_targets(
    targets_file: str, column_mappings: Dict[str, str]
) -> Optional[pd.DataFrame]:
    """Load the samplesheet and build a basename index for sample matching."""
    targets = pd.read_csv(targets_file, header=0)

    beadchip_col = column_mappings.get("beadchip")
    position_col = column_mappings.get("position")
    batch_col = column_mappings.get("batch")
    sample_id_col = column_mappings.get("sample_id")

    if not beadchip_col or not position_col:
        logger.warning(
            "column_mappings missing 'beadchip' or 'position' — cannot build sample basenames."
        )
        return None

    if beadchip_col not in targets.columns or position_col not in targets.columns:
        logger.error(
            "Mapped columns not found in samplesheet: %s, %s. Available: %s",
            beadchip_col,
            position_col,
            ", ".join(targets.columns),
        )
        return None

    targets["basename"] = (
        targets[beadchip_col].astype(str) + "_" + targets[position_col].astype(str)
    )

    if sample_id_col and sample_id_col in targets.columns:
        targets["sample_id"] = targets[sample_id_col]

    if batch_col and batch_col in targets.columns:
        targets["batch"] = targets[batch_col]

    targets = targets.set_index("basename")
    logger.info("Targets prepared: %d samples", len(targets))
    return targets


def quality_control(
    betas: pd.DataFrame,
    detP: pd.DataFrame,
    det_p_threshold: float = 0.05,
) -> Dict[str, Any]:
    """
    Filter probes and samples by detection p-value, remove NAs and sex CpGs.

    Args:
        betas: Beta values (probes × samples).
        detP: Detection p-values (probes × samples).
        det_p_threshold: Maximum acceptable mean detection p-value.

    Returns:
        {
            "betas_qc": pd.DataFrame,
            "detP_qc": pd.DataFrame,
            "n_probes_after_qc": int,
            "n_samples_after_qc": int,
            "sex_cpgs_removed": bool,
        }
    """
    logger.info("Quality control: threshold=%.3f", det_p_threshold)

    # 1. Filter samples by mean detection p-value
    sample_mean_detp = detP.mean(axis=0)
    good_samples = sample_mean_detp < det_p_threshold
    if not good_samples.any():
        raise ValueError(
            "No samples passed QC — all have mean detection p-value ≥ threshold."
        )
    betas_f = betas.loc[:, good_samples]
    detP_f = detP.loc[:, good_samples]
    logger.info(
        "Samples: kept %d / %d (mean detP < %.3f)",
        good_samples.sum(),
        len(good_samples),
        det_p_threshold,
    )

    # 2. Filter probes: ALL samples must pass the threshold
    keep_probes = (detP_f < det_p_threshold).all(axis=1)
    betas_f = betas_f[keep_probes]
    detP_f = detP_f[keep_probes]
    logger.info("Probes after detP filter: %d / %d", keep_probes.sum(), len(keep_probes))

    # 3. Remove probes with any NaN
    complete = betas_f.notna().all(axis=1)
    betas_f = betas_f[complete]
    detP_f = detP_f[complete]
    logger.info("Probes after NaN removal: %d", complete.sum())

    # 4. Keep only CpG probes (those starting with 'cg')
    cpg_mask = betas_f.index.str.startswith("cg")
    betas_f = betas_f[cpg_mask]
    detP_f = detP_f[cpg_mask]
    logger.info("CpG probes kept: %d", cpg_mask.sum())

    # 5. Remove sex chromosome CpGs using R annotation
    sex_cpgs_removed = False
    try:
        _require_packages("IlluminaMouseMethylationanno.12.v1.mm10")
        ro.r(
            "annoMouse <- getAnnotation(IlluminaMouseMethylationanno.12.v1.mm10)"
        )
        ro.r("sex_cpgs <- annoMouse$Name[annoMouse$chr %in% c('chrX', 'chrY')]")
        sex_cpgs = ro.r("sex_cpgs")
        with localconverter(ro.default_converter + numpy2ri.converter):
            sex_cpgs_list = ro.conversion.rpy2py(sex_cpgs)
        non_sex = ~betas_f.index.isin(sex_cpgs_list)
        betas_f = betas_f[non_sex]
        detP_f = detP_f[non_sex]
        sex_cpgs_removed = True
        logger.info(
            "Sex CpGs removed: %d. Remaining probes: %d",
            (~non_sex).sum(),
            betas_f.shape[0],
        )
    except Exception as exc:
        logger.warning("Could not remove sex CpGs: %s", exc)

    logger.info(
        "QC complete: %d probes × %d samples", betas_f.shape[0], betas_f.shape[1]
    )

    return {
        "betas_qc": betas_f,
        "detP_qc": detP_f,
        "n_probes_after_qc": betas_f.shape[0],
        "n_samples_after_qc": betas_f.shape[1],
        "sex_cpgs_removed": sex_cpgs_removed,
    }


def combat_normalization(
    betas: pd.DataFrame,
    targets: pd.DataFrame,
    batch_column: str = "batch",
) -> Dict[str, Any]:
    """
    Remove batch effects with ComBat (sva R package).

    Args:
        betas: Beta values (probes × samples).
        targets: Sample metadata DataFrame indexed by basename.
        batch_column: Column in targets containing batch labels.

    Returns:
        {
            "betas_combat": pd.DataFrame,
            "batch_info": {"n_batches": int, "batches": list, "batch_column": str},
            "combat_applied": bool,
        }
    """
    _require_packages("sva")

    m_values = _beta_to_m_values(betas)
    batch_info_series = targets[batch_column]
    n_samples = len(batch_info_series)

    mod = ro.r(f"matrix(1, nrow={n_samples}, ncol=1)")

    with localconverter(ro.default_converter + numpy2ri.converter):
        r_data = ro.conversion.py2rpy(m_values.values)
        r_batch = ro.conversion.py2rpy(batch_info_series.values)

    logger.info("Running ComBat batch correction on %d samples...", n_samples)
    combat_result = _loaded_packages["sva"].ComBat(
        dat=r_data,
        batch=r_batch,
        mod=mod,
        par_prior=True,
        prior_plots=False,
    )

    with localconverter(ro.default_converter + numpy2ri.converter):
        combat_array = ro.conversion.rpy2py(combat_result)

    betas_norm = _m_values_to_beta(combat_array)
    betas_norm.index = betas.index
    betas_norm.columns = betas.columns

    unique_batches = np.unique(batch_info_series.values).tolist()
    logger.info("ComBat complete: %d batches corrected.", len(unique_batches))

    return {
        "betas_combat": betas_norm,
        "batch_info": {
            "n_batches": len(unique_batches),
            "batches": unique_batches,
            "batch_column": batch_column,
        },
        "combat_applied": True,
    }


# ─── Internal helpers ─────────────────────────────────────────────────────────


def _beta_to_m_values(betas: pd.DataFrame) -> pd.DataFrame:
    clipped = np.clip(betas, 0.001, 0.999)
    m = np.log2(clipped / (1 - clipped))
    return pd.DataFrame(m, index=betas.index, columns=betas.columns)


def _m_values_to_beta(m_values: np.ndarray) -> pd.DataFrame:
    betas = 2**m_values / (1 + 2**m_values)
    return pd.DataFrame(np.clip(betas, 0.0, 1.0))
