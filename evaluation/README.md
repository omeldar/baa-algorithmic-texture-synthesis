# Evaluation Test Protocol

## Procedural 3D Environment: Real-Time Feasibility Evaluation

**Thesis:** Algorithmic Texture Synthesis: Procedural, Rule-Based and Optimization-Based Methods in Computer Graphics  
**Author:** Eldar Omerovic  
**Protocol Version:** 2.0  
**Date Created:** 2026-05-31  
**Focus:** Real-time procedural texture synthesis in 3D environments using Terrain Explorer recording system

---

## 1. Purpose of the Evaluation

This protocol tests whether procedural texture synthesis methods are **feasible for real-time 3D applications** by using the Terrain Explorer's recording functionality to measure performance under realistic rendering conditions.

### Research Questions Addressed

| Research Question                                              | Addressed by Tests |
| -------------------------------------------------------------- | ------------------ |
| RQ2: Implementation of procedural/rule-based methods           | Tests A, B, C      |
| RQ3: Parameter estimation to approximate targets               | Test D             |
| RQ4: Comparison of methods (quality, runtime, reproducibility) | All Tests          |

### Key Metrics

| Metric                  | Target                                     | Measurement Source |
| ----------------------- | ------------------------------------------ | ------------------ |
| FPS (frames per second) | >= 30 for interactive, >= 60 for real-time | Recording CSV      |
| Texture Generation Time | < 16ms for 60 FPS budget                   | Recording CSV      |
| Chunk Generation Time   | < 33ms for 30 FPS budget                   | Recording CSV      |
| Render Time             | < 10ms overhead                            | Recording CSV      |
| Visual Quality          | Subjective 1-5 scale                       | Manual observation |

---

## 2. Test Environment Documentation

Complete this table before starting any tests:

### Environment Record

| Field                        | Value         |
| ---------------------------- | ------------- |
| **Tester Name**              |               |
| **Test Date**                | YYYY-MM-DD    |
| **Device Model**             |               |
| **CPU**                      |               |
| **GPU**                      |               |
| **GPU VRAM**                 | GB            |
| **RAM**                      | GB            |
| **Operating System**         |               |
| **Browser**                  | Chrome / Edge |
| **Browser Version**          |               |
| **Screen Resolution**        |               |
| **Prototype URL**            |               |
| **Git Commit / Version**     |               |
| **WebGPU Support Confirmed** | Yes / No      |

### WebGPU Verification Steps

1. Open Chrome/Edge
2. Navigate to `chrome://gpu` or `edge://gpu`
3. Confirm "WebGPU" shows "Hardware accelerated"
4. Navigate to prototype URL
5. Confirm no "WebGPU Not Supported" message appears
6. Record GPU adapter name if visible in console

---

## 3. Folder Structure

Create this structure before testing:

```
evaluation/
├── environment_record.md
├── configs/
│   ├── config_baseline.json
│   ├── config_high_quality.json
│   ├── config_high_density.json
│   ├── config_stress_test.json
│   └── config_optimized_wood.json
├── recordings/
│   ├── test_a_baseline/
│   ├── test_b_quality_levels/
│   ├── test_c_view_distance/
│   ├── test_d_optimized_params/
│   └── test_e_reproducibility/
├── screenshots/
│   └── [timestamp]_[config]_[description].png
├── exports/
│   ├── csv/
│   └── pdf/
└── results/
    ├── summary_tables.md
    └── figures/
```

---

## 4. Environment Configurations

### Config A: Baseline (Default Settings)

Save as `configs/config_baseline.json` or set manually:

| Setting            | Value           | Notes                     |
| ------------------ | --------------- | ------------------------- |
| Config Name        | `baseline_test` |                           |
| World Seed         | `12345`         | Fixed for reproducibility |
| View Distance      | `3`             | Default                   |
| Terrain Quality    | `32` segments   | Default                   |
| Texture Reuse Rate | `0.7`           | Default                   |
| Camera Height      | `50`            | Max zoom out              |
| Camera Distance    | `60`            | Max zoom out              |
| Camera Azimuth     | `0`             | Facing north              |
| Camera Polar       | `1.047` (PI/3)  | ~60 degrees               |
| Terrain Algorithm  | `perlin`        | Default                   |
| Terrain Seed       | `terrain_01`    |                           |
| Auto Move          | `Enabled`       | For consistent traversal  |
| Recording Duration | `60 seconds`    |                           |

