# Changelog

## 0.0.3 (2025-02-07)

### Added

- **Apache Arrow / Feather** support (`.arrow`, `.feather`) — columnar table preview with schema, column types, and data sampling
- **MATLAB** support (`.mat`) — variable browser with clickable list, shape/dtype badges, data tables for arrays, tree view for structs

### Dependencies

- Added `apache-arrow` for Arrow/Feather parsing
- Added `mat-for-js` for MATLAB Level 5 MAT-file parsing

## 0.0.2 (2025-02-06)

### Changed

- Redesigned extension icon with polished dark-themed data viewer graphic (256x256)

## 0.0.1 (2025-02-06)

Initial release.

### Features

- **Supported formats**: `.npy`, `.npz`, `.pkl` / `.pickle`, `.h5` / `.hdf5`
- **Custom editor**: Opens binary data files directly in VS Code / Cursor — no more "binary file" errors
- **Format-specific views**:
  - **NPY**: Overview sidebar + data table with row indices
  - **NPZ**: Clickable array list + per-array data table
  - **Pickle**: Interactive collapsible tree with color-coded types
  - **HDF5**: Hierarchical structure browser + dataset detail panels
- **Large file support**: HDF5 files up to 500 MB+; large datasets (>10k elements) show metadata only to avoid memory issues
- **Smart display**: Human-readable dtype names (`float64` instead of `<f8`), shape badges, element counts
- **Sampling**: Arrays automatically sampled to first 100 elements; 2D arrays show up to 20 rows × 10 columns
