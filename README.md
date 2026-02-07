# Omini Data Viewer

A VS Code / Cursor extension that lets you **open and inspect binary data files** directly in the editor — no Python scripts, no terminal, just click and view.

Supports `.npy`, `.npz`, `.pkl`, `.hdf5`, `.arrow`, `.feather`, `.mat` with format-specific UIs: data tables for arrays, collapsible trees for dicts, a hierarchical browser for HDF5 groups, columnar preview for Arrow/Feather, and variable browsing for MATLAB.

## Supported Formats

| Format | Extensions | Description |
|--------|-----------|-------------|
| NumPy array | `.npy` | Single array with shape / dtype / data table |
| NumPy archive | `.npz` | Multiple arrays, clickable list to switch |
| Python Pickle | `.pkl` `.pickle` | Nested dicts, lists, scalars — interactive tree |
| HDF5 | `.h5` `.hdf5` | Groups + datasets hierarchy, shape badges, large file support |
| Apache Arrow | `.arrow` `.feather` | Columnar table with schema, column types, data preview |
| MATLAB | `.mat` | Named variables with shape/type info, clickable variable list |

## Features

- **Zero config** — just open a file and it renders automatically
- **Data tables** — arrays displayed in a clean table with row/column indices, hover for full precision
- **Interactive tree** — Pickle and HDF5 trees are collapsible with color-coded value types
- **Format-aware UI** — each format gets a tailored layout (sidebar overview + main content area)
- **Large file handling** — HDF5 files up to 500 MB+; datasets larger than 10k elements show metadata only (shape, dtype) without loading data into memory
- **Human-readable dtypes** — `float64` instead of `<f8`, `int32` instead of `<i4`

## Usage

1. Open any supported file in VS Code / Cursor
2. The extension opens it automatically with a visual preview
3. Or use **Command Palette** → `Open Data Viewer`

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Package as .vsix
npm run package
```

### Test Samples

Generate test files with Python (requires `numpy` and `h5py`):

```bash
conda activate dataviewer   # or any env with numpy, h5py, pyarrow, scipy
python test/generate_samples.py
```

This creates sample files in `test/samples/` covering all supported formats.

## Tech Stack

- **Language**: TypeScript
- **Parsing**:
  - NumPy (.npy/.npz): Custom parser (no native deps)
  - Pickle: [pickleparser](https://www.npmjs.com/package/pickleparser)
  - HDF5: [jsfive](https://www.npmjs.com/package/jsfive) (pure JavaScript, no WASM)
  - Arrow/Feather: [apache-arrow](https://www.npmjs.com/package/apache-arrow) (official JS implementation)
  - MATLAB: [mat-for-js](https://www.npmjs.com/package/mat-for-js) (pure JavaScript)
  - ZIP: [jszip](https://www.npmjs.com/package/jszip)
- **Extension API**: VS Code Custom Editor (`CustomReadonlyEditorProvider`)

## Limitations

- Arrays are sampled to the first **100 elements** (1D) or **20 rows × 10 columns** (2D)
- HDF5 datasets exceeding 10,000 elements display metadata only
- Pickle support covers protocols 0–5; some custom Python classes may not deserialize
- NumPy structured dtypes and object arrays are not fully supported
- MATLAB v7.3 files (HDF5-based) should be opened as `.h5`; only Level 5 MAT format is natively supported
- Arrow tables preview first 100 rows × 50 columns

## License

MIT
