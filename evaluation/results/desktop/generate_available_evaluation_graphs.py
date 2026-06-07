from pathlib import Path
import argparse
import re
from typing import Optional

import pandas as pd
import matplotlib.pyplot as plt


REQUIRED_COLUMNS = [
    "FPS",
    "Render_ms",
    "TextureGen_ms",
    "ChunkGen_ms",
]


def detect_config_type(folder_name: str) -> Optional[str]:
    name = folder_name.lower()

    if "low-quality" in name:
        return "low-quality"
    if "baseline" in name:
        return "baseline"
    if "high-quality" in name:
        return "high-quality"

    if "vd-1" in name:
        return "vd-1"
    if "vd-3" in name:
        return "vd-3"
    if "vd-5" in name:
        return "vd-5"

    if "0-reuse" in name:
        return "0-reuse"
    if "25-reuse" in name:
        return "25-reuse"
    if "50-reuse" in name:
        return "50-reuse"

    if "perlin" in name:
        return "perlin"
    if "worley" in name:
        return "worley"
    if "simplex" in name:
        return "simplex"
    if "wood" in name:
        return "wood"

    return None


def extract_summary_value(csv_path: Path, label: str):
    """
    Extracts values from metadata lines such as:
    # Total Textures Generated: 42
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
    Reads one run CSV and ignores metadata/comment lines starting with '#'.
    """
    df = pd.read_csv(csv_path, comment="#")

    missing_columns = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing_columns:
        raise ValueError(
            f"{csv_path} is missing required columns: {', '.join(missing_columns)}"
        )

    return df


def summarize_single_run(csv_path: Path) -> dict:
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


def collect_all_runs(data_root: Path) -> pd.DataFrame:
    all_runs = []

    checkpoint_folders = [
        path for path in data_root.iterdir()
        if path.is_dir() and path.name.startswith("checkpoint-")
    ]

    if not checkpoint_folders:
        raise FileNotFoundError(
            f"No checkpoint folders found in {data_root}. "
            f"Run this script from the folder that contains the checkpoint-* folders."
        )

    for folder in sorted(checkpoint_folders):
        config_type = detect_config_type(folder.name)

        if config_type is None:
            print(f"Skipping unknown folder: {folder.name}")
            continue

        csv_files = sorted(folder.glob("run-*.csv"))

        if not csv_files:
            print(f"Skipping {folder.name}: no run-*.csv files found.")
            continue

        if len(csv_files) != 10:
            print(
                f"Warning: expected 10 run CSV files in {folder.name}, "
                f"but found {len(csv_files)}."
            )

        for csv_path in csv_files:
            run_summary = summarize_single_run(csv_path)
            run_summary["folder"] = folder.name
            run_summary["config_type"] = config_type
            all_runs.append(run_summary)

    if not all_runs:
        raise RuntimeError("No usable run CSV files were found.")

    return pd.DataFrame(all_runs)


def aggregate_by_config(runs_df: pd.DataFrame) -> pd.DataFrame:
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

    summary = (
        runs_df
        .groupby("config_type", as_index=False)[metrics]
        .agg(["mean", "std"])
    )

    summary.columns = [
        "_".join(column).strip("_")
        for column in summary.columns.to_flat_index()
    ]

    return summary


def select_configs(summary_df: pd.DataFrame, ordered_configs: list[str]) -> pd.DataFrame:
    selected = summary_df[summary_df["config_type"].isin(ordered_configs)].copy()
    selected["order"] = selected["config_type"].apply(ordered_configs.index)
    selected = selected.sort_values("order").drop(columns=["order"])
    return selected


