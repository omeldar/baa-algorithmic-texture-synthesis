from pathlib import Path
import argparse
import re

import pandas as pd
import matplotlib.pyplot as plt


CONFIG_LABELS = {
    "wood-fast-preview": "Fast preview",
    "wood-balanced": "Balanced",
    "wood-high-search": "High search",
    "wood-high-mutation": "High mutation",
    "wood-low-mutation": "Low mutation",
    "wood-quality-256": "Quality 256",
}


def read_metadata(csv_path: Path) -> dict:
    """
    Reads metadata lines at the top of the CSV, for example:
    # population_size,25
    # runtime_s,231.473
    """
    metadata = {}

    with csv_path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            if not line.startswith("#"):
                break

            line = line[1:].strip()

            if "," in line:
                key, value = line.split(",", 1)
                key = key.strip()
                value = value.strip()

                try:
                    metadata[key] = float(value)
                except ValueError:
                    metadata[key] = value

    return metadata


def read_history(csv_path: Path) -> pd.DataFrame:
    """
    Reads the optimization history and ignores metadata lines starting with '#'.
    """
    df = pd.read_csv(csv_path, comment="#")

    required_columns = [
        "generation",
        "elapsed_s",
        "best_fitness",
        "best_ever_fitness",
        "mean_fitness",
    ]

    missing = [column for column in required_columns if column not in df.columns]

    if missing:
        raise ValueError(
            f"{csv_path.name} is missing required columns: {', '.join(missing)}"
        )

    return df


def config_name_from_file(csv_path: Path) -> str:
    return csv_path.stem


def collect_results(data_root: Path) -> tuple[dict, pd.DataFrame]:
    """
    Loads all wood optimization CSV files and returns:
    - histories by config name
    - summary dataframe
    """
    csv_files = sorted(data_root.glob("wood-*.csv"))

    if not csv_files:
        raise FileNotFoundError(
            f"No wood-*.csv files found in {data_root}. "
            f"Run this script from the folder containing the optimization CSV files, "
            f"or pass --data-root."
        )

    histories = {}
    summaries = []

    for csv_path in csv_files:
        config_name = config_name_from_file(csv_path)
        label = CONFIG_LABELS.get(config_name, config_name)

        metadata = read_metadata(csv_path)
        history = read_history(csv_path)

        histories[config_name] = {
            "label": label,
            "metadata": metadata,
            "history": history,
        }

        first_row = history.iloc[0]
        last_row = history.iloc[-1]

        initial_fitness = float(first_row["best_ever_fitness"])
        final_fitness = float(last_row["best_ever_fitness"])
        improvement_percentage_points = (final_fitness - initial_fitness) * 100.0

        summaries.append(
            {
                "config": config_name,
                "label": label,
                "max_iterations": metadata.get("max_iterations"),
                "population_size": metadata.get("population_size"),
                "mutation_rate": metadata.get("initial_mutation_rate"),
                "output_size": metadata.get("output_size"),
                "generations_completed": metadata.get("generations_completed"),
                "total_evaluations": metadata.get("total_evaluations"),
                "runtime_s": metadata.get("runtime_s"),
                "initial_fitness": initial_fitness,
                "final_best_fitness": final_fitness,
                "initial_similarity_percent": initial_fitness * 100.0,
                "final_similarity_percent": final_fitness * 100.0,
                "improvement_percentage_points": improvement_percentage_points,
            }
        )

    summary_df = pd.DataFrame(summaries)

    order = list(CONFIG_LABELS.keys())
    summary_df["order"] = summary_df["config"].apply(
        lambda value: order.index(value) if value in order else len(order)
    )
    summary_df = summary_df.sort_values("order").drop(columns=["order"])

    return histories, summary_df


