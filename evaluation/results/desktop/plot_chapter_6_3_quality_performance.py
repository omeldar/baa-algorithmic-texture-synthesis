from pathlib import Path
import argparse
import re

import pandas as pd
import matplotlib.pyplot as plt


# Folder names as they currently exist in evaluation/results/desktop folder.
# The order here is also the order used in the graph.
CONFIGS = {
    "checkpoint-01-low-quality-10runs": "Low quality",
    "checkpoint-03-baseline-10runs": "Baseline",
    "checkpoint-02-high-quality-10runs": "High quality",
}


def extract_summary_value(csv_path: Path, label: str):
    """
    Extracts values from metadata lines such as:
    # Total Textures Generated: 42

    If the value is not found, None is returned.
    """
    pattern = re.compile(rf"^#\s*{re.escape(label)}:\s*(.+)$")

    with csv_path.open("r", encoding="utf-8") as file:
        for line in file:
            match = pattern.match(line.strip())
            if match:
                value = match.group(1).strip()
                try:
                    return float(value)
                except ValueError:
                    return value

    return None


def read_measurement_csv(csv_path: Path) -> pd.DataFrame:
    """
    Reads one run CSV while ignoring metadata/comment lines beginning with '#'.
    """
    df = pd.read_csv(csv_path, comment="#")

    required_columns = [
        "FPS",
        "Render_ms",
        "TextureGen_ms",
        "ChunkGen_ms",
    ]

    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise ValueError(
            f"{csv_path} is missing required columns: {', '.join(missing_columns)}"
        )

    return df


def summarize_single_run(csv_path: Path) -> dict:
    """
    Calculates one summary row for one run file.
    """
    df = read_measurement_csv(csv_path)

    return {
        "file": csv_path.name,
        "avg_fps": df["FPS"].mean(),
        "min_fps": df["FPS"].min(),
        "max_fps": df["FPS"].max(),
        "avg_render_ms": df["Render_ms"].mean(),
        "avg_texture_gen_ms": df["TextureGen_ms"].mean(),
        "avg_chunk_gen_ms": df["ChunkGen_ms"].mean(),
        "total_textures_generated": extract_summary_value(
            csv_path, "Total Textures Generated"
        ),
        "total_chunks_generated": extract_summary_value(
            csv_path, "Total Chunks Generated"
        ),
    }


def collect_runs(data_root: Path) -> pd.DataFrame:
    """
    Collects only run CSV files from each config folder.

    It reads:
    checkpoint-01-low-quality-10runs/run-01.csv ... run-10.csv
    checkpoint-03-baseline-10runs/run-01.csv ... run-10.csv
    checkpoint-02-high-quality-10runs/run-01.csv ... run-10.csv

    It ignores:
    summary.csv
    config.json
    """
    all_runs = []

    for config_folder, config_label in CONFIGS.items():
        config_dir = data_root / config_folder

        if not config_dir.exists():
            raise FileNotFoundError(
                f"Missing folder: {config_dir}\n"
                f"Run this script from the directory that contains your checkpoint folders, "
                f"or pass the correct path using --data-root."
            )

        # Important: only use run CSV files and ignore summary.csv.
        csv_files = sorted(config_dir.glob("run-*.csv"))

        if len(csv_files) == 0:
            raise FileNotFoundError(f"No run CSV files found in {config_dir}")

        if len(csv_files) != 10:
            print(
                f"Warning: expected 10 run CSV files for {config_folder}, "
                f"but found {len(csv_files)}."
            )

        for csv_path in csv_files:
            run_summary = summarize_single_run(csv_path)
            run_summary["config_folder"] = config_folder
            run_summary["configuration"] = config_label
            all_runs.append(run_summary)

    return pd.DataFrame(all_runs)


