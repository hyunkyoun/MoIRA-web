#!/usr/bin/env Rscript
# =============================================================================
# MoIRA Web Backend - R Package Installation Script
# =============================================================================
# Installs all R packages required by the MoIRA preprocessing pipeline into
# backend/r_packages/ so that rpy2 (preprocessing.py) can find them.
#
# Run from the backend/ directory:
#   Rscript install_r_packages.R
#
# Or with a custom output directory:
#   Rscript install_r_packages.R /path/to/custom/r_packages
# =============================================================================

cat("=== MoIRA Web Backend — R Package Installer ===\n\n")

# Set CRAN mirror (required for non-interactive Rscript sessions)
options(repos = c(CRAN = "https://cloud.r-project.org"))

# ---------------------------------------------------------------------------
# Determine the packages directory
# ---------------------------------------------------------------------------
# Priority: CLI arg → R_LIBS_USER env var → backend/r_packages/ (default)

args <- commandArgs(trailingOnly = TRUE)

if (length(args) >= 1 && nchar(args[1]) > 0) {
  packages_dir <- normalizePath(args[1], mustWork = FALSE)
  cat("Using CLI-specified packages directory:", packages_dir, "\n")
} else if (nchar(Sys.getenv("R_LIBS_USER")) > 0) {
  packages_dir <- normalizePath(Sys.getenv("R_LIBS_USER"), mustWork = FALSE)
  cat("Using R_LIBS_USER env var:", packages_dir, "\n")
} else {
  # Default: r_packages/ next to this script
  script_path <- tryCatch(
    normalizePath(sys.frame(1)$ofile, mustWork = FALSE),
    error = function(e) getwd()
  )
  script_dir <- dirname(script_path)
  packages_dir <- file.path(script_dir, "r_packages")
  cat("Using default packages directory:", packages_dir, "\n")
}

# Create directory if needed
if (!dir.exists(packages_dir)) {
  dir.create(packages_dir, recursive = TRUE)
  cat("Created:", packages_dir, "\n")
}

# Prepend to library paths so installations land here
.libPaths(c(packages_dir, .libPaths()))
cat("Active library paths:", paste(.libPaths(), collapse = "\n  "), "\n\n")

# ---------------------------------------------------------------------------
# Package definitions
# ---------------------------------------------------------------------------

BIOC_PACKAGES <- c(
  "sesame",        # Core IDAT reading (openSesame / pOOBAH)
  "minfi",         # Methylation array analysis
  "limma",         # Linear models for microarray / differential analysis
  "sva",           # ComBat batch correction
  "wateRmelon",    # Normalisation utilities
  "BiocParallel"   # Parallel backend for Bioconductor
)

CRAN_PACKAGES <- c(
  "snow",          # SnowParam workers (Windows parallel)
  "ggplot2",
  "RColorBrewer",
  "ggsci",
  "readxl",
  "openxlsx"
)

# Installed from GitHub (not on CRAN/Bioc)
# These are mouse-specific Illumina annotation packages
GITHUB_PACKAGES <- c(
  "IlluminaMouseMethylationmanifest"        = "chiaraherzog/IlluminaMouseMethylationmanifest",
  "IlluminaMouseMethylationanno.12.v1.mm10" = "chiaraherzog/IlluminaMouseMethylationanno.12.v1.mm10"
)

TEST_PACKAGES <- c("sesame", "BiocParallel", "sva", "IlluminaMouseMethylationmanifest")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

is_installed <- function(pkg) {
  dir.exists(file.path(packages_dir, pkg))
}

