# Documentation

This directory contains the complete thesis documentation. It includes the full LaTeX source code, configuration files, chapter files, bibliography, and supporting material required to build the final thesis document.

## Purpose

The `/docs` folder serves as the authoritative source for the written thesis, including:

- Research problem and motivation
- Theoretical foundations
- Methodology and implementation details
- Experimental evaluation
- Results and discussion
- References and appendices

All modifications to the written thesis should be made within this directory.

## Structure

Typical contents include:

- `main.tex` – Root LaTeX file
- `preamble.tex` – Global package configuration
- `macros.tex` – Custom LaTeX commands
- `acronyms.tex` – Centralized acronym definitions
- `lststyles.tex` – Code listing configurations
- Chapter files (e.g., `01_*.tex`)
- `hypersetup.tex` – Hyperref configuration
- Bibliography files (`.bib`)
- `Makefile` – Build automation

## Building the Thesis

Use:

```
make
```

Ensure the required LaTeX toolchain is installed, including:

- `pdflatex`
- `biber`
- `makeglossaries`

## Notes

- Acronyms are defined in `acronyms.tex` and require `makeglossaries`.
- Bibliography processing uses `biber`.
- The compiled PDF is generated in this directory or in a designated build folder.

This directory is intended to remain self-contained and reproducible.