### Config B: High Quality

| Setting            | Value               | Notes                |
| ------------------ | ------------------- | -------------------- |
| Config Name        | `high_quality_test` |                      |
| World Seed         | `12345`             | Same seed            |
| View Distance      | `5`                 | Increased            |
| Terrain Quality    | `64` segments       | Higher               |
| Texture Reuse Rate | `0.5`               | More unique textures |
| All other settings | Same as baseline    |                      |

### Config C: High Density (Stress Test)

| Setting            | Value            | Notes                |
| ------------------ | ---------------- | -------------------- |
| Config Name        | `stress_test`    |                      |
| World Seed         | `12345`          | Same seed            |
| View Distance      | `7`              | Maximum practical    |
| Terrain Quality    | `64` segments    | Higher               |
| Texture Reuse Rate | `0.3`            | Many unique textures |
| All other settings | Same as baseline |                      |

### Config D: Optimized Wood Parameters

| Setting            | Value                 | Notes                 |
| ------------------ | --------------------- | --------------------- |
| Config Name        | `optimized_wood_test` |                       |
| World Seed         | `12345`               | Same seed             |
| View Distance      | `3`                   | Default               |
| Terrain Algorithm  | `wood`                | Using wood shader     |
| Wood Parameters    | From optimizer export | Load optimized params |
| All other settings | Same as baseline      |                       |

---

## 5. Test A: Baseline Real-Time Performance

### Purpose

Establish baseline performance metrics for procedural texture generation in a 3D environment.

### Procedure

1. **Setup**

   - [ ] Open Terrain Explorer
   - [ ] Click "Reset Camera" to ensure consistent starting position
   - [ ] Set all parameters to Config A (Baseline) values
   - [ ] Save configuration: Export Config JSON as `config_baseline.json`

2. **Recording**

   - [ ] Enable "Auto Move" toggle
   - [ ] Click "Start Recording"
   - [ ] Wait exactly 60 seconds
   - [ ] Click "Stop Recording"
   - [ ] Note any frame drops or visual stuttering during recording

3. **Export**

   - [ ] Export CSV: `recordings/test_a_baseline/baseline_run_01.csv`
   - [ ] Export PDF Report: `recordings/test_a_baseline/baseline_run_01.pdf`
   - [ ] Take screenshot at end: `screenshots/baseline_run_01_final.png`

4. **Repeat**
   - [ ] Refresh page (reset state)
   - [ ] Repeat steps 1-3 for `run_02` and `run_03`

### Data to Record

| Run      | Mean FPS | Min FPS | Max FPS | Avg Tex Gen (ms) | Avg Chunk Gen (ms) | Avg Render (ms) | Stutters Observed |
| -------- | -------- | ------- | ------- | ---------------- | ------------------ | --------------- | ----------------- |
| 01       |          |         |         |                  |                    |                 | Yes/No            |
| 02       |          |         |         |                  |                    |                 | Yes/No            |
| 03       |          |         |         |                  |                    |                 | Yes/No            |
| **Mean** |          |         |         |                  |                    |                 |                   |

### Pass Criteria

- Mean FPS >= 30: **Interactive** (acceptable)
- Mean FPS >= 60: **Real-time** (excellent)
- Mean Texture Gen < 16ms: Within 60 FPS frame budget
- No visible stuttering during normal traversal

---

## 6. Test B: Quality Level Comparison

### Purpose

Compare performance across different quality settings to establish quality/performance tradeoffs.

### Configurations to Test

| Config            | View Distance | Terrain Quality | Texture Reuse | Expected Impact         |
| ----------------- | ------------- | --------------- | ------------- | ----------------------- |
| Low               | 2             | 16              | 0.9           | Fastest, lowest quality |
| Medium (Baseline) | 3             | 32              | 0.7           | Balanced                |
| High              | 5             | 64              | 0.5           | Better quality, slower  |
| Ultra             | 7             | 64              | 0.3           | Best quality, slowest   |

