# Algorithmic Texture Synthesis

Bachelor Thesis Project  
Lucerne University of Applied Sciences and Arts (HSLU)  
Department of Computer Science  
Author: Eldar Omerovic  
Spring Semester 2026

## Links

- Documentation: https://omeldar.github.io/baa-algorithmic-texture-synthesis/main.pdf
- Live Release: https://baa.omeldar.com/

## Overview

This repository contains the implementation, evaluation data, and documentation for a bachelor thesis on algorithmic texture synthesis in computer graphics.

The thesis investigates how procedural, rule-based, and optimization-based texture synthesis methods can be implemented and evaluated in a procedural real-time environment. The project is built around a browser-based research prototype that combines two main parts:

- a Texture Synthesis Lab for generating and inspecting parameterized textures
- a Terrain Explorer for applying generated textures in a real-time 3D scene

The prototype is not intended as a production-ready material editor. Its purpose is to provide a controlled environment for comparing texture synthesis methods with respect to runtime behaviour, scalability, reproducibility, texture reuse, visual quality, and parameter controllability.

## Research Focus

The main research question of the thesis is:

> How can algorithmic texture synthesis methods be applied in procedural real-time environments to improve variation, controllability, and scalability of generated textures?

The project focuses on:

- procedural texture generation using GPU shaders
- rule-based texture models for structured patterns
- parameterized texture definitions and controls
- texture reuse and caching in a real-time environment
- optimization-based approximation of a target texture
- quantitative evaluation using exported measurement data
- qualitative inspection of visual quality and parameter controllability

## Implemented Methods

The prototype includes several texture synthesis approaches:

| Method                           | Category      | Execution        | Purpose                                             |
| -------------------------------- | ------------- | ---------------- | --------------------------------------------------- |
| Perlin Noise                     | Procedural    | GPU / WebGPU     | Base noise patterns                                 |
| Simplex Noise                    | Procedural    | GPU / WebGPU     | Organic noise with fewer directional artifacts      |
| Wood                             | Procedural    | GPU / WebGPU     | Parameterized wood grain texture                    |
| Worley Cracks                    | Rule-based    | GPU / WebGPU     | Cellular and crack-like structures                  |
| Efros-Leung                      | Example-based | CPU / Web Worker | Pixel-based texture synthesis                       |
| Image Quilting                   | Example-based | CPU / Web Worker | Patch-based texture synthesis                       |
| Optimization-Based Approximation | Optimization  | GPU + CPU        | Parameter search for approximating a target texture |

## Key Results

The evaluation shows that procedural GPU-based methods are the most suitable for the tested real-time use case. They provide controllable visual variation with relatively low runtime cost. Rule-based methods can also be useful for structured patterns, but their performance depends strongly on the concrete algorithm and its complexity.

Texture reuse and caching improved runtime stability, especially when many objects shared visually similar materials. Optimization-based approximation was able to improve similarity to a target texture, but it is better suited as an offline parameter search method than as a real-time generation technique.

## Repository Structure

The most relevant repository folders are:

    docs/                         Thesis documentation, LaTeX sources, figures, and appendix material
    evaluation/configurations/    Configuration files for repeated evaluation runs
    evaluation/results/desktop/   Raw CSV measurements, summaries, scripts, plots, and used run configs
    src/                          Source code of the research prototype

Important evaluation outputs are stored in `evaluation/results/desktop/`. The generated thesis figures are included in `docs/figures/`.

## Technologies

The prototype is implemented as a browser-based web application.

Main technologies:

- Next.js / React
- TypeScript
- three.js / React Three Fiber
- WebGPU
- WGSL shaders
- Web Workers
- Tailwind CSS
- shadcn/ui
- Python scripts for evaluation plots and CSV aggregation

## Evaluation Data

The evaluation is based on repeated test runs exported as CSV files. The data includes measurements such as:

- average FPS
- minimum FPS
- render time
- texture generation time
- chunk generation time
- standard deviation across repeated runs
- optimization convergence data

The evaluation scripts aggregate the raw CSV files and generate the figures used in the thesis.

## Running the Prototype

Install dependencies:

    npm install

Start the development server:

    npm run dev

Open the application in a browser that supports WebGPU. Chromium-based browsers are recommended.

## Notes

This project was developed as a research prototype for a bachelor thesis. It prioritizes controllability, reproducibility, and evaluation over production-level rendering features.

Some functionality depends on WebGPU support. Procedural and rule-based methods are intended for interactive use, while CPU-based example methods and optimization-based approximation are mainly evaluated as offline or laboratory-style approaches.

## License

This repository was created as part of a bachelor thesis at HSLU.

License information is currently not defined.
