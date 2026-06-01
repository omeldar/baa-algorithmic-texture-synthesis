# Procedural Texture Generation - Test Protocol

**Tester:** **Eldar Omerovic**
**Date:** 1st June 2026
**Browser:** Brave
**GPU:** TBD  
**Screen Resolution:** 1920x1080

---

## Pre-Test Setup

1. Open Brave with WebGPU enabled
2. Navigate to the application
3. Click "See it in Action" to open Terrain Explorer
4. Click "Reset Camera" to ensure default position
5. Verify camera settings: Height=50, Distance=60

---

## TEST 1: Baseline Performance (Default Settings)

**Objective:** Measure baseline performance with default configuration

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Set all values as above
2. Click "Reset Camera"
3. Enable Auto Move
4. Click Record button
5. Wait 60 seconds
6. Export CSV and PDF

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 60 |
| Min FPS | 57 |
| Max FPS | 66 |
| Avg Texture Gen (ms) | n/a |
| Avg Chunk Gen (ms) | 0.055 |
| Avg Render (ms) | 81.35 |
| Filename | report-baseline-1780313394213.pdf, timing-data-baseline-1780313369409.csv |

---

## TEST 2: Low Quality Configuration

**Objective:** Measure performance with minimal quality settings

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 2 |
| Terrain Quality | 16 |
| Texture Reuse Rate | 1:5 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Set all values as above
2. Click "Reset Camera"
3. Enable Auto Move
4. Click Record button
5. Wait 60 seconds
6. Export CSV and PDF

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 61.2 |
| Min FPS | 59 |
| Max FPS | 64 |
| Avg Texture Gen (ms) | n/a |
| Avg Chunk Gen (ms) | 0.047 |
| Avg Render (ms) | 47.61 |
| Filename | report-low-quality-1780320630098.pdf, timing-data-low-quality-1780320636150.csv |

---

## TEST 3: High Quality Configuration

**Objective:** Measure performance with high quality settings

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 5 |
| Terrain Quality | 64 |
| Texture Reuse Rate | Unique |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Set all values as above
2. Click "Reset Camera"
3. Enable Auto Move
4. Click Record button
5. Wait 60 seconds
6. Export CSV and PDF

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 51.1 |
| Min FPS | 34 |
| Max FPS | 60 |
| Avg Texture Gen (ms) | n/a |
| Avg Chunk Gen (ms) | 0.055 |
| Avg Render (ms) | 167.3 |
| Filename | report-high-quality-1780321207994.pdf, timing-data-high-quality-1780321212154.csv |

---

## TEST 4: Reproducibility Run 1

**Objective:** Verify identical seeds produce identical results

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 99999 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Refresh the page completely
2. Open Terrain Explorer
3. Set all values as above
4. Click "Reset Camera"
5. Enable Auto Move
6. Click Record button
7. Wait 60 seconds
8. Export CSV

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 60.7 |
| Min FPS | 57 |
| Max FPS | 64 |
| Avg Texture Gen (ms) | n/a |
| Avg Chunk Gen (ms) | 0.050 |
| Avg Render (ms) | 87.96 |
| Filename | report-reproducibility-run-1780322031398.pdf, timing-data-reproducibility-run-1780322035891.csv |

---

## TEST 5: Reproducibility Run 2

**Objective:** Second run with identical settings to Test 5

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 99999 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Refresh the page completely
2. Open Terrain Explorer
3. Set all values as above (IDENTICAL to Test 4)
4. Click "Reset Camera"
5. Enable Auto Move
6. Click Record button
7. Wait 60 seconds
8. Export CSV

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 60.6 |
| Min FPS | 55 |
| Max FPS | 65 |
| Avg Texture Gen (ms) | n/a |
| Avg Chunk Gen (ms) | 0.067 |
| Avg Render (ms) | 100 |
| Filename | report-reproducibility-run-1780323634276.pdf, timing-data-reproducibility-run-1780323639688.csv |
| Match Test 5? | YES, small deviations were to be expected. |

---

## TEST 6: View Distance Scaling (VD=1)

**Objective:** Measure impact of view distance on performance

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 1 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Set all values as above
2. Click "Reset Camera"
3. Enable Auto Move
4. Record for 60 seconds
5. Export CSV

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 61.8 |
| Avg Render (ms) | 70.78 |
| Avg Chunk Gen (ms) | 0.057 |
| Filename | report-vd-1-1780324173325.pdf, timing-data-vd-1-1780324169080.csv |

---

## TEST 7: View Distance Scaling (VD=3)

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 59.6 |
| Avg Render (ms) | 83.51 |
| Avg Chunk Gen (ms) | 0.064 |
| Filename | report-vd-3-1780325016009.pdf, timing-data-vd-3-1780325024778.csv|