### Procedure

For each configuration:

1. [ ] Set configuration values
2. [ ] Reset camera position
3. [ ] Save config JSON: `configs/config_[level].json`
4. [ ] Enable Auto Move
5. [ ] Start Recording (60 seconds)
6. [ ] Stop Recording
7. [ ] Export CSV: `recordings/test_b_quality_levels/[level]_run_01.csv`
8. [ ] Export PDF: `recordings/test_b_quality_levels/[level]_run_01.pdf`
9. [ ] Take screenshot: `screenshots/[level]_sample.png`
10. [ ] Record results in table below

### Results Table

| Quality Level | Mean FPS | Min FPS | Tex Gen (ms) | Chunk Gen (ms) | Visual Quality (1-5) | Notes |
| ------------- | -------- | ------- | ------------ | -------------- | -------------------- | ----- |
| Low           |          |         |              |                |                      |       |
| Medium        |          |         |              |                |                      |       |
| High          |          |         |              |                |                      |       |
| Ultra         |          |         |              |                |                      |       |

### Visual Quality Rating Guide

| Score | Description                               |
| ----- | ----------------------------------------- |
| 1     | Blocky, obvious artifacts, unusable       |
| 2     | Low detail, noticeable texture repetition |
| 3     | Acceptable, some visible patterns         |
| 4     | Good quality, natural appearance          |
| 5     | Excellent, seamless, realistic            |

---

## 7. Test C: View Distance Scaling

### Purpose

Measure how performance scales with view distance (number of chunks rendered).

### Configuration

Keep constant:

- World Seed: `12345`
- Terrain Quality: `32`
- Texture Reuse Rate: `0.7`
- Camera position: Reset to default

Vary view distance: `2, 3, 4, 5, 6, 7`

### Procedure

For each view distance value:

1. [ ] Set view distance
2. [ ] Reset camera
3. [ ] Start Recording (30 seconds each - shorter for efficiency)
4. [ ] Stop Recording
5. [ ] Export CSV: `recordings/test_c_view_distance/vd_[N]_run_01.csv`
6. [ ] Record chunk count visible (approximate)
7. [ ] Record results

### Results Table

| View Distance | Approx Chunks | Mean FPS | Tex Gen (ms) | Chunk Gen (ms) | Notes |
| ------------- | ------------- | -------- | ------------ | -------------- | ----- |
| 2             | ~25           |          |              |                |       |
| 3             | ~49           |          |              |                |       |
| 4             | ~81           |          |              |                |       |
| 5             | ~121          |          |              |                |       |
| 6             | ~169          |          |              |                |       |
| 7             | ~225          |          |              |                |       |

### Analysis

Calculate scaling factor:

- **Linear scaling:** Performance degrades proportionally to chunk count
- **Sublinear scaling:** GPU parallelism helps maintain performance
- **Superlinear scaling:** Performance degrades faster than chunk count (bottleneck identified)

---

## 8. Test D: Optimized Parameters in 3D Environment

### Purpose

Test whether parameters optimized by the GA optimizer produce acceptable results in the live 3D environment.

### Prerequisites

1. Run the Texture Optimizer with a wood target image
2. Export the "Scene-ready params" JSON
3. Note the optimization fitness score

### Procedure

1. **Apply Optimized Parameters**

   - [ ] Navigate to Terrain Explorer
   - [ ] In Object Slots, select terrain material
   - [ ] Set algorithm to `wood`
   - [ ] Manually input optimized parameters OR load config
   - [ ] Save config: `configs/config_optimized_wood.json`

2. **Recording**

   - [ ] Reset camera
   - [ ] Enable Auto Move
   - [ ] Start Recording (60 seconds)
   - [ ] Stop Recording
   - [ ] Export CSV: `recordings/test_d_optimized_params/optimized_wood_run_01.csv`
   - [ ] Export PDF: `recordings/test_d_optimized_params/optimized_wood_run_01.pdf`

3. **Comparison Recording**

   - [ ] Reset to default wood parameters
   - [ ] Start Recording (60 seconds)
   - [ ] Stop Recording
   - [ ] Export CSV: `recordings/test_d_optimized_params/default_wood_run_01.csv`

4. **Visual Comparison**
   - [ ] Take screenshots of both configurations
   - [ ] Rate visual quality difference

### Results Table

| Configuration         | Optimization Score | Mean FPS | Tex Gen (ms) | Visual Quality (1-5) | Notes |
| --------------------- | ------------------ | -------- | ------------ | -------------------- | ----- |
| Default Wood Params   | N/A (baseline)     |          |              |                      |       |
| Optimized Wood Params | [from optimizer]   |          |              |                      |       |

### Questions to Answer

- [ ] Does the optimized texture look better than default in 3D context?
- [ ] Is there any performance difference between default and optimized params?
- [ ] Does the optimization score correlate with perceived 3D quality?

---

## 9. Test E: Reproducibility in 3D Environment

### Purpose

Verify that identical configurations produce identical recordings.

### Procedure

1. **First Run**

   - [ ] Load `config_baseline.json` OR set Config A manually
   - [ ] Reset camera
   - [ ] Enable Auto Move
   - [ ] Start Recording (30 seconds)
   - [ ] Stop Recording
   - [ ] Export CSV: `recordings/test_e_reproducibility/repro_run_01.csv`
   - [ ] Take screenshot at t=15s: `screenshots/repro_run_01_t15.png`
   - [ ] Take screenshot at t=30s: `screenshots/repro_run_01_t30.png`

2. **Close and Reopen**

   - [ ] Close browser tab completely
   - [ ] Reopen prototype
   - [ ] Load same configuration

3. **Second Run**

   - [ ] Repeat recording with identical settings
   - [ ] Export CSV: `recordings/test_e_reproducibility/repro_run_02.csv`
   - [ ] Take screenshots at same timestamps

4. **Third Run**

   - [ ] Repeat once more
   - [ ] Export CSV: `recordings/test_e_reproducibility/repro_run_03.csv`

5. **Compare**
   - [ ] Visually compare screenshots at same timestamps
   - [ ] Compare CSV timing patterns (not exact values, but similar ranges)
   - [ ] Note if terrain/textures appear identical

### Results

| Aspect                     | Run 01 vs 02 | Run 02 vs 03 | Run 01 vs 03 |
| -------------------------- | ------------ | ------------ | ------------ |
| Terrain Shape Identical    | Yes/No       | Yes/No       | Yes/No       |
| Texture Patterns Identical | Yes/No       | Yes/No       | Yes/No       |
| Object Placement Identical | Yes/No       | Yes/No       | Yes/No       |
| FPS Range Similar (±10%)   | Yes/No       | Yes/No       | Yes/No       |

### Expected Result

All visual elements should be **identical** across runs due to seeded random generation. Performance metrics may vary slightly due to system load.

---

## 10. Test F: Terrain Algorithm Comparison

### Purpose

Compare different terrain generation algorithms in the 3D environment.

### Algorithms to Test

| Algorithm | Category   | Expected Characteristics                       |
| --------- | ---------- | ---------------------------------------------- |
| Perlin    | Procedural | Smooth, rolling terrain                        |
| Simplex   | Procedural | Similar to Perlin, slightly different patterns |
| Worley    | Rule-based | More angular, cell-like patterns               |
| Wood      | Procedural | Grain-like patterns (unusual for terrain)      |

### Procedure

For each algorithm:

1. [ ] Set terrain algorithm in Terrain Explorer
2. [ ] Keep all other settings at baseline (Config A)
3. [ ] Reset camera
4. [ ] Start Recording (30 seconds)
5. [ ] Stop Recording
6. [ ] Export CSV: `recordings/test_f_algorithms/[algorithm]_run_01.csv`
7. [ ] Take screenshot: `screenshots/terrain_[algorithm].png`
8. [ ] Rate visual quality for terrain use

### Results Table

| Algorithm | Mean FPS | Tex Gen (ms) | Visual Quality | Terrain Suitability | Notes |
| --------- | -------- | ------------ | -------------- | ------------------- | ----- |
| Perlin    |          |              | /5             | /5                  |       |
| Simplex   |          |              | /5             | /5                  |       |
| Worley    |          |              | /5             | /5                  |       |
| Wood      |          |              | /5             | /5                  |       |

---

## 11. Recording Data Analysis Guide

### CSV Structure

The exported CSV contains:

- **Metadata header** (lines starting with #): Config name, seeds, camera settings
- **Column headers**: Sample, FPS, Timestamps, Texture Gen, Chunk Gen, Render times
- **Data rows**: Per-frame measurements

### Key Metrics to Extract

From each CSV, calculate:

```
Mean FPS = average of FPS column
Min FPS = minimum of FPS column (identifies worst drops)
Max FPS = maximum of FPS column
FPS Std Dev = standard deviation (identifies stability)

Mean Tex Gen = average of TextureGen_ms column
Mean Chunk Gen = average of ChunkGen_ms column
Mean Render = average of Render_ms column

Frame Budget Usage = (Tex Gen + Chunk Gen + Render) / 16.67ms * 100%
```

### Performance Classification

| Mean FPS | Classification | Suitability                  |
| -------- | -------------- | ---------------------------- |
| >= 60    | Real-time      | VR, fast-paced games         |
| 45-59    | Smooth         | Most games, interactive apps |
| 30-44    | Interactive    | Strategy games, exploration  |
| 20-29    | Playable       | Turn-based, casual           |
| < 20     | Slideshow      | Not suitable for real-time   |

### Frame Time Budget (60 FPS target = 16.67ms per frame)

| Component   | Budget | Acceptable | Warning |
| ----------- | ------ | ---------- | ------- |
| Texture Gen | < 5ms  | < 8ms      | > 10ms  |
| Chunk Gen   | < 5ms  | < 10ms     | > 15ms  |
| Render      | < 5ms  | < 8ms      | > 10ms  |
| Total       | < 16ms | < 25ms     | > 33ms  |

---

## 12. Summary Tables Template

### Table 1: Performance by Configuration

| Test | Config    | Mean FPS | Min FPS | Tex Gen | Chunk Gen | Render | Classification |
| ---- | --------- | -------- | ------- | ------- | --------- | ------ | -------------- |
| A    | Baseline  |          |         | ms      | ms        | ms     |                |
| B    | Low       |          |         | ms      | ms        | ms     |                |
| B    | Medium    |          |         | ms      | ms        | ms     |                |
| B    | High      |          |         | ms      | ms        | ms     |                |
| B    | Ultra     |          |         | ms      | ms        | ms     |                |
| D    | Optimized |          |         | ms      | ms        | ms     |                |

### Table 2: View Distance Scaling

| View Distance | Chunks | FPS | FPS per 100 Chunks | Scaling Type |
| ------------- | ------ | --- | ------------------ | ------------ |
| 2             | ~25    |     |                    |              |
| 3             | ~49    |     |                    |              |
| 4             | ~81    |     |                    |              |
| 5             | ~121   |     |                    |              |
| 6             | ~169   |     |                    |              |
| 7             | ~225   |     |                    |              |

### Table 3: Algorithm Comparison

| Algorithm | FPS | Tex Gen (ms) | Visual Quality | Terrain Suitability |
| --------- | --- | ------------ | -------------- | ------------------- |
| Perlin    |     |              | /5             | /5                  |
| Simplex   |     |              | /5             | /5                  |
| Worley    |     |              | /5             | /5                  |
| Wood      |     |              | /5             | /5                  |

### Table 4: Reproducibility Verification

| Aspect            | Consistent Across 3 Runs? | Notes |
| ----------------- | ------------------------- | ----- |
| Terrain Geometry  | Yes / No                  |       |
| Texture Patterns  | Yes / No                  |       |
| Object Placement  | Yes / No                  |       |
| Performance Range | Yes / No                  |       |

---

## 13. Figures to Generate

### Required Figures for Thesis

1. **Figure: FPS Over Time**

   - Line chart from baseline recording CSV
   - X-axis: Time (seconds), Y-axis: FPS
   - Include 30 FPS and 60 FPS reference lines

2. **Figure: Quality vs Performance Tradeoff**

   - Bar chart or line chart
   - X-axis: Quality level (Low/Medium/High/Ultra)
   - Y-axis: Mean FPS
   - Secondary Y-axis: Visual Quality rating

3. **Figure: View Distance Scaling**

   - Line chart
   - X-axis: View Distance (2-7)
   - Y-axis: Mean FPS
   - Show linear reference line to identify scaling type

4. **Figure: Frame Time Breakdown**

   - Stacked bar chart
   - One bar per configuration
   - Segments: Texture Gen, Chunk Gen, Render, Other
   - 16.67ms reference line

5. **Figure: Algorithm Visual Comparison**

   - 2x2 grid of screenshots
   - Same camera angle for all
   - Labels: Perlin, Simplex, Worley, Wood

6. **Figure: Terrain Explorer UI**
   - Annotated screenshot showing:
     - Control panel
     - Performance metrics overlay
     - 3D view
     - Recording controls

---

## 14. Minimum Test Set (Time-Limited Version)

If time is limited, complete at minimum:

| Test                             | Runs | Time Est. | Priority |
| -------------------------------- | ---- | --------- | -------- |
| Test A: Baseline (3 runs)        | 3    | 15 min    | Required |
| Test B: Quality Levels           | 4    | 20 min    | Required |
| Test C: View Distance (3 levels) | 3    | 10 min    | Required |
| Test E: Reproducibility          | 3    | 10 min    | Required |
| Test F: Algorithm Comparison     | 4    | 15 min    | Optional |

**Minimum total: ~55 minutes** (excluding setup)

### Minimum Required Outputs

- [ ] 3 baseline CSV files
- [ ] 4 quality level CSV files
- [ ] 3 view distance CSV files
- [ ] 3 reproducibility CSV files
- [ ] 6 screenshots minimum
- [ ] Completed summary tables 1-4
- [ ] 3 figures minimum (FPS over time, Quality vs Performance, View Distance Scaling)

---

## 15. Checklist Summary

### Pre-Test Checklist

- [ ] Environment record table completed
- [ ] WebGPU verified working
- [ ] Folder structure created
- [ ] Config files prepared or settings documented

### During-Test Checklist

- [ ] Camera reset before each recording
- [ ] Auto Move enabled for consistent traversal
- [ ] Full recording duration completed
- [ ] CSV and PDF exported immediately after each recording
- [ ] Screenshots taken at consistent points

### Post-Test Checklist

- [ ] All CSV files accounted for
- [ ] Summary tables filled in
- [ ] Figures generated
- [ ] Anomalies or issues documented
- [ ] Backup of all data created

---

## 16. Known Limitations to Document

Include in thesis:

1. **Single Hardware Configuration:** Results are specific to test hardware. WebGPU performance varies significantly across GPUs.

2. **Browser Dependency:** WebGPU implementation quality varies between Chrome and Edge versions.

3. **Auto-Move Path:** The automated camera movement follows a fixed pattern. Manual exploration might reveal different performance characteristics.

4. **Texture Caching:** The texture reuse rate affects how many unique textures are generated. Real applications might have different caching strategies.

5. **Chunk Loading Pattern:** Performance during initial load differs from steady-state exploration.

6. **No Multi-Threading Baseline:** Comparison with traditional CPU-based texture generation was not performed.

7. **Limited Algorithm Set:** Only 4 procedural algorithms were tested. Other methods (e.g., Gabor noise, Wang tiles) were not implemented.

---

## 17. Glossary

| Term               | Definition                                              |
| ------------------ | ------------------------------------------------------- |
| FPS                | Frames per second - primary performance metric          |
| Texture Gen        | Time to generate one texture using WebGPU shader        |
| Chunk Gen          | Time to create terrain mesh for one chunk               |
| Render             | Time for Three.js/WebGL to render the frame             |
| View Distance      | Number of chunks visible in each direction from camera  |
| Terrain Quality    | Mesh resolution (segments) per terrain chunk            |
| Texture Reuse Rate | Probability of reusing cached texture vs generating new |
| WebGPU             | Modern GPU API used for texture generation              |

---

**End of Protocol**

_Protocol Version 2.0 - Focused on Terrain Explorer real-time performance evaluation_