def plot_quality_performance(summary_df: pd.DataFrame, output_path: Path):
    ordered_configs = ["low-quality", "baseline", "high-quality"]
    labels = ["Low quality", "Baseline", "High quality"]

    df = select_configs(summary_df, ordered_configs)

    if len(df) < 3:
        print("Skipping Chapter 6.3 graph: not all quality configs are available.")
        return

    x = list(range(len(labels)))

    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    fps_metrics = [
        ("avg_fps_mean", "avg_fps_std", "Average FPS"),
        ("min_fps_mean", "min_fps_std", "Minimum FPS"),
    ]

    bar_width = 0.35

    for index, (mean_col, std_col, label) in enumerate(fps_metrics):
        positions = [value + (index - 0.5) * bar_width for value in x]
        axes[0].bar(
            positions,
            df[mean_col],
            width=bar_width,
            yerr=df[std_col],
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

    timing_metrics = [
        ("avg_render_ms_mean", "avg_render_ms_std", "Render time"),
        ("avg_texture_gen_ms_mean", "avg_texture_gen_ms_std", "Texture generation"),
        ("avg_chunk_gen_ms_mean", "avg_chunk_gen_ms_std", "Chunk generation"),
    ]

    bar_width = 0.25

    for index, (mean_col, std_col, label) in enumerate(timing_metrics):
        positions = [value + (index - 1) * bar_width for value in x]
        axes[1].bar(
            positions,
            df[mean_col],
            width=bar_width,
            yerr=df[std_col],
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
    plt.close(fig)

    print(f"Saved Chapter 6.3 graph: {output_path}")


def plot_view_distance_scalability(summary_df: pd.DataFrame, output_path: Path):
    ordered_configs = ["vd-1", "vd-3", "vd-5"]
    df = select_configs(summary_df, ordered_configs)

    if len(df) < 3:
        print("Skipping Chapter 6.4 graph: not all view-distance configs are available.")
        return

    view_distances = [1, 3, 5]

    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    axes[0].errorbar(
        view_distances,
        df["avg_fps_mean"],
        yerr=df["avg_fps_std"],
        marker="o",
        capsize=4,
        label="Average FPS",
    )
    axes[0].errorbar(
        view_distances,
        df["min_fps_mean"],
        yerr=df["min_fps_std"],
        marker="o",
        capsize=4,
        label="Minimum FPS",
    )
    axes[0].axhline(60, linestyle="--", linewidth=1, label="60 FPS target")
    axes[0].axhline(30, linestyle=":", linewidth=1, label="30 FPS lower boundary")
    axes[0].set_title("Scalability by View Distance")
    axes[0].set_xlabel("View distance")
    axes[0].set_ylabel("Frames per second")
    axes[0].set_xticks(view_distances)
    axes[0].legend()
    axes[0].grid(axis="y", alpha=0.3)

    axes[1].errorbar(
        view_distances,
        df["avg_render_ms_mean"],
        yerr=df["avg_render_ms_std"],
        marker="o",
        capsize=4,
        label="Render time",
    )
    axes[1].errorbar(
        view_distances,
        df["avg_chunk_gen_ms_mean"],
        yerr=df["avg_chunk_gen_ms_std"],
        marker="o",
        capsize=4,
        label="Chunk generation",
    )
    axes[1].errorbar(
        view_distances,
        df["avg_texture_gen_ms_mean"],
        yerr=df["avg_texture_gen_ms_std"],
        marker="o",
        capsize=4,
        label="Texture generation",
    )
    axes[1].axhline(16.67, linestyle="--", linewidth=1, label="16.67 ms frame budget")
    axes[1].axhline(33.33, linestyle=":", linewidth=1, label="33.33 ms frame budget")
    axes[1].set_title("Runtime Costs by View Distance")
    axes[1].set_xlabel("View distance")
    axes[1].set_ylabel("Milliseconds")
    axes[1].set_xticks(view_distances)
    axes[1].legend()
    axes[1].grid(axis="y", alpha=0.3)

    fig.savefig(output_path, dpi=300)
    plt.close(fig)

    print(f"Saved Chapter 6.4 graph: {output_path}")


def plot_texture_reuse(summary_df: pd.DataFrame, output_path: Path):
    ordered_configs = ["0-reuse", "25-reuse", "50-reuse"]
    df = select_configs(summary_df, ordered_configs)

    if len(df) < 2:
        print("Skipping Chapter 6.5 graph: not enough reuse configs are available.")
        return

    reuse_labels = {
        "0-reuse": "0 / unique",
        "25-reuse": "25",
        "50-reuse": "50",
    }

    labels = [reuse_labels[value] for value in df["config_type"].tolist()]
    x = list(range(len(labels)))

    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    axes[0].bar(
        x,
        df["avg_texture_gen_ms_mean"],
        yerr=df["avg_texture_gen_ms_std"],
        capsize=4,
        label="Texture generation time",
    )
    axes[0].set_title("Texture Generation Cost by Reuse Configuration")
    axes[0].set_ylabel("Milliseconds")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(labels)
    axes[0].grid(axis="y", alpha=0.3)

    width = 0.35

    axes[1].bar(
        [value - width / 2 for value in x],
        df["avg_fps_mean"],
        width=width,
        yerr=df["avg_fps_std"],
        capsize=4,
        label="Average FPS",
    )
    axes[1].bar(
        [value + width / 2 for value in x],
        df["total_textures_generated_mean"],
        width=width,
        yerr=df["total_textures_generated_std"],
        capsize=4,
        label="Generated textures",
    )
    axes[1].set_title("Frame Rate and Generated Texture Count by Reuse Configuration")
    axes[1].set_ylabel("FPS / texture count")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(labels)
    axes[1].legend()
    axes[1].grid(axis="y", alpha=0.3)

    fig.savefig(output_path, dpi=300)
    plt.close(fig)

    print(f"Saved Chapter 6.5 graph: {output_path}")


def plot_method_comparison(summary_df: pd.DataFrame, output_path: Path):
    possible_methods = ["baseline", "perlin", "worley", "simplex", "wood"]
    available_methods = [
        method for method in possible_methods
        if method in summary_df["config_type"].tolist()
    ]

    if len(available_methods) < 2:
        print("Skipping Chapter 6.6 graph: not enough method configs are available.")
        return

    df = select_configs(summary_df, available_methods)

    label_map = {
        "baseline": "None / baseline",
        "perlin": "Perlin",
        "worley": "Worley",
        "simplex": "Simplex",
        "wood": "Wood",
    }

    labels = [label_map[value] for value in df["config_type"].tolist()]
    x = list(range(len(labels)))

    fig, axes = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)

    axes[0].bar(
        x,
        df["avg_texture_gen_ms_mean"],
        yerr=df["avg_texture_gen_ms_std"],
        capsize=4,
    )
    axes[0].set_title("Texture Generation Cost by Synthesis Method")
    axes[0].set_ylabel("Milliseconds")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(labels)
    axes[0].grid(axis="y", alpha=0.3)

    width = 0.35

    axes[1].bar(
        [value - width / 2 for value in x],
        df["avg_fps_mean"],
        width=width,
        yerr=df["avg_fps_std"],
        capsize=4,
        label="Average FPS",
    )
    axes[1].bar(
        [value + width / 2 for value in x],
        df["min_fps_mean"],
        width=width,
        yerr=df["min_fps_std"],
        capsize=4,
        label="Minimum FPS",
    )
    axes[1].axhline(60, linestyle="--", linewidth=1, label="60 FPS target")
    axes[1].axhline(30, linestyle=":", linewidth=1, label="30 FPS lower boundary")
    axes[1].set_title("Frame Rate by Synthesis Method")
    axes[1].set_ylabel("Frames per second")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(labels)
    axes[1].legend()
    axes[1].grid(axis="y", alpha=0.3)

    fig.savefig(output_path, dpi=300)
    plt.close(fig)

    print(f"Saved Chapter 6.6 graph: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate all currently possible evaluation graphs from checkpoint run CSVs."
    )

    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("."),
        help="Folder containing the checkpoint-* result folders.",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("evaluation-output"),
        help="Output folder for graphs and aggregated CSV files.",
    )

    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    runs_df = collect_all_runs(args.data_root)
    summary_df = aggregate_by_config(runs_df)

    runs_csv = args.output_dir / "all_available_runs_summary.csv"
    summary_csv = args.output_dir / "all_available_configs_aggregated.csv"

    runs_df.to_csv(runs_csv, index=False)
    summary_df.to_csv(summary_csv, index=False)

    print(f"Saved all run summaries to: {runs_csv}")
    print(f"Saved aggregated config summary to: {summary_csv}")
    print()

    plot_quality_performance(
        summary_df,
        args.output_dir / "chapter_6_3_quality_performance.png",
    )

    plot_view_distance_scalability(
        summary_df,
        args.output_dir / "chapter_6_4_view_distance_scalability.png",
    )

    plot_texture_reuse(
        summary_df,
        args.output_dir / "chapter_6_5_texture_reuse.png",
    )

    plot_method_comparison(
        summary_df,
        args.output_dir / "chapter_6_6_method_comparison.png",
    )

    print()
    print("Available aggregated results:")
    print(summary_df.to_string(index=False))


if __name__ == "__main__":
    main()