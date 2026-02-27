"""
MoIRA Core - AI-Powered Multi-Omics Analysis
Web backend version: no YAML config, no interactive CLI prompts.
"""

from __future__ import annotations

import json
import logging
import os
import time
import traceback
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import pandas as pd
import requests

from . import analysis, preprocessing

logger = logging.getLogger(__name__)

KNOWN_STEPS = [
    "read_idat_files",
    "quality_control",
    "combat_normalization",
    "basic_statistics",
    "perform_pca",
    "create_heatmap",
    "create_volcano_plot",
    "differential_analysis",
]


# ─── OpenRouter AI ────────────────────────────────────────────────────────────


class OpenRouterAI:
    """OpenAI API integration for samplesheet analysis and workflow suggestion."""

    BASE_URL = "https://api.openai.com/v1/chat/completions"
    DEFAULT_MODEL = "gpt-4o-mini"

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model or self.DEFAULT_MODEL
        if not self.api_key:
            logger.warning("OpenAI: no API key provided.")

    # ── Public ────────────────────────────────────────────────────────────────

    def analyze_samplesheet(
        self, samplesheet_data: str, user_request: str
    ) -> Tuple[Dict[str, str], List[str]]:
        """
        Analyze a samplesheet and suggest a workflow.

        Returns:
            (column_mappings, workflow_steps)
            - column_mappings: {concept -> actual_column_name}
            - workflow_steps: ordered list of tool names
        """
        if not self.api_key:
            raise ValueError("OpenRouter API key is not configured.")

        prompt = self._build_prompt(samplesheet_data, user_request)
        raw = self._make_request(prompt)   # raises RuntimeError on failure
        return self._parse_response(raw)

    # ── Private helpers ───────────────────────────────────────────────────────

    def _build_prompt(self, samplesheet_data: str, user_request: str) -> str:
        return f"""You are a bioinformatics expert analyzing methylation data. Create the MOST EFFICIENT workflow by analyzing the data and only including steps that are absolutely necessary.

SAMPLESHEET DATA:
{samplesheet_data}

USER REQUEST: {user_request}

AVAILABLE TOOLS:
- read_idat_files: Read IDAT files using sesame R package; connects samples from samplesheet to raw data.
- quality_control: Filter probes/samples by detection p-values, remove NAs and sex CpGs.
- combat_normalization: Remove batch effects with ComBat.
- basic_statistics: Generate data summaries and quality metrics.
- perform_pca: Principal component analysis with visualization.
- create_heatmap: Sample correlation heatmap.
- differential_analysis: Statistical group comparisons.
- create_volcano_plot: Volcano plot from differential analysis results.

RULES:
- read_idat_files MUST be STEP 1 (mandatory)
- quality_control MUST come before any analysis step
- Only include steps NECESSARY for the user's goal
- No duplicate steps

CRITICAL: Respond with valid JSON ONLY. No text before or after the JSON.

{{
  "column_mappings": {{
    "beadchip": "[actual column name or null]",
    "position": "[actual column name or null]",
    "batch": "[actual column name or null]",
    "genotype": "[actual column name or null]",
    "tissue": "[actual column name or null]",
    "sample_id": "[actual column name or null]"
  }},
  "workflow": {{
    "steps": [
      {{
        "step_number": 1,
        "tool": "read_idat_files",
        "description": "Read IDAT files (mandatory first step)"
      }},
      {{
        "step_number": 2,
        "tool": "[tool_name]",
        "description": "[brief explanation]"
      }}
    ]
  }}
}}"""

    def _make_request(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 3000,
        }
        last_error: str = "Unknown error"
        for attempt in range(max_retries):
            try:
                resp = requests.post(
                    self.BASE_URL, headers=headers, json=payload, timeout=60
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Some models surface errors inside a 200 response
                    if "error" in data:
                        last_error = f"OpenRouter model error: {data['error']}"
                        logger.warning(last_error)
                    else:
                        msg = data["choices"][0]["message"]
                        # Reasoning models (e.g. stepfun, deepseek-r1) may return
                        # content=null and put the response in reasoning_content.
                        content = msg.get("content") or msg.get("reasoning_content") or ""
                        logger.debug("Raw AI content (first 300 chars): %.300s", content)
                        if not content.strip():
                            last_error = "Model returned empty content"
                            logger.warning(last_error)
                        else:
                            return content
                else:
                    # Surface the actual error body so callers can see what went wrong
                    try:
                        body = resp.json()
                        last_error = (
                            f"OpenRouter {resp.status_code}: "
                            f"{body.get('error', {}).get('message', resp.text[:300])}"
                        )
                    except Exception:
                        last_error = f"OpenRouter {resp.status_code}: {resp.text[:300]}"
                    logger.warning(last_error)
            except Exception as exc:
                last_error = str(exc)
                logger.error(
                    "Request attempt %d/%d failed: %s", attempt + 1, max_retries, exc
                )
            if attempt < max_retries - 1:
                time.sleep(2**attempt)
        raise RuntimeError(f"OpenRouter request failed after {max_retries} attempts: {last_error}")

    def _normalize_json(self, text: str) -> str:
        """Strip <think> blocks, markdown fences, and extract the first JSON object."""
        import re
        s = (text or "").strip()

        # 1. Remove <think>...</think> reasoning blocks (stepfun, deepseek-r1, etc.)
        s = re.sub(r"<think>.*?</think>", "", s, flags=re.DOTALL).strip()

        # 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
        if s.startswith("```"):
            nl = s.find("\n")
            if nl != -1:
                s = s[nl + 1:]
                end = s.rfind("```")
                if end != -1:
                    s = s[:end].rstrip()

        # 3. Strip bare "json" prefix some models emit
        if s.lower().startswith("json"):
            rest = s[4:].lstrip("\r\n \t:")
            if rest.startswith("{"):
                s = rest

        s = s.strip()

        # 4. Extract the outermost { ... } object
        if not (s.startswith("{") and s.endswith("}")):
            start = s.find("{")
            if start != -1:
                depth = 0
                for i in range(start, len(s)):
                    if s[i] == "{":
                        depth += 1
                    elif s[i] == "}":
                        depth -= 1
                        if depth == 0:
                            return s[start: i + 1]
        return s

    def _parse_response(
        self, text: str
    ) -> Tuple[Dict[str, str], List[str]]:
        normalized = self._normalize_json(text)
        try:
            data = json.loads(normalized)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse AI JSON response: %s\nRaw: %.500s", exc, text)
            raise RuntimeError(f"AI returned invalid JSON: {exc}") from exc

        # Column mappings — drop null/empty values
        raw_mappings: Dict[str, Any] = data.get("column_mappings", {})
        mappings = {
            k: v
            for k, v in raw_mappings.items()
            if v and str(v).lower() not in ("null", "none", "")
        }

        # Workflow steps — keep only known tools, preserve order
        steps_raw: List[Dict] = data.get("workflow", {}).get("steps", [])
        steps = [
            s["tool"] for s in steps_raw if s.get("tool") in KNOWN_STEPS
        ]

        logger.info(
            "AI analysis done: %d column mappings, %d workflow steps",
            len(mappings),
            len(steps),
        )
        return mappings, steps


# ─── MoIRA ───────────────────────────────────────────────────────────────────


class MoIRA:
    """Orchestrates the methylation analysis pipeline for the web backend."""

    def __init__(
        self,
        samplesheet_path: str,
        idat_folder: str,
        output_dir: str,
        openrouter_api_key: str = None,
    ):
        self.samplesheet_path = samplesheet_path
        self.idat_folder = idat_folder
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.ai = OpenRouterAI(api_key=openrouter_api_key)
        self.targets: Optional[pd.DataFrame] = None
        self.column_mappings: Dict[str, str] = {}

    # ── Data loading ──────────────────────────────────────────────────────────

    def load_samplesheet(self) -> None:
        """Load the samplesheet (CSV or Excel) into self.targets."""
        ext = Path(self.samplesheet_path).suffix.lower()
        if ext in (".xlsx", ".xls"):
            self.targets = pd.read_excel(self.samplesheet_path)
        else:
            self.targets = pd.read_csv(self.samplesheet_path)
        logger.info(
            "Loaded samplesheet: %d samples, %d columns",
            len(self.targets),
            len(self.targets.columns),
        )

    def build_samplesheet_summary(self) -> str:
        """Build a text summary of the samplesheet for AI analysis."""
        if self.targets is None:
            raise RuntimeError("Samplesheet not loaded. Call load_samplesheet() first.")
        df = self.targets
        lines = [
            "SAMPLESHEET OVERVIEW:",
            f"- Total samples: {len(df)}",
            f"- Columns: {', '.join(df.columns)}",
            "",
            "SAMPLE DATA (first 5 rows):",
            str(df.head()),
            "",
            "COLUMN DETAILS:",
        ]
        for col in df.columns:
            unique_count = df[col].dropna().nunique()
            if unique_count > 0:
                sample = df[col].dropna().unique()[:5].tolist()
                lines.append(
                    f"- {col}: {unique_count} unique values, examples: {sample}"
                )
            else:
                lines.append(f"- {col}: 0 unique values (all null)")
        return "\n".join(lines)

    # ── AI analysis ───────────────────────────────────────────────────────────

    def analyze_with_ai(
        self, user_request: str
    ) -> Tuple[Dict[str, str], List[str]]:
        """
        Use OpenRouter AI to get column mappings and a suggested workflow.

        Returns:
            (column_mappings, workflow_steps)
        """
        summary = self.build_samplesheet_summary()
        mappings, steps = self.ai.analyze_samplesheet(summary, user_request)
        self.column_mappings = mappings
        return mappings, steps

    # ── Workflow execution ────────────────────────────────────────────────────

    def run_workflow(
        self,
        workflow_steps: List[str],
        on_progress: Optional[Callable[[str, int, int], None]] = None,
    ) -> Dict[str, Any]:
        """
        Execute workflow steps sequentially.

        Args:
            workflow_steps: Ordered list of step names (e.g. ["read_idat_files", "quality_control"]).
            on_progress: Optional callback(step_name, step_idx, total_steps).

        Returns:
            Dict with results keyed by step name.
        """
        results: Dict[str, Any] = {}
        current_betas: Optional[pd.DataFrame] = None
        current_detP: Optional[pd.DataFrame] = None
        current_targets: Optional[pd.DataFrame] = self.targets
        plots_dir = str(self.output_dir / "plots")
        Path(plots_dir).mkdir(parents=True, exist_ok=True)

        total = len(workflow_steps)

        for idx, raw_step in enumerate(workflow_steps, 1):
            step = raw_step.strip().lower()
            logger.info("Step %d/%d: %s", idx, total, step)
            if on_progress:
                on_progress(step, idx, total)

            try:
                if step == "read_idat_files":
                    res = preprocessing.read_idat_files(
                        idat_directory=self.idat_folder,
                        targets_file=self.samplesheet_path,
                        column_mappings=self.column_mappings,
                    )
                    current_betas = res["betas"]
                    current_detP = res["detP"]
                    current_targets = res.get("targets", current_targets)
                    results["read_idat_files"] = {
                        "n_probes": res["n_probes"],
                        "n_samples": res["n_samples"],
                    }

                elif step == "quality_control":
                    if current_betas is None or current_detP is None:
                        raise RuntimeError(
                            "quality_control requires read_idat_files to run first."
                        )
                    res = preprocessing.quality_control(current_betas, current_detP)
                    current_betas = res["betas_qc"]
                    results["quality_control"] = {
                        "n_probes_after_qc": res["n_probes_after_qc"],
                        "n_samples_after_qc": res["n_samples_after_qc"],
                        "sex_cpgs_removed": res.get("sex_cpgs_removed", False),
                    }

                elif step == "combat_normalization":
                    if current_betas is None:
                        raise RuntimeError(
                            "combat_normalization requires read_idat_files (and optionally quality_control) to run first."
                        )
                    if current_targets is None:
                        raise RuntimeError(
                            "combat_normalization requires targets (samplesheet)."
                        )
                    batch_col = self.column_mappings.get("batch", "batch")
                    res = preprocessing.combat_normalization(
                        betas=current_betas,
                        targets=current_targets,
                        batch_column=batch_col,
                    )
                    current_betas = res["betas_combat"]
                    results["combat_normalization"] = {
                        "n_batches": res["batch_info"]["n_batches"],
                        "batches": res["batch_info"]["batches"],
                        "batch_column": batch_col,
                    }

                elif step == "basic_statistics":
                    if current_betas is None:
                        raise RuntimeError("basic_statistics requires beta values.")
                    res = analysis.basic_statistics(current_betas, current_targets)
                    results["basic_statistics"] = res

                elif step == "perform_pca":
                    if current_betas is None:
                        raise RuntimeError("perform_pca requires beta values.")
                    res = analysis.perform_pca(
                        betas=current_betas,
                        targets=current_targets,
                        step_name="pca",
                        column_mappings=self.column_mappings,
                        plots_dir=plots_dir,
                    )
                    results["perform_pca"] = {
                        k: v for k, v in res.items() if k != "plots"
                    }
                    results["perform_pca"]["plot_files"] = list(
                        res.get("plots", {}).values()
                    )

                elif step == "create_heatmap":
                    if current_betas is None:
                        raise RuntimeError("create_heatmap requires beta values.")
                    res = analysis.create_heatmap(
                        betas=current_betas,
                        targets=current_targets,
                        plots_dir=plots_dir,
                    )
                    results["create_heatmap"] = {
                        k: v for k, v in res.items() if k != "plots"
                    }
                    results["create_heatmap"]["plot_files"] = list(
                        res.get("plots", {}).values()
                    )

                elif step == "differential_analysis":
                    if current_betas is None:
                        raise RuntimeError("differential_analysis requires beta values.")
                    res = analysis.differential_analysis(
                        betas=current_betas,
                        targets=current_targets,
                        column_mappings=self.column_mappings,
                    )
                    results["differential_analysis"] = res

                elif step == "create_volcano_plot":
                    if current_betas is None:
                        raise RuntimeError("create_volcano_plot requires beta values.")
                    # Reuse differential analysis results if already computed
                    diff_results = results.get("differential_analysis")
                    res = analysis.create_volcano_plot(
                        betas=current_betas,
                        targets=current_targets,
                        diff_results=diff_results,
                        column_mappings=self.column_mappings,
                        plots_dir=plots_dir,
                    )
                    results["create_volcano_plot"] = {
                        k: v for k, v in res.items() if k != "plots"
                    }
                    results["create_volcano_plot"]["plot_files"] = list(
                        res.get("plots", {}).values()
                    )

                else:
                    logger.warning("Unknown step '%s', skipping.", step)

            except Exception as exc:
                logger.error(
                    "Step '%s' failed: %s\n%s", step, exc, traceback.format_exc()
                )
                results[step] = {"error": str(exc)}

        # Persist a summary JSON
        summary_path = self.output_dir / "workflow_summary.json"
        with open(summary_path, "w") as f:
            json.dump(
                {"steps": workflow_steps, "results": _make_serializable(results)},
                f,
                indent=2,
                default=str,
            )

        logger.info("Workflow complete. %d steps executed.", total)
        return results


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _make_serializable(obj: Any) -> Any:
    """Recursively convert numpy/pandas types to JSON-safe Python types."""
    if isinstance(obj, dict):
        return {k: _make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_serializable(v) for v in obj]
    if hasattr(obj, "item"):  # numpy scalar
        return obj.item()
    if hasattr(obj, "tolist"):  # numpy array / pandas Series
        return obj.tolist()
    return obj
