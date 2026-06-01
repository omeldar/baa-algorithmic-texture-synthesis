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
| Avg FPS | **\_\_** |
| Avg Render (ms) | **\_\_** |
| Avg Chunk Gen (ms) | **\_\_** |

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
| Avg FPS | **\_\_** |
| Avg Render (ms) | **\_\_** |
| Avg Chunk Gen (ms) | **\_\_** |

---

## TEST 10: Texture Reuse Impact (0% reuse)

**Objective:** Measure texture generation load with no caching

**Configuration:**
| Setting | Value |
|---------|-------|
| World Seed | 12345 |
| View Distance | 3 |
| Terrain Quality | 32 |
| Texture Reuse Rate | 0.0 |
| Camera Height | 50 |
| Camera Distance | 60 |
| Auto Move | ON |
| Recording Duration | 60 seconds |

**Results:**
| Metric | Value |
|--------|-------|
| Avg FPS | **\_\_** |
| Avg Texture Gen (ms) | **\_\_** |

---

## TEST 11: Texture Reuse Impact (50% reuse)

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
| Avg FPS | **\_\_** |
| Avg Texture Gen (ms) | **\_\_** |

---

## TEST 12: Texture Reuse Impact (80% reuse)

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
| Avg FPS | **\_\_** |
| Avg Texture Gen (ms) | **\_\_** |

---

## TEST 13: Optimizer Baseline Capture

**Objective:** Test optimizer workflow and baseline comparison

**Instructions:**

1. Go back to main page
2. Click "Texture Optimizer"
3. Upload a wood texture reference image
4. Set Max Iterations: 50
5. Set Population Size: 20
6. Click "Start Optimization"
7. Wait for completion
8. Export both JSON files

**Results:**
| Metric | Value |
|--------|-------|
| Baseline Score (%) | **\_\_** |
| Final Score (%) | **\_\_** |
| Improvement (%) | **\_\_** |
| Iterations to Best | **\_\_** |
| Total Time (s) | **\_\_** |
| Params Filename | **\_\_** |

---

## TEST 14: Optimizer with Different Selection Method

**Configuration:**
| Setting | Value |
|---------|-------|
| Max Iterations | 50 |
| Population Size | 20 |
| Selection Method | Roulette |
| Crossover Method | Blend |
| Same reference image as Test 13 |

**Results:**
| Metric | Value |
|--------|-------|
| Baseline Score (%) | **\_\_** |
| Final Score (%) | **\_\_** |
| Improvement (%) | **\_\_** |
| Iterations to Best | **\_\_** |

---

## TEST 15: Static Scene Screenshot

**Objective:** Capture visual quality at rest

**Instructions:**

1. Open Terrain Explorer
2. Set World Seed: 12345
3. Set View Distance: 5
4. Set Terrain Quality: 64
5. Click "Reset Camera"
6. Disable Auto Move
7. Wait 5 seconds for scene to load
8. Take browser screenshot (F12 > Capture screenshot)

**Results:**
| Item | Value |
|------|-------|
| Screenshot filename | **\_\_** |
| Visible chunks | **\_\_** |
| Visual artifacts? | YES / NO |
| Notes | **\_\_** |

---

# PART B: Synthesis Method Comparison

> These tests compare the 7 synthesis methods directly against each other on the
> same criteria (generation time, visual quality, resolution scaling, parameter
> control, tileability). Run all of Part B in the main Texture Lab (NOT the
> Terrain Explorer). Select each method from the left sidebar.
>
> Method categories:
>
> - **Procedural / GPU:** Perlin, Simplex, Worley, Wood (render in real time, no progress bar, no on-screen time)
> - **Example-based / CPU:** Efros-Leung, Image Quilting (show progress bar + "Generated in X.Xs")
> - **Optimisation:** Optimisation-Based (genetic algorithm, optimises Wood)

---

## TEST 16: Procedural Method Generation (Defaults)

**Objective:** Generate each procedural (GPU) method at default parameters and
capture a reference image + subjective quality. Procedural methods render in
real time, so there is no on-screen generation time; confirm they are
GPU-instant (< 1 frame, no visible delay).

**Instructions:**

1. Open main Texture Lab (not Terrain Explorer)
2. For EACH method below: select it in the sidebar, click "Reset" (defaults), wait for render
3. Click "Export" to save the PNG
4. Rate visual quality 1-5 subjectively

**Results:**
| Method | Real-time? | Visual Quality (1-5) | PNG Filename |
|--------|-----------|----------------------|--------------|
| Perlin | YES / NO | **\_\_** | **\_\_** |
| Simplex | YES / NO | **\_\_** | **\_\_** |
| Worley | YES / NO | **\_\_** | **\_\_** |
| Wood | YES / NO | **\_\_** | **\_\_** |