def plot_convergence_by_generation(histories: dict, output_path: Path):
    """
    Main thesis graph:
    x-axis = generation
    y-axis = best similarity found so far
    """
    fig, ax = plt.subplots(figsize=(10, 6))

    ordered_configs = list(CONFIG_LABELS.keys())

    for config_name in ordered_configs:
        if config_name not in histories:
            continue

        entry = histories[config_name]
        df = entry["history"]

        ax.plot(
            df["generation"],
            df["best_ever_fitness"] * 100.0,
            label=entry["label"],
            linewidth=2,
        )

    ax.set_title("Wood Optimization Convergence")
    ax.set_xlabel("Generation")
    ax.set_ylabel("Best similarity found so far (%)")
    ax.grid(axis="y", alpha=0.3)
    ax.legend()

    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(f"Saved convergence graph: {output_path}")


def plot_convergence_by_time(histories: dict, output_path: Path):
    """
    Optional graph:
    x-axis = elapsed time
    y-axis = best similarity found so far
    """
    fig, ax = plt.subplots(figsize=(10, 6))

    ordered_configs = list(CONFIG_LABELS.keys())

    for config_name in ordered_configs:
        if config_name not in histories:
            continue

        entry = histories[config_name]
        df = entry["history"]

        ax.plot(
            df["elapsed_s"],
            df["best_ever_fitness"] * 100.0,
            label=entry["label"],
            linewidth=2,
        )

    ax.set_title("Wood Optimization Convergence Over Time")
    ax.set_xlabel("Elapsed time (s)")
    ax.set_ylabel("Best similarity found so far (%)")
    ax.grid(axis="y", alpha=0.3)
    ax.legend()

    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(f"Saved time convergence graph: {output_path}")


def plot_final_similarity(summary_df: pd.DataFrame, output_path: Path):
    """
    Compact comparison of final similarity values.
    """
    fig, ax = plt.subplots(figsize=(10, 6))

    labels = summary_df["label"].tolist()
    values = summary_df["final_similarity_percent"].tolist()

    ax.bar(labels, values)

    ax.set_title("Final Wood Optimization Similarity by Configuration")
    ax.set_ylabel("Final similarity (%)")
    ax.set_ylim(0, 100)
    ax.grid(axis="y", alpha=0.3)

    plt.xticks(rotation=25, ha="right")

    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(f"Saved final similarity graph: {output_path}")


def plot_runtime_vs_similarity(summary_df: pd.DataFrame, output_path: Path):
    """
    Shows the trade-off between optimization runtime and final similarity.
    """
    fig, ax = plt.subplots(figsize=(10, 6))

    ax.scatter(
        summary_df["runtime_s"],
        summary_df["final_similarity_percent"],
        s=80,
    )

    for _, row in summary_df.iterrows():
        ax.annotate(
            row["label"],
            (row["runtime_s"], row["final_similarity_percent"]),
            textcoords="offset points",
            xytext=(6, 6),
            fontsize=9,
        )

    ax.set_title("Optimization Runtime vs. Final Similarity")
    ax.set_xlabel("Runtime (s)")
    ax.set_ylabel("Final similarity (%)")
    ax.set_ylim(0, 100)
    ax.grid(alpha=0.3)

    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(f"Saved runtime trade-off graph: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Plot Wood optimization convergence graphs from exported CSV files."
    )

    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("."),
        help="Folder containing wood-*.csv optimization history files.",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("optimization-output"),
        help="Folder where graphs and summary CSV are saved.",
    )

    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    histories, summary_df = collect_results(args.data_root)

    summary_output = args.output_dir / "wood_optimization_summary.csv"
    summary_df.to_csv(summary_output, index=False)
    print(f"Saved summary CSV: {summary_output}")

    plot_convergence_by_generation(
        histories,
        args.output_dir / "wood_optimization_convergence_by_generation.png",
    )

    plot_convergence_by_time(
        histories,
        args.output_dir / "wood_optimization_convergence_by_time.png",
    )

    plot_final_similarity(
        summary_df,
        args.output_dir / "wood_optimization_final_similarity.png",
    )

    plot_runtime_vs_similarity(
        summary_df,
        args.output_dir / "wood_optimization_runtime_vs_similarity.png",
    )

    print()
    print("Summary:")
    print(summary_df.to_string(index=False))


if __name__ == "__main__":
    main()