def aggregate_runs(runs_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregates repeated runs by mean and standard deviation.
    """
    metrics = [
        "avg_fps",
        "min_fps",
        "max_fps",
        "avg_render_ms",
        "avg_texture_gen_ms",
        "avg_chunk_gen_ms",
        "total_textures_generated",
        "total_chunks_generated",
    ]

    aggregated = (
        runs_df
        .groupby(["config_folder", "configuration"], as_index=False)[metrics]
        .agg(["mean", "std"])
    )

    aggregated.columns = [
        "_".join(column).strip("_")
        for column in aggregated.columns.to_flat_index()
    ]

    order = list(CONFIGS.keys())
    aggregated["order"] = aggregated["config_folder"].apply(order.index)
    aggregated = aggregated.sort_values("order").drop(columns=["order"])

    return aggregated


def plot_quality_performance(summary_df: pd.DataFrame, output_path: Path):
    """
    Creates one figure with:
    1. FPS comparison
    2. Runtime cost comparison
    """
    labels = summary_df["configuration"].tolist()
    x = list(range(len(labels)))

    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    # -----------------------------
    # Graph 1: FPS comparison
    # -----------------------------
    fps_metrics = [
        ("avg_fps_mean", "avg_fps_std", "Average FPS"),
        ("min_fps_mean", "min_fps_std", "Minimum FPS"),
    ]

    bar_width = 0.35

    for index, (mean_column, std_column, label) in enumerate(fps_metrics):
        positions = [value + (index - 0.5) * bar_width for value in x]
        axes[0].bar(
            positions,
            summary_df[mean_column],
            width=bar_width,
            yerr=summary_df[std_column],
            capsize=4,
            label=label,
        )

    axes[0].axhline(60, linestyle="--", linewidth=1, label="60 FPS target")
    axes[0].axhline(30, linestyle=":", linewidth=1, label="30 FPS lower boundary")
    axes[0].set_title("Terrain Explorer Performance by Quality Configuration")
    axes[0].set_ylabel("Frames per second")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(labels)
    axes[0].legend()
    axes[0].grid(axis="y", alpha=0.3)

    # -----------------------------
    # Graph 2: timing comparison
    # -----------------------------
    timing_metrics = [
        ("avg_render_ms_mean", "avg_render_ms_std", "Render time"),
        ("avg_texture_gen_ms_mean", "avg_texture_gen_ms_std", "Texture generation"),
        ("avg_chunk_gen_ms_mean", "avg_chunk_gen_ms_std", "Chunk generation"),
    ]

    bar_width = 0.25

    for index, (mean_column, std_column, label) in enumerate(timing_metrics):
        positions = [value + (index - 1) * bar_width for value in x]
        axes[1].bar(
            positions,
            summary_df[mean_column],
            width=bar_width,
            yerr=summary_df[std_column],
            capsize=4,
            label=label,
        )

    axes[1].axhline(16.67, linestyle="--", linewidth=1, label="16.67 ms frame budget")
    axes[1].axhline(33.33, linestyle=":", linewidth=1, label="33.33 ms frame budget")
    axes[1].set_title("Average Runtime Costs by Quality Configuration")
    axes[1].set_ylabel("Milliseconds")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(labels)
    axes[1].legend()
    axes[1].grid(axis="y", alpha=0.3)

    fig.savefig(output_path, dpi=300)
    print(f"Saved graph to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Aggregate Terrain Explorer low-quality, baseline, and high-quality "
            "CSV runs and generate the Chapter 6.3 performance graph."
        )
    )

    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("."),
        help=(
            "Folder containing checkpoint-01-low-quality-10runs, "
            "checkpoint-03-baseline-10runs, and checkpoint-02-high-quality-10runs."
        ),
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("evaluation-output"),
        help="Folder where the graph and summary CSV files are written.",
    )

    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    runs_df = collect_runs(args.data_root)
    summary_df = aggregate_runs(runs_df)

    runs_output = args.output_dir / "chapter_6_3_quality_performance_runs.csv"
    summary_output = args.output_dir / "chapter_6_3_quality_performance_summary.csv"
    graph_output = args.output_dir / "chapter_6_3_quality_performance.png"

    runs_df.to_csv(runs_output, index=False)
    summary_df.to_csv(summary_output, index=False)

    plot_quality_performance(summary_df, graph_output)

    print(f"Saved run summaries to: {runs_output}")
    print(f"Saved aggregated summary to: {summary_output}")
    print()
    print("Aggregated results:")
    print(summary_df.to_string(index=False))


if __name__ == "__main__":
    main()