---

## TEST 17: Example-Based Generation Time @ 128x128

**Objective:** Measure CPU synthesis time for example-based methods at low
resolution. These methods display "Generated in X.Xs" when complete.

**Configuration:**
| Setting | Efros-Leung | Image Quilting |
|---------|-------------|----------------|
| Output Width | 128 | 128 |
| Output Height | 128 | 128 |
| Seed | 42 | 42 |
| Neighborhood / Patch Size | 5 | 32 |
| Error Tolerance | 0.1 | 0.1 |

**Instructions:**

1. Select Efros-Leung in sidebar
2. Set Output Width/Height = 128, other params as above
3. Wait for synthesis to complete; read "Generated in X.Xs"
4. Export PNG
5. Repeat for Image Quilting

**Results:**
| Method | Output Size | Generation Time (s) | Visual Quality (1-5) | PNG Filename |
|--------|-------------|---------------------|----------------------|--------------|
| Efros-Leung | 128x128 | **\_\_** | **\_\_** | **\_\_** |
| Image Quilting | 128x128 | **\_\_** | **\_\_** | **\_\_** |

---

## TEST 18: Example-Based Generation Time @ 256x256

**Objective:** Measure how example-based synthesis time scales with resolution
(compare directly against Test 17).

**Configuration:**
| Setting | Efros-Leung | Image Quilting |
|---------|-------------|----------------|
| Output Width | 256 | 256 |
| Output Height | 256 | 256 |
| Seed | 42 | 42 |
| Neighborhood / Patch Size | 5 | 32 |
| Error Tolerance | 0.1 | 0.1 |

**Instructions:**

1. Select Efros-Leung, set Output Width/Height = 256
2. Wait for completion; read "Generated in X.Xs"
3. Export PNG
4. Repeat for Image Quilting

**Results:**
| Method | Output Size | Generation Time (s) | Scaling vs 128 (x) | PNG Filename |
|--------|-------------|---------------------|--------------------|--------------|
| Efros-Leung | 256x256 | **\_\_** | **\_\_** | **\_\_** |
| Image Quilting | 256x256 | **\_\_** | **\_\_** | **\_\_** |

> Scaling factor = Test 18 time / Test 17 time. A 4x pixel increase that produces
> ~4x time indicates linear scaling; higher indicates worse-than-linear.

---

## TEST 19: Common-Resolution Visual Comparison @ 256x256

**Objective:** Generate every method that supports 256x256 at the SAME resolution
so visual quality can be compared fairly side by side.

**Instructions:**

1. For procedural methods (Perlin/Simplex/Worley/Wood), generate at defaults (native GPU resolution)
2. For example-based methods, reuse the 256x256 PNGs from Test 18
3. For Optimisation-Based, set Output Size = 256, run a short optimisation (50 iters), export result
4. Place all PNGs side by side and rate each on the criteria below (1-5)

**Results:**
| Method | Realism (1-5) | Detail (1-5) | Visible Artifacts? | Overall (1-5) | PNG Filename |
|--------|---------------|--------------|--------------------|---------------|--------------|
| Perlin | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |
| Simplex | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |
| Worley | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |
| Wood | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |
| Efros-Leung | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |
| Image Quilting | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |
| Optimisation | **\_\_** | **\_\_** | YES / NO | **\_\_** | **\_\_** |

---

## TEST 20: Parameter Controllability Comparison

**Objective:** Compare how much visual control each method offers. For each
method, vary ONE key parameter from min to max and judge how predictably the
output responds.

**Instructions:**

1. Select each method
2. Drag the listed key parameter from minimum to maximum
3. Note parameter count (visible sliders) and rate control predictability 1-5

**Results:**
| Method | Key Param Varied | # Params | Predictable Response (1-5) | Notes |
|--------|------------------|----------|----------------------------|-------|
| Perlin | scale | 6 | **\_\_** | **\_\_** |
| Simplex | warp | 5 | **\_\_** | **\_\_** |
| Worley | edgeWidth | 5 | **\_\_** | **\_\_** |
| Wood | grainScale | 16 | **\_\_** | **\_\_** |
| Efros-Leung | neighborhoodSize | 5 | **\_\_** | **\_\_** |
| Image Quilting | patchSize | 6 | **\_\_** | **\_\_** |

---

## TEST 21: Tileability / Seam Test

**Objective:** Determine which methods produce seamless/tileable output (key for
texturing large surfaces). Export a texture, then check if opposite edges would
tile without a visible seam.

**Instructions:**

1. For each method, export a default texture
2. In an image editor (or by offsetting the image by 50%), check left/right and top/bottom edge continuity
3. Mark tileable YES/NO and severity of seam (none / minor / major)

**Results:**
| Method | Tileable? | Seam Severity | Notes |
|--------|-----------|---------------|-------|
| Perlin | YES / NO | none / minor / major | **\_\_** |
| Simplex | YES / NO | none / minor / major | **\_\_** |
| Worley | YES / NO | none / minor / major | **\_\_** |
| Wood | YES / NO | none / minor / major | **\_\_** |
| Efros-Leung | YES / NO | none / minor / major | **\_\_** |
| Image Quilting | YES / NO | none / minor / major | **\_\_** |

---

## TEST 22: Method Comparison Matrix (Synthesis)

**Objective:** Consolidate all Part B findings into one cross-method comparison.
Fill from Tests 16-21. Use 1-5 where applicable.

**Results:**
| Method | Category | Speed (1-5) | Visual Quality (1-5) | Control (1-5) | Tileable | Reproducible | Best Use Case |
|--------|----------|-------------|----------------------|---------------|----------|--------------|---------------|
| Perlin | Procedural | **\_\_** | **\_\_** | **\_\_** | Y / N | YES | **\_\_** |
| Simplex | Procedural | **\_\_** | **\_\_** | **\_\_** | Y / N | YES | **\_\_** |
| Worley | Rule-based | **\_\_** | **\_\_** | **\_\_** | Y / N | YES | **\_\_** |
| Wood | Procedural | **\_\_** | **\_\_** | **\_\_** | Y / N | YES | **\_\_** |
| Efros-Leung | Example | **\_\_** | **\_\_** | **\_\_** | Y / N | NO (Math.random) | **\_\_** |
| Image Quilting | Example | **\_\_** | **\_\_** | **\_\_** | Y / N | YES | **\_\_** |
| Optimisation | Optimisation | **\_\_** | **\_\_** | **\_\_** | Y / N | YES | **\_\_** |

> Speed: 5 = real-time / GPU instant, 1 = many seconds on CPU.
> Reproducible column pre-filled from code analysis; confirm by re-running with
> the same seed where possible.

---

## Summary Table

| Test | Description   | Avg FPS  | Texture Gen (ms) | Pass/Fail |
| ---- | ------------- | -------- | ---------------- | --------- |
| 1    | Baseline      | 60       | n/a              | **\_\_**  |
| 2    | Low Quality   | **\_\_** | **\_\_**         | **\_\_**  |
| 3    | High Quality  | **\_\_** | **\_\_**         | **\_\_**  |
| 4    | Ultra Quality | **\_\_** | **\_\_**         | **\_\_**  |
| 5    | Repro Run 1   | **\_\_** | **\_\_**         | **\_\_**  |
| 6    | Repro Run 2   | **\_\_** | **\_\_**         | **\_\_**  |
| 7    | VD=2          | **\_\_** | **\_\_**         | **\_\_**  |
| 8    | VD=4          | **\_\_** | **\_\_**         | **\_\_**  |
| 9    | VD=6          | **\_\_** | **\_\_**         | **\_\_**  |
| 10   | Reuse 0%      | **\_\_** | **\_\_**         | **\_\_**  |
| 11   | Reuse 50%     | **\_\_** | **\_\_**         | **\_\_**  |
| 12   | Reuse 80%     | **\_\_** | **\_\_**         | **\_\_**  |
| 13   | Optimizer     | N/A      | N/A              | **\_\_**  |
| 14   | Optimizer Alt | N/A      | N/A              | **\_\_**  |
| 15   | Screenshot    | N/A      | N/A              | **\_\_**  |

## Synthesis Comparison Summary

| Test | Description                      | Key Output            | Done?    |
| ---- | -------------------------------- | --------------------- | -------- |
| 16   | Procedural generation (defaults) | 4 PNGs + quality      | **\_\_** |
| 17   | Example-based time @ 128         | 2 gen times           | **\_\_** |
| 18   | Example-based time @ 256         | 2 gen times + scaling | **\_\_** |
| 19   | Common-res visual comparison     | 7 quality ratings     | **\_\_** |
| 20   | Parameter controllability        | 6 control ratings     | **\_\_** |
| 21   | Tileability / seam test          | 6 tileable verdicts   | **\_\_** |
| 22   | Method comparison matrix         | Consolidated table    | **\_\_** |

---

## Pass Criteria

- **FPS >= 30:** Acceptable for real-time use
- **FPS >= 60:** Smooth real-time performance
- **Texture Gen < 16ms:** Within single frame budget at 60fps
- **Reproducibility:** Test 5 and 6 values within 5% of each other
- **Optimizer:** Final score > Baseline score
- **Procedural methods (Test 16):** must render in real time (GPU-instant)
- **Example-based scaling (Test 18):** flag if 256 time is > 5x the 128 time (worse-than-linear)

---

## Notes

---

---

---

---

---