---

## TEST 8: View Distance Scaling (VD=5)

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 5 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 55.2 |
| Avg Render (ms) | 73.35 |
| Avg Chunk Gen (ms) | 0.050 |
| Filename | report-vd-5-1780333418269.pdf, timing-data-vd-5-1780333413594.csv |

---

## TEST 9: Texture Reuse Impact (0 reuse)

**Objective:** Measure texture generation load with no caching

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 24 |
| Texture Reuse Rate | 0 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Tree - Trunk | Wood Grain (Default Settings) |
| Pine - Trunk | Wood Grain (Default Settings) |
| Rock - Rock | Perlin Noise (Default Settings) |
| Bush - Main | Simplex / warped (Default Settings) |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 48.2 |
| Avg Texture Gen (ms) | 19.431 |
| Avg Render (ms) | 540.33 |
| Avg Chunk Gen (ms) | 0.048|
| Filename | report-0-reuse-1780334095249.pdf, timing-data-0-reuse-1780334090104.csv |

---

## TEST 10: Texture Reuse Impact (1:25 reuse)

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 0.5 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 30 seconds |

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 55.2 |
| Avg Texture Gen (ms) | 19.775 |
| Avg Render (ms) | 266.90 |
| Avg Chunk Gen (ms) | 0.050 |
| Filename | report-25-reuse-1780334997103.pdf, timing-data-25-reuse-1780335002623.csv |

---

## TEST 11: Texture Reuse Impact (1:50 reuse)

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 0.8 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 30 seconds |

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 54.4 |
| Avg Texture Gen (ms) | 19.587 |
| Avg Render (ms) | 331.69 |
| Avg Chunk Gen (ms) | 0.062 |
| Filename | report-50-reuse-1780336165844.pdf, timing-data-50-reuse-1780336170378.csv |

---

# PART B: Synthesis Method Comparison for Real-Time Feasibility

> This section evaluates which synthesis methods are suitable for real-time
> procedural environments. They were evaluated on better hardware. The approach:
>
> 1. **Elimination Tests (12-14):** Measure CPU-based methods in the Texture Lab
>    to document why they are NOT feasible for real-time use (generation time >> 16ms frame budget).
>
> 2. **Real-Time Method Comparison (15-19):** Test the 4 GPU-based methods
>    (Perlin, Simplex, Worley, Wood) directly IN THE TERRAIN EXPLORER to compare
>    their real-time performance when applied to scene objects.
>
> **Real-time threshold:** 16.67ms per frame (60 FPS) or 33.33ms (30 FPS minimum acceptable)

---

## TEST 12: CPU Method Elimination - Efros-Leung

**Objective:** Document why Efros-Leung is NOT suitable for real-time use.
Measure generation time at multiple resolutions in the Texture Lab.

**Location:** Main Texture Lab (NOT Terrain Explorer)

**Instructions:**

1. Select "Efros-Leung" from sidebar
2. Set Seed = 42, Neighborhood Size = 5, Error Tolerance = 0.1
3. Generate at 64x64, note time from "Generated in X.Xs"
4. Generate at 128x128, note time
5. Generate at 256x256 (max), note time
6. Download the metrics report

**Results:**
| Resolution | Generation Time | vs 16ms Budget | Real-Time Feasible? |
|------------|-----------------|----------------|---------------------|
| 64x64 | 8.6 s | 537.5x over | NO |
| 128x128 | 35.8 s | 2237.5x over | NO |
| 256x256 | 144.4 s | 9025x over | NO |

**Conclusion:** Efros-Leung generation time is for even only 64x64 textures about 537 times the 16ms frame budget.
**Reason for elimination:** Efros–Leung involves many sequential steps, making it difficult to parallelize and therefore unsuitable for real-time 3D environments.

---

## TEST 13: CPU Method Elimination - Image Quilting

**Objective:** Document why Image Quilting is NOT suitable for real-time use.

**Location:** Main Texture Lab (NOT Terrain Explorer)

**Instructions:**

1. Select "Image Quilting" from sidebar
2. Set Seed = 42, Patch Size = 32, Overlap = 8, Error Tolerance = 0.1
3. Generate at 128x128, note time
4. Generate at 256x256, note time
5. Generate at 512x512 (max), note time
6. Download the metrics report

**Results:**
| Resolution | Generation Time | vs 16ms Budget | Real-Time Feasible? |
|------------|-----------------|----------------|---------------------|
| 128x128 | 0.11 s | 7x over | NO |
| 256x256 | 0.14 s | 9x over | NO |
| 512x512 | 0.68 s | 12x over | NO |

**Conclusion:** Image Quilting generation time is even from small textures seven times the 16ms frame budget.
**Reason for elimination:** Image-Quilting involves many sequential steps, making it difficult to parallelize and therefore unsuitable for real-time 3D environments.

---

## TEST 14: Optimization Method Elimination

**Objective:** Document why GA-based optimization is NOT suitable for real-time use.
The optimizer runs many iterations to find parameters - measure total optimization time.

**Location:** Texture Optimizer

**Instructions:**

1. Click "Texture Optimizer" on main page
2. Upload a wood reference image
3. Set: Max Iterations = 200, Population Size = 20
4. Start optimization, measure total time to completion
5. Record iterations per second

**Results:**
| Metric | Value |
|--------|-------|
| Total Optimization Time | 124.1 s |
| Iterations Completed | 200 |
| Final Similarity | 93.2% |

**Conclusion:** Optimization requires ~124 seconds total, making it suitable
only for **offline parameter discovery**, not real-time generation.
**Use case:** Pre-compute parameters, then use resulting Wood shader in real-time.

---

## TEST 15: Real-Time Method - Perlin Noise in Terrain

**Objective:** Test Perlin noise shader applied to terrain objects in real-time.

**Location:** Terrain Explorer

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| **Object Texture Assignments:** | |
| Tree - Trunk | Perlin Noise |
| Tree - Leaves | Perlin Noise |
| Pine - Trunk | Perlin Noise |
| Pine - Leaves | Perlin Noise |
| Rock - Rock | Perlin Noise |
| Rock - Shadow | Perlin Noise |
| Cactus - Body | Perlin Noise |
| Cactus - Splines | Perlin Noise |
| Bush - Main | Perlin Noise |
| Bush - Accent | Perlin Noise |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Open Terrain Explorer
2. Expand "Object Slot Overrides" panel
3. Set ALL object slots to use "Perlin Noise" with default parameters
4. Set other settings as above
5. Click "Reset Camera"
6. Enable Auto Move
7. Record for 60 seconds
8. Export CSV and PDF

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 116.9 |
| Min FPS | 102 |
| Max FPS | 120 |
| Avg Texture Gen (ms) | 1.330 |
| Avg Render (ms) | 155.12 |
| Real-Time Feasible? | YES |
| Filename | report-perlin-1780353981013.pdf, timing-data-perlin-1780353988300.csv |

---

## TEST 16: Real-Time Method - Simplex Noise in Terrain

**Objective:** Test Simplex noise shader applied to terrain objects in real-time.

**Location:** Terrain Explorer

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| **Object Texture Assignments:** | |
| Tree - Trunk | Worley Cracks |
| Tree - Leaves | Worley Cracks |
| Pine - Trunk | Worley Cracks |
| Pine - Leaves | Worley Cracks |
| Rock - Rock | Worley Cracks |
| Rock - Shadow | Worley Cracks |
| Cactus - Body | Worley Cracks |
| Cactus - Splines | Worley Cracks |
| Bush - Main | Worley Cracks |
| Bush - Accent | Worley Cracks |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Set ALL object slots to use "Worley Cracks" with default parameters
2. Set other settings as above
3. Click "Reset Camera", Enable Auto Move
4. Record for 60 seconds
5. Export CSV and PDF

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | 113.4|
| Min FPS | 10 |
| Max FPS | 120 |
| Avg Texture Gen (ms) | 4.674 |
| Avg Render (ms) | 400.49 |
| Real-Time Feasible? | NO (because of render times) |
| Filename | report-worley-1780354462420.pdf, timing-data-worley-1780354474759.csv |

---

## TEST 17: Real-Time Method Comparison - Mixed Realistic Setup

**Objective:** Compare all GPU methods in a realistic mixed-texture scenario.

**Location:** Terrain Explorer

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 1:3 |
| Camera Height | 50 |
| Camera Distance | 60 |
| **Object Texture Assignments:** | |
| Tree - Trunk | Wood Grain |
| Tree - Leaves | Simplex Noise |
| Pine - Trunk | Wood Grain |
| Pine - Leaves | Perlin Noise |
| Rock - Rock | Worley Cracks |
| Bush - Main | Simplex Noise |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Instructions:**

1. Set object slots as above (realistic material assignments)
2. Set other settings as above
3. Click "Reset Camera", Enable Auto Move
4. Record for 60 seconds
5. Export CSV and PDF

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | **\_\_** |
| Min FPS | **\_\_** |
| Max FPS | **\_\_** |
| Avg Texture Gen (ms) | **\_\_** |
| Avg Render (ms) | **\_\_** |
| Real-Time Feasible? | YES / NO |
| Filename | **\_\_** |

---

## TEST 20: GPU Method Generation Time Comparison (Texture Lab)

**Objective:** Measure exact GPU shader generation times in the Texture Lab
using the new metrics panel. Generate each method 10+ times and record avg/min/max.

**Location:** Main Texture Lab

**Instructions:**

1. Select each GPU method in sidebar
2. Click "Reset" to use default parameters
3. Change the seed parameter 10 times (e.g., 1, 2, 3... 10) to trigger 10 generations
4. Read avg/min/max from the "Generation Metrics" panel
5. Click "Report" to download PDF+CSV

**Results:**
| Method | Samples | Avg (ms) | Min (ms) | Max (ms) | Report Filename |
|--------|---------|----------|----------|----------|-----------------|
| Perlin | 10 | **\_\_** | **\_\_** | **\_\_** | **\_\_** |
| Simplex | 10 | **\_\_** | **\_\_** | **\_\_** | **\_\_** |
| Worley | 10 | **\_\_** | **\_\_** | **\_\_** | **\_\_** |
| Wood | 10 | **\_\_** | **\_\_** | **\_\_** | **\_\_** |

---

## Summary: Real-Time Feasibility Matrix

| Method         | Category      | Execution | Avg Gen Time | Terrain FPS | Real-Time? | Notes                    |
| -------------- | ------------- | --------- | ------------ | ----------- | ---------- | ------------------------ |
| Perlin         | Procedural    | GPU       | **\_\_** ms  | **\_\_**    | YES / NO   | **\_\_**                 |
| Simplex        | Procedural    | GPU       | **\_\_** ms  | **\_\_**    | YES / NO   | **\_\_**                 |
| Worley         | Rule-based    | GPU       | **\_\_** ms  | **\_\_**    | YES / NO   | **\_\_**                 |
| Wood           | Procedural    | GPU       | **\_\_** ms  | **\_\_**    | YES / NO   | Most complex (16 params) |
| Efros-Leung    | Example-based | CPU       | **\_\_** s   | N/A         | NO         | Eliminated: too slow     |
| Image Quilting | Example-based | CPU       | **\_\_** s   | N/A         | NO         | Eliminated: too slow     |
| Optimization   | Optimization  | CPU       | **\_\_** s   | N/A         | NO         | Offline use only         |

---

## Summary Table (Part A)

| Test | Description  | Avg FPS | Texture Gen (ms) | Pass/Fail |
| ---- | ------------ | ------- | ---------------- | --------- |
| 1    | Baseline     | 60      | n/a              | PASS      |
| 2    | Low Quality  | 61.2    | n/a              | PASS      |
| 3    | High Quality | 51.1    | n/a              | PASS      |
| 4    | Repro Run 1  | 60.7    | n/a              | PASS      |
| 5    | Repro Run 2  | 60.6    | n/a              | PASS      |
| 6    | VD=1         | 61.8    | n/a              | PASS      |
| 7    | VD=3         | 59.6    | n/a              | PASS      |
| 8    | VD=5         | 55.2    | n/a              | PASS      |
| 9    | Reuse 0%     | 48.2    | 19.431           | PASS      |
| 10   | Reuse 25%    | 55.2    | 19.775           | PASS      |
| 11   | Reuse 50%    | 54.4    | 19.587           | PASS      |

## Synthesis Comparison Summary (Part B)

| Test | Description                | Key Output          | Done?    |
| ---- | -------------------------- | ------------------- | -------- |
| 12   | Efros-Leung elimination    | Gen times >> 16ms   | **\_\_** |
| 13   | Image Quilting elimination | Gen times >> 16ms   | **\_\_** |
| 14   | Optimization elimination   | Total time >> 16ms  | **\_\_** |
| 15   | Perlin in Terrain          | FPS + Texture Gen   | **\_\_** |
| 16   | Simplex in Terrain         | FPS + Texture Gen   | **\_\_** |
| 17   | Worley in Terrain          | FPS + Texture Gen   | **\_\_** |
| 18   | Wood in Terrain            | FPS + Texture Gen   | **\_\_** |
| 19   | Mixed realistic setup      | FPS + Texture Gen   | **\_\_** |
| 20   | GPU method timing (Lab)    | Precise avg/min/max | **\_\_** |

---

## Pass Criteria

- **FPS >= 30:** Acceptable for real-time use
- **FPS >= 60:** Smooth real-time performance
- **Texture Gen < 16ms:** Within single frame budget at 60fps
- **Reproducibility:** Test 4 and 5 values within 5% of each other
- **CPU method elimination:** Generation time > 1 second = immediate elimination
- **GPU methods (Tests 15-18):** must maintain >= 30 FPS to pass

---

## Notes

(Use this space for observations during testing)

---