safe_install <- function(pkg, bioc = FALSE, github_repo = NULL) {
  label <- if (!is.null(github_repo)) paste0(pkg, " (", github_repo, ")") else pkg
  cat("  Installing", label, "... ")

  tryCatch({
    if (!is.null(github_repo)) {
      if (!requireNamespace("devtools", quietly = TRUE)) {
        install.packages("devtools", lib = packages_dir, dependencies = TRUE, quiet = TRUE)
      }
      devtools::install_github(github_repo, lib = packages_dir,
                               dependencies = TRUE, upgrade = "never", quiet = TRUE)
    } else if (bioc) {
      BiocManager::install(pkg, lib = packages_dir, update = FALSE, ask = FALSE)
    } else {
      install.packages(pkg, lib = packages_dir, dependencies = TRUE, quiet = TRUE)
    }
    cat("OK\n")
    invisible(TRUE)
  }, error = function(e) {
    cat("FAILED:", conditionMessage(e), "\n")
    invisible(FALSE)
  })
}

# ---------------------------------------------------------------------------
# Install BiocManager (needed before any Bioc packages)
# ---------------------------------------------------------------------------

cat("=== BiocManager ===\n")
if (!is_installed("BiocManager")) {
  safe_install("BiocManager")
} else {
  cat("  BiocManager already installed\n")
}
suppressPackageStartupMessages(library(BiocManager, lib.loc = packages_dir))

# ---------------------------------------------------------------------------
# Bioconductor packages
# ---------------------------------------------------------------------------

cat("\n=== Bioconductor packages ===\n")
for (pkg in BIOC_PACKAGES) {
  if (!is_installed(pkg)) {
    safe_install(pkg, bioc = TRUE)
  } else {
    cat("  ", pkg, "already installed\n")
  }
}

# ---------------------------------------------------------------------------
# CRAN packages
# ---------------------------------------------------------------------------

cat("\n=== CRAN packages ===\n")
for (pkg in CRAN_PACKAGES) {
  if (!is_installed(pkg)) {
    safe_install(pkg)
  } else {
    cat("  ", pkg, "already installed\n")
  }
}

# ---------------------------------------------------------------------------
# GitHub packages
# ---------------------------------------------------------------------------

cat("\n=== GitHub packages (via devtools) ===\n")
for (pkg in names(GITHUB_PACKAGES)) {
  if (!is_installed(pkg)) {
    safe_install(pkg, github_repo = GITHUB_PACKAGES[[pkg]])
  } else {
    cat("  ", pkg, "already installed\n")
  }
}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

cat("\n=== Verification ===\n")
all_pkgs <- c(BIOC_PACKAGES, CRAN_PACKAGES, "BiocManager", names(GITHUB_PACKAGES))
failed   <- character(0)

for (pkg in all_pkgs) {
  ok <- is_installed(pkg)
  cat(sprintf("  %-50s %s\n", pkg, if (ok) "OK" else "MISSING"))
  if (!ok) failed <- c(failed, pkg)
}

# ---------------------------------------------------------------------------
# Load test
# ---------------------------------------------------------------------------

cat("\n=== Load test ===\n")
for (pkg in TEST_PACKAGES) {
  tryCatch({
    suppressPackageStartupMessages(
      library(pkg, character.only = TRUE, lib.loc = packages_dir)
    )
    cat("  ", pkg, "loaded OK\n")
  }, error = function(e) {
    cat("  ", pkg, "LOAD FAILED:", conditionMessage(e), "\n")
  })
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

cat("\n=== Summary ===\n")
cat("Packages directory :", packages_dir, "\n")
cat("Total required     :", length(all_pkgs), "\n")
cat("Missing            :", length(failed), "\n")

if (length(failed) > 0) {
  cat("Failed packages    :", paste(failed, collapse = ", "), "\n")
  cat("\nRe-run this script to retry failed packages.\n")
} else {
  cat("All packages installed successfully.\n")
}

cat("\n=== Next steps ===\n")
cat("Set this in backend/.env (or export before starting uvicorn):\n")
cat("  R_LIBS_USER=", packages_dir, "\n\n", sep = "")
cat("Then start the backend:\n")
cat("  uvicorn main:app --reload --env-file .env\n")
