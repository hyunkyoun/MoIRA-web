"""
MoIRA Analysis - Python-based analysis and visualization.
Web backend version: no YAML config; accepts plots_dir parameter.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")  # non-interactive backend; must be set before pyplot import
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from scipy import stats
from scipy.stats import rankdata
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

import warnings
warnings.filterwarnings("ignore")

logger = logging.getLogger(__name__)

# Default number of top-variance CpGs used for PCA
_DEFAULT_N_TOP_CPGS = 10_000


# ─── Basic statistics ─────────────────────────────────────────────────────────


def basic_statistics(
    betas: pd.DataFrame,
    targets: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """Generate basic data summaries and quality metrics."""
    logger.info("Generating basic statistics...")

    n_probes, n_samples = betas.shape
    missing = int(betas.isnull().sum().sum())

    result: Dict[str, Any] = {
        "data_shape": {"n_probes": n_probes, "n_samples": n_samples},
        "quality_metrics": {
            "missing_values": missing,
            "missing_percentage": float(missing / (n_probes * n_samples) * 100),
        },
        "beta_statistics": {
            "mean": float(betas.mean().mean()),
            "median": float(betas.median().median()),
            "std": float(betas.std().mean()),
            "min": float(betas.min().min()),
            "max": float(betas.max().max()),
        },
        "sample_statistics": {
            "mean_beta_per_sample": betas.mean().to_dict(),
            "std_beta_per_sample": betas.std().to_dict(),
        },
    }

    logger.info("Basic statistics done: %d probes × %d samples", n_probes, n_samples)
    return result


# ─── PCA ─────────────────────────────────────────────────────────────────────


def perform_pca(
    betas: pd.DataFrame,
    targets: Optional[pd.DataFrame],
    step_name: str = "pca",
    n_top_cpgs: int = _DEFAULT_N_TOP_CPGS,
    column_mappings: Optional[Dict[str, str]] = None,
    plots_dir: str = "outputs/plots",
) -> Dict[str, Any]:
    """
    PCA on the top-variable CpGs, coloured by tissue, batch, and genotype.

    Returns a dict including 'plots' (name → file path).
    """
    Path(plots_dir).mkdir(parents=True, exist_ok=True)
    column_mappings = column_mappings or {}

    logger.info("PCA: top %d CpGs, step_name='%s'", n_top_cpgs, step_name)

    # ── Match samples to targets ──────────────────────────────────────────────
    matched: List[str] = []
    tissue_labels: List[str] = []
    batch_labels: List[str] = []
    genotype_labels: List[str] = []

    tissue_key = column_mappings.get("tissue")
    batch_key = column_mappings.get("batch")
    genotype_key = column_mappings.get("genotype")

    for sample in betas.columns:
        target_row = _find_target_row(sample, targets)
        if target_row is None:
            logger.warning("PCA: no target info for sample '%s', skipping.", sample)
            continue
        matched.append(sample)
        tissue_labels.append(
            str(target_row[tissue_key])
            if tissue_key and tissue_key in target_row.index
            else "Unknown"
        )
        batch_labels.append(
            str(target_row[batch_key])
            if batch_key and batch_key in target_row.index
            else "Unknown"
        )
        genotype_labels.append(
            str(target_row[genotype_key])
            if genotype_key and genotype_key in target_row.index
            else "Unknown"
        )

    if not matched:
        # Fall back: use all samples without grouping
        matched = list(betas.columns)
        tissue_labels = ["Unknown"] * len(matched)
        batch_labels = ["Unknown"] * len(matched)
        genotype_labels = ["Unknown"] * len(matched)
        logger.warning("PCA: no matched targets — grouping will show 'Unknown'.")

    betas_m = betas[matched]

    # ── M-value transform → top-variable CpGs ────────────────────────────────
    m_values = np.log2(betas_m / (1 - betas_m + 1e-6))
    probe_vars = m_values.var(axis=1)
    actual_top = min(n_top_cpgs, len(probe_vars))
    top_idx = probe_vars.nlargest(actual_top).index
    m_top = m_values.loc[top_idx]

    # ── PCA ───────────────────────────────────────────────────────────────────
    scaler = StandardScaler()
    m_scaled = scaler.fit_transform(m_top.T)  # samples × features

    pca = PCA()
    coords = pca.fit_transform(m_scaled)

    n_components = min(10, coords.shape[1])
    pca_df = pd.DataFrame(
        coords[:, :n_components],
        index=matched,
        columns=[f"PC{i+1}" for i in range(n_components)],
    )
    pca_df["Tissue"] = tissue_labels
    pca_df["Batch"] = batch_labels
    pca_df["Genotype"] = genotype_labels

    evr = pca.explained_variance_ratio_[:n_components]
    cum_var = np.cumsum(evr)

    # ── Plots ─────────────────────────────────────────────────────────────────
    plots: Dict[str, str] = {}

    def _scatter(col: str, suffix: str) -> str:
        fig, ax = plt.subplots(figsize=(9, 7))
        for group in pca_df[col].unique():
            mask = pca_df[col] == group
            ax.scatter(
                pca_df.loc[mask, "PC1"],
                pca_df.loc[mask, "PC2"],
                label=group,
                alpha=0.75,
                s=55,
            )
        ax.set_xlabel(f"PC1 ({evr[0]*100:.1f}%)")
        ax.set_ylabel(f"PC2 ({evr[1]*100:.1f}%)")
        ax.set_title(f"PCA – {col} (top {actual_top} CpGs)")
        ax.legend(bbox_to_anchor=(1.05, 1), loc="upper left", fontsize=8)
        ax.grid(True, alpha=0.3)
        path = str(Path(plots_dir) / f"{step_name}_{suffix}.png")
        fig.tight_layout()
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        return path

    plots["tissue"] = _scatter("Tissue", "tissue")
    plots["batch"] = _scatter("Batch", "batch")
    plots["genotype"] = _scatter("Genotype", "genotype")

    # Scree plot
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.plot(range(1, len(evr) + 1), evr, "bo-")
    ax.set_xlabel("Principal Component")
    ax.set_ylabel("Explained Variance Ratio")
    ax.set_title("PCA Scree Plot")
    ax.grid(True, alpha=0.3)
    scree_path = str(Path(plots_dir) / f"{step_name}_scree.png")
    fig.tight_layout()
    fig.savefig(scree_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    plots["scree"] = scree_path

    logger.info(
        "PCA done: %d components, PC1=%.1f%%, PC2=%.1f%%",
        n_components,
        evr[0] * 100,
        evr[1] * 100,
    )

    return {
        "pca_data": pca_df.to_dict("records"),
        "explained_variance_ratio": evr.tolist(),
        "cumulative_variance": cum_var.tolist(),
        "n_components": n_components,
        "n_top_cpgs_used": actual_top,
        "grouping_summary": {
            "tissues": pca_df["Tissue"].unique().tolist(),
            "batches": pca_df["Batch"].unique().tolist(),
            "genotypes": pca_df["Genotype"].unique().tolist(),
        },
        "plots": plots,
    }


# ─── Heatmap ──────────────────────────────────────────────────────────────────


def create_heatmap(
    betas: pd.DataFrame,
    targets: Optional[pd.DataFrame] = None,
    step_name: str = "heatmap",
    plots_dir: str = "outputs/plots",
) -> Dict[str, Any]:
    """
    Sample-level correlation heatmap.

    Returns a dict including 'plots' (name → file path).
    """
    Path(plots_dir).mkdir(parents=True, exist_ok=True)
    logger.info("Creating sample correlation heatmap (%d samples)...", betas.shape[1])

    # Pearson correlation across samples (betas.T → samples × probes)
    corr = betas.T.corr(method="pearson")

    fig, ax = plt.subplots(figsize=(max(8, corr.shape[0] // 2), max(7, corr.shape[0] // 2)))
    sns.heatmap(
        corr,
        ax=ax,
        cmap="RdBu_r",
        center=0,
        square=True,
        linewidths=0.3,
        cbar_kws={"shrink": 0.8},
        xticklabels=True,
        yticklabels=True,
    )
    ax.set_title("Sample Correlation Heatmap (Pearson)", fontsize=13)
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", fontsize=7)
    plt.setp(ax.get_yticklabels(), rotation=0, fontsize=7)

    plot_path = str(Path(plots_dir) / f"{step_name}_correlation.png")
    fig.tight_layout()
    fig.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    # Upper-triangle mean correlation (excluding diagonal)
    upper = corr.values[np.triu_indices_from(corr.values, k=1)]
    mean_corr = float(upper.mean()) if len(upper) else 0.0

    logger.info("Heatmap done. Mean pairwise correlation: %.4f", mean_corr)

    return {
        "n_samples": betas.shape[1],
        "mean_pairwise_correlation": mean_corr,
        "min_pairwise_correlation": float(upper.min()) if len(upper) else 0.0,
        "max_pairwise_correlation": float(upper.max()) if len(upper) else 0.0,
        "plots": {"heatmap": plot_path},
    }


# ─── Differential analysis ────────────────────────────────────────────────────


def differential_analysis(
    betas: pd.DataFrame,
    targets: Optional[pd.DataFrame],
    column_mappings: Optional[Dict[str, str]] = None,
    fdr_threshold: float = 0.05,
    top_n: int = 200,
) -> Dict[str, Any]:
    """
    Two-group differential methylation analysis using Welch's t-test + BH FDR.

    The group column is taken from column_mappings['genotype'] or ['tissue']
    (whichever is available and has exactly 2 unique values).

    Args:
        betas: Beta values (probes × samples).
        targets: Sample metadata indexed by sample basename.
        column_mappings: AI-discovered column name mappings.
        fdr_threshold: FDR cutoff for significant DMPs.
        top_n: Number of top DMPs to include in the results dict.

    Returns:
        Dict with comparison info, DMP counts, and top_dmps list.
    """
    column_mappings = column_mappings or {}
    logger.info("Differential methylation analysis...")

    if targets is None:
        return {"error": "No targets (samplesheet) provided."}

    # ── Determine group column ────────────────────────────────────────────────
    group_col = _select_group_column(betas, targets, column_mappings)
    if group_col is None:
        return {
            "error": (
                "Could not find a suitable two-group column in targets. "
                "Ensure 'genotype' or 'tissue' is mapped and has exactly 2 unique values."
            )
        }

    # ── Match samples ─────────────────────────────────────────────────────────
    common = [s for s in betas.columns if s in targets.index]
    if len(common) < 4:
        return {"error": f"Too few matched samples ({len(common)}) for differential analysis."}

    groups = targets.loc[common, group_col]
    unique_groups = groups.unique()
    if len(unique_groups) != 2:
        return {
            "error": (
                f"Column '{group_col}' has {len(unique_groups)} unique values; "
                "exactly 2 are required."
            )
        }

    g1_name, g2_name = str(unique_groups[0]), str(unique_groups[1])
    g1_samples = groups[groups == unique_groups[0]].index.tolist()
    g2_samples = groups[groups == unique_groups[1]].index.tolist()

    logger.info(
        "Comparing '%s' (n=%d) vs '%s' (n=%d) on %d probes",
        g1_name, len(g1_samples), g2_name, len(g2_samples), betas.shape[0],
    )

    # ── M-value conversion ────────────────────────────────────────────────────
    m_values = np.log2(np.clip(betas[common], 0.001, 0.999) / (1 - np.clip(betas[common], 0.001, 0.999)))

    g1_m = m_values[g1_samples].values.T  # samples × probes
    g2_m = m_values[g2_samples].values.T

    # ── Welch's t-test ────────────────────────────────────────────────────────
    t_stats, p_values = stats.ttest_ind(g1_m, g2_m, equal_var=False)

    # BH FDR correction
    n = len(p_values)
    ranks = rankdata(p_values)
    fdr = np.minimum(p_values * n / ranks, 1.0)

    # M-value fold change: group1 mean − group2 mean
    fc = m_values[g1_samples].mean(axis=1).values - m_values[g2_samples].mean(axis=1).values

    dmp_df = pd.DataFrame(
        {
            "probe": m_values.index.tolist(),
            "log2_fc": fc.tolist(),
            "t_stat": t_stats.tolist(),
            "p_value": p_values.tolist(),
            "fdr": fdr.tolist(),
        }
    ).sort_values("fdr")

    sig = dmp_df[dmp_df["fdr"] < fdr_threshold]
    logger.info(
        "Differential analysis done: %d significant DMPs (FDR<%.2f) out of %d probes",
        len(sig), fdr_threshold, len(dmp_df),
    )

    return {
        "comparison": f"{g1_name} vs {g2_name}",
        "group_column": group_col,
        "groups": [g1_name, g2_name],
        "group_sizes": {g1_name: len(g1_samples), g2_name: len(g2_samples)},
        "n_probes_tested": len(dmp_df),
        "n_significant_dmps": len(sig),
        "fdr_threshold": fdr_threshold,
        "top_dmps": dmp_df.head(top_n).to_dict("records"),
    }


# ─── Volcano plot ─────────────────────────────────────────────────────────────


def create_volcano_plot(
    betas: pd.DataFrame,
    targets: Optional[pd.DataFrame],
    diff_results: Optional[Dict[str, Any]] = None,
    column_mappings: Optional[Dict[str, str]] = None,
    step_name: str = "volcano",
    plots_dir: str = "outputs/plots",
    fc_threshold: float = 1.0,
    fdr_threshold: float = 0.05,
) -> Dict[str, Any]:
    """
    Volcano plot from differential analysis results.

    If diff_results is not provided, differential_analysis() is run first.
    """
    Path(plots_dir).mkdir(parents=True, exist_ok=True)

    if diff_results is None:
        diff_results = differential_analysis(
            betas, targets, column_mappings=column_mappings
        )

    if "error" in diff_results:
        return diff_results

    dmps = pd.DataFrame(diff_results.get("top_dmps", []))
    if dmps.empty:
        return {"error": "No DMPs available for volcano plot."}

    # Colour coding
    def _colour(row: pd.Series) -> str:
        if row["fdr"] < fdr_threshold and abs(row["log2_fc"]) >= fc_threshold:
            return "#E8433A"  # significant + large FC
        if row["fdr"] < fdr_threshold:
            return "#2560E0"  # significant only
        return "#AAAAAA"  # not significant

    colours = dmps.apply(_colour, axis=1).tolist()
    neg_log10_p = (-np.log10(np.clip(dmps["p_value"].values, 1e-300, None))).tolist()

    fig, ax = plt.subplots(figsize=(9, 7))
    ax.scatter(
        dmps["log2_fc"],
        neg_log10_p,
        c=colours,
        alpha=0.65,
        s=18,
        linewidths=0,
    )

    # Threshold lines
    ax.axhline(-np.log10(fdr_threshold), linestyle="--", color="#444", alpha=0.45, linewidth=0.9)
    ax.axvline(-fc_threshold, linestyle="--", color="#444", alpha=0.45, linewidth=0.9)
    ax.axvline(fc_threshold, linestyle="--", color="#444", alpha=0.45, linewidth=0.9)

    ax.set_xlabel("log₂ Fold Change (M-value)", fontsize=12)
    ax.set_ylabel("-log₁₀(p-value)", fontsize=12)
    comparison = diff_results.get("comparison", "")
    ax.set_title(f"Volcano Plot — {comparison}", fontsize=13)
    ax.grid(True, alpha=0.25)

    # Simple legend
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], marker="o", color="w", markerfacecolor="#E8433A",
               markersize=8, label=f"Significant & |FC|≥{fc_threshold}"),
        Line2D([0], [0], marker="o", color="w", markerfacecolor="#2560E0",
               markersize=8, label="Significant only"),
        Line2D([0], [0], marker="o", color="w", markerfacecolor="#AAAAAA",
               markersize=8, label="Not significant"),
    ]
    ax.legend(handles=legend_elements, fontsize=9)

    plot_path = str(Path(plots_dir) / f"{step_name}.png")
    fig.tight_layout()
    fig.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    n_sig_fc = int(
        ((pd.Series(colours) == "#E8433A").sum())
    )
    logger.info("Volcano plot saved: %s (%d highlighted DMPs)", plot_path, n_sig_fc)

    return {
        "comparison": comparison,
        "n_highlighted_dmps": n_sig_fc,
        "fc_threshold": fc_threshold,
        "fdr_threshold": fdr_threshold,
        "plots": {"volcano": plot_path},
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _find_target_row(
    sample_name: str, targets: Optional[pd.DataFrame]
) -> Optional[pd.Series]:
    """Try to find a target row matching a sample name."""
    if targets is None:
        return None
    if sample_name in targets.index:
        return targets.loc[sample_name]
    # Partial index match
    for idx in targets.index:
        if sample_name in str(idx):
            return targets.loc[idx]
    # Column-value scan
    for col in targets.columns:
        mask = targets[col].astype(str).str.contains(sample_name, na=False, regex=False)
        if mask.any():
            return targets[mask].iloc[0]
    return None


def _select_group_column(
    betas: pd.DataFrame,
    targets: pd.DataFrame,
    column_mappings: Dict[str, str],
) -> Optional[str]:
    """
    Return the first valid two-group column from the column_mappings candidates.
    Falls back to scanning all target columns.
    """
    # Preferred order: genotype, tissue
    candidates = [
        column_mappings.get("genotype"),
        column_mappings.get("tissue"),
    ]
    # Add any remaining mapped columns as fallback
    candidates += list(column_mappings.values())

    # Match samples to targets
    common = [s for s in betas.columns if s in targets.index]
    if not common:
        return None

    for col in candidates:
        if col and col in targets.columns:
            vals = targets.loc[common, col].dropna().unique()
            if len(vals) == 2:
                return col

    # Full scan
    for col in targets.columns:
        vals = targets.loc[common, col].dropna().unique()
        if len(vals) == 2:
            return col

    return None
