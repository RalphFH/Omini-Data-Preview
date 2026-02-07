import * as vscode from 'vscode';
import * as path from 'path';
import { NpyProvider } from './providers/NpyProvider';
import { NpzProvider } from './providers/NpzProvider';
import { PklProvider } from './providers/PklProvider';
import { Hdf5Provider } from './providers/Hdf5Provider';

const providers = {
  npy: new NpyProvider(),
  npz: new NpzProvider(),
  pkl: new PklProvider(),
  hdf5: new Hdf5Provider(),
};

function getProviderForExt(ext: string) {
  if (ext === '.npy') return providers.npy;
  if (ext === '.npz') return providers.npz;
  if (ext === '.pkl' || ext === '.pickle') return providers.pkl;
  if (ext === '.h5' || ext === '.hdf5') return providers.hdf5;
  return null;
}

/**
 * Custom readonly editor provider — 让 VS Code 用 Data Viewer 打开二进制数据文件
 */
class DataViewerEditorProvider implements vscode.CustomReadonlyEditorProvider {
  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = getLoadingHtml();

    const ext = path.extname(document.uri.fsPath).toLowerCase();
    const provider = getProviderForExt(ext);

    if (!provider) {
      webviewPanel.webview.html = getErrorHtml(`Unsupported format: ${ext}`);
      return;
    }

    try {
      const result = await provider.parse(document.uri.fsPath);
      webviewPanel.webview.html = getWebviewContent(result);
    } catch (error) {
      webviewPanel.webview.html = getErrorHtml(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Data Viewer extension is now active!');

  // 注册 custom editor（核心：让 VS Code 自动用本扩展打开二进制数据文件）
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'dataViewer.binaryEditor',
      new DataViewerEditorProvider(),
      { supportsMultipleEditorsPerDocument: false },
    ),
  );

  // 保留命令，方便从命令面板手动打开
  context.subscriptions.push(
    vscode.commands.registerCommand('dataViewer.open', async (uri?: vscode.Uri) => {
      const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) {
        vscode.window.showErrorMessage('No file selected');
        return;
      }
      await openDataViewerPanel(fileUri);
    }),
  );
}

/**
 * 通过命令手动打开（不走 custom editor 的场景）
 */
async function openDataViewerPanel(uri: vscode.Uri): Promise<void> {
  const ext = path.extname(uri.fsPath).toLowerCase();
  const provider = getProviderForExt(ext);

  if (!provider) {
    vscode.window.showErrorMessage(`Unsupported file format: ${ext}`);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'dataViewer',
    `Data Viewer - ${path.basename(uri.fsPath)}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  panel.webview.html = getLoadingHtml();

  try {
    const result = await provider.parse(uri.fsPath);
    panel.webview.html = getWebviewContent(result);
  } catch (error) {
    panel.webview.html = getErrorHtml(
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ── HTML helpers ──────────────────────────────────────────────

function getLoadingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Loading...</title>
  <style>
    body { font-family: var(--vscode-font-family); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .spinner { border: 3px solid var(--vscode-editor-foreground); border-top: 3px solid transparent; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body><div class="spinner"></div></body>
</html>`;
}

function getErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .error { color: var(--vscode-errorForeground); border: 1px solid var(--vscode-errorBorder); padding: 15px; border-radius: 4px; }
  </style>
</head>
<body><div class="error"><h2>Error</h2><p>${message}</p></div></body>
</html>`;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function escapeHtml(text: string): string {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getCommonStyles(): string {
  return `
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      margin: 0; padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-size: 13px;
    }
    .layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .sidebar {
      width: 240px;
      min-width: 200px;
      border-right: 1px solid var(--vscode-panel-border, #333);
      overflow-y: auto;
      padding: 16px;
      flex-shrink: 0;
    }
    .main {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-editor-background);
    }
    .header-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
    }
    .meta-key {
      color: var(--vscode-descriptionForeground);
    }
    .meta-val {
      font-weight: 500;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .badge-dtype {
      background: rgba(79, 139, 255, 0.15);
      color: #6ab0f3;
    }
    .badge-shape {
      background: rgba(152, 195, 121, 0.15);
      color: #98c379;
    }
    .badge-count {
      background: rgba(209, 154, 102, 0.15);
      color: #d19a66;
    }

    /* Data table */
    .data-table-wrap {
      overflow-x: auto;
      margin-top: 12px;
    }
    .data-table {
      border-collapse: collapse;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      width: auto;
    }
    .data-table th {
      position: sticky;
      top: 0;
      background: var(--vscode-editor-background);
      border-bottom: 2px solid var(--vscode-panel-border, #555);
      padding: 4px 10px;
      text-align: right;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .data-table td {
      padding: 3px 10px;
      text-align: right;
      border-bottom: 1px solid var(--vscode-panel-border, #222);
      white-space: nowrap;
    }
    .data-table tr:nth-child(even) td {
      background: rgba(255,255,255,0.02);
    }
    .data-table tr:hover td {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    }
    .data-table .row-idx {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      border-right: 1px solid var(--vscode-panel-border, #333);
      padding-right: 8px;
      user-select: none;
    }
    .data-table td[title] { cursor: default; }
    .truncation-note {
      margin-top: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    /* Tree */
    .tree-item {
      padding: 2px 0;
    }
    .tree-toggle {
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .tree-toggle:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    }
    .tree-arrow {
      display: inline-block;
      width: 12px;
      text-align: center;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      transition: transform 0.15s;
    }
    .tree-arrow.expanded { transform: rotate(90deg); }
    .tree-children {
      margin-left: 16px;
      border-left: 1px solid var(--vscode-panel-border, #333);
      padding-left: 8px;
    }
    .tree-children.collapsed { display: none; }
    .tree-key { color: #6ab0f3; font-weight: 600; }
    .tree-str { color: #98c379; }
    .tree-num { color: #d19a66; }
    .tree-bool { color: #c678dd; }
    .tree-null { color: #636d83; font-style: italic; }
    .tree-icon { margin-right: 4px; }

    /* NPZ key list */
    .key-list-item {
      padding: 5px 8px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .key-list-item:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    }
    .key-list-item.active {
      background: var(--vscode-list-activeSelectionBackground, rgba(79,139,255,0.2));
      color: var(--vscode-list-activeSelectionForeground, #fff);
    }

    /* HDF5 structure tree */
    .hdf-tree-item {
      padding: 3px 4px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .hdf-tree-item:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    }
    .hdf-tree-item.active {
      background: var(--vscode-list-activeSelectionBackground, rgba(79,139,255,0.2));
    }
    .hdf-children {
      margin-left: 16px;
    }
    .hdf-children.collapsed { display: none; }
    .detail-panel h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
    }
    .detail-badges {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
  `;
}

function getCommonScripts(): string {
  return `
    function toggleTree(id) {
      var children = document.getElementById('children-' + id);
      var arrow = document.getElementById('arrow-' + id);
      if (!children) return;
      children.classList.toggle('collapsed');
      if (arrow) arrow.classList.toggle('expanded');
    }
  `;
}

// ── Format-specific renderers ──────────────────────────────────

function renderDataTable(data: any, shape?: number[], maxRows: number = 20, maxCols: number = 10): string {
  if (!data) return '<p style="color:var(--vscode-descriptionForeground)">No data available</p>';

  // Determine if 2D (array of arrays)
  const is2D = Array.isArray(data) && data.length > 0 && Array.isArray(data[0]);

  if (is2D) {
    const rows = data as any[][];
    const totalRows = shape ? shape[0] : rows.length;
    const totalCols = shape && shape.length > 1 ? shape[1] : (rows[0]?.length || 0);
    const displayRows = rows.slice(0, maxRows);
    const displayCols = Math.min(totalCols, maxCols);

    let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr><th></th>';
    for (let c = 0; c < displayCols; c++) {
      html += `<th>${c}</th>`;
    }
    if (displayCols < totalCols) html += '<th>...</th>';
    html += '</tr></thead><tbody>';

    for (let r = 0; r < displayRows.length; r++) {
      html += `<tr><td class="row-idx">${r}</td>`;
      const row = displayRows[r];
      for (let c = 0; c < displayCols; c++) {
        const v = row[c];
        const full = typeof v === 'number' ? String(v) : escapeHtml(String(v));
        const display = typeof v === 'number' ? formatNum(v) : escapeHtml(String(v));
        html += `<td title="${full}">${display}</td>`;
      }
      if (displayCols < totalCols) html += '<td>...</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    if (displayRows.length < totalRows || displayCols < totalCols) {
      html += `<div class="truncation-note">Showing ${displayRows.length} of ${totalRows} rows, ${displayCols} of ${totalCols} columns</div>`;
    }
    return html;
  }

  // 1D array
  if (Array.isArray(data)) {
    const totalElements = shape ? shape.reduce((a: number, b: number) => a * b, 1) : data.length;
    const displayData = data.slice(0, maxRows);

    let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Value</th></tr></thead><tbody>';
    for (let i = 0; i < displayData.length; i++) {
      const v = displayData[i];
      const full = typeof v === 'number' ? String(v) : escapeHtml(String(v));
      const display = typeof v === 'number' ? formatNum(v) : escapeHtml(String(v));
      html += `<tr><td class="row-idx">${i}</td><td title="${full}">${display}</td></tr>`;
    }
    html += '</tbody></table></div>';

    if (displayData.length < totalElements) {
      html += `<div class="truncation-note">Showing first ${displayData.length} of ${totalElements} elements</div>`;
    }
    return html;
  }

  return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

/**
 * 将 NumPy dtype 编码转换为可读名称
 * 例如 '<f8' → 'float64', '<i4' → 'int32'
 */
function friendlyDtype(raw: string): string {
  const map: Record<string, string> = {
    // float
    '<f2': 'float16', '>f2': 'float16', 'f2': 'float16',
    '<f4': 'float32', '>f4': 'float32', 'f4': 'float32',
    '<f8': 'float64', '>f8': 'float64', 'f8': 'float64',
    // int
    '<i1': 'int8',   '>i1': 'int8',   'i1': 'int8',
    '<i2': 'int16',  '>i2': 'int16',  'i2': 'int16',
    '<i4': 'int32',  '>i4': 'int32',  'i4': 'int32',
    '<i8': 'int64',  '>i8': 'int64',  'i8': 'int64',
    // unsigned int
    '<u1': 'uint8',  '>u1': 'uint8',  'u1': 'uint8',
    '<u2': 'uint16', '>u2': 'uint16', 'u2': 'uint16',
    '<u4': 'uint32', '>u4': 'uint32', 'u4': 'uint32',
    '<u8': 'uint64', '>u8': 'uint64', 'u8': 'uint64',
    // bool
    '|b1': 'bool', 'b1': 'bool',
    // string / bytes
    '|S1': 'bytes', 'S1': 'bytes',
  };
  // 精确匹配
  if (map[raw]) return map[raw];
  // 带长度的字符串，如 |S10 → bytes[10]
  const strMatch = raw.match(/^\|?S(\d+)$/);
  if (strMatch) return `bytes[${strMatch[1]}]`;
  // Unicode，如 <U10 → str[10]
  const uniMatch = raw.match(/^[<>|]?U(\d+)$/);
  if (uniMatch) return `str[${uniMatch[1]}]`;
  return raw;
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) < 0.001 || Math.abs(v) > 1e6) return v.toExponential(4);
  return v.toPrecision(6);
}

function renderNpyView(data: any): string {
  const m = data.meta;
  const totalElements = m.shape ? m.shape.reduce((a: number, b: number) => a * b, 1) : 0;

  const sidebar = `
    <div class="sidebar">
      <div class="section-title">Overview</div>
      <div class="meta-row"><span class="meta-key">Format</span><span class="badge badge-dtype">NPY</span></div>
      <div class="meta-row"><span class="meta-key">Shape</span><span class="badge badge-shape">${m.shape ? m.shape.join(' × ') : '?'}</span></div>
      <div class="meta-row"><span class="meta-key">Dtype</span><span class="badge badge-dtype">${friendlyDtype(m.dtype || '?')}</span></div>
      <div class="meta-row"><span class="meta-key">Elements</span><span class="meta-val">${totalElements.toLocaleString()}</span></div>
      <div class="meta-row"><span class="meta-key">Size</span><span class="meta-val">${formatBytes(m.fileSize)}</span></div>
      ${m.fortranOrder ? '<div class="meta-row"><span class="meta-key">Order</span><span class="meta-val">Fortran</span></div>' : ''}
    </div>`;

  const mainContent = `
    <div class="main">
      <h3 style="margin:0 0 4px 0">Data Preview</h3>
      ${renderDataTable(data.data.value, m.shape)}
    </div>`;

  return wrapHtml(m.filename, `NPY · ${formatBytes(m.fileSize)}`, sidebar + mainContent);
}

function renderNpzView(data: any): string {
  const m = data.meta;
  const children = data.data.children || [];

  // Build key list for sidebar
  let keyListHtml = '';
  children.forEach((child: any, idx: number) => {
    const shapeBadge = child.meta?.shape ? ` <span class="badge badge-shape">${child.meta.shape.join('×')}</span>` : '';
    keyListHtml += `<div class="key-list-item${idx === 0 ? ' active' : ''}" data-key="${idx}" onclick="selectNpzKey(${idx})">
      <span>📦</span><span>${escapeHtml(child.key)}</span>${shapeBadge}
    </div>`;
  });

  const sidebar = `
    <div class="sidebar">
      <div class="section-title">Overview</div>
      <div class="meta-row"><span class="meta-key">Format</span><span class="badge badge-dtype">NPZ</span></div>
      <div class="meta-row"><span class="meta-key">Arrays</span><span class="meta-val">${children.length}</span></div>
      <div class="meta-row"><span class="meta-key">Size</span><span class="meta-val">${formatBytes(m.fileSize)}</span></div>
      <div style="margin-top:16px">
        <div class="section-title">Arrays</div>
        ${keyListHtml}
      </div>
    </div>`;

  // Build content panels for each array
  let panelsHtml = '';
  children.forEach((child: any, idx: number) => {
    const shape = child.meta?.shape || [];
    const dtype = child.meta?.dtype || '?';
    const totalElements = shape.reduce((a: number, b: number) => a * b, 1);
    panelsHtml += `<div id="npz-panel-${idx}" class="npz-panel" style="${idx !== 0 ? 'display:none' : ''}">
      <h3 style="margin:0 0 8px 0">${escapeHtml(child.key)}</h3>
      <div class="detail-badges">
        <span class="badge badge-shape">${shape.join(' × ') || '?'}</span>
        <span class="badge badge-dtype">${friendlyDtype(dtype)}</span>
        <span class="badge badge-count">${totalElements.toLocaleString()} elements</span>
      </div>
      ${renderDataTable(child.value, shape)}
    </div>`;
  });

  const mainContent = `<div class="main">${panelsHtml}</div>`;

  const extraScript = `
    function selectNpzKey(idx) {
      document.querySelectorAll('.key-list-item').forEach(function(el) { el.classList.remove('active'); });
      document.querySelectorAll('.npz-panel').forEach(function(el) { el.style.display = 'none'; });
      document.querySelector('.key-list-item[data-key="'+idx+'"]').classList.add('active');
      document.getElementById('npz-panel-'+idx).style.display = 'block';
    }
  `;

  return wrapHtml(m.filename, `NPZ · ${formatBytes(m.fileSize)}`, sidebar + mainContent, extraScript);
}

function renderPklView(data: any): string {
  const m = data.meta;

  const sidebar = `
    <div class="sidebar">
      <div class="section-title">Overview</div>
      <div class="meta-row"><span class="meta-key">Format</span><span class="badge badge-dtype">PKL</span></div>
      <div class="meta-row"><span class="meta-key">Size</span><span class="meta-val">${formatBytes(m.fileSize)}</span></div>
      <div class="meta-row"><span class="meta-key">Type</span><span class="meta-val">${data.data.type}</span></div>
      ${data.data.children ? `<div class="meta-row"><span class="meta-key">Keys</span><span class="meta-val">${data.data.children.length}</span></div>` : ''}
    </div>`;

  const mainContent = `
    <div class="main">
      <h3 style="margin:0 0 12px 0">Data Structure</h3>
      ${renderPklTree(data.data, true)}
    </div>`;

  return wrapHtml(m.filename, `PKL · ${formatBytes(m.fileSize)}`, sidebar + mainContent);
}

let pklNodeCounter = 0;
function renderPklTree(node: any, isRoot: boolean = false): string {
  const nodeId = pklNodeCounter++;

  if (node.children && node.children.length > 0) {
    const isObj = node.type === 'object';
    const countLabel = isObj
      ? `<span class="badge badge-count">{${node.children.length} keys}</span>`
      : `<span class="badge badge-count">[${node.meta?.size || node.children.length} items]</span>`;

    const childrenHtml = node.children.map((child: any) => renderPklTree(child)).join('');
    const icon = isObj ? '📋' : '📦';

    return `<div class="tree-item">
      <div class="tree-toggle" onclick="toggleTree('pkl${nodeId}')">
        <span class="tree-arrow${isRoot ? ' expanded' : ''}" id="arrow-pkl${nodeId}">▶</span>
        <span class="tree-icon">${icon}</span>
        <span class="tree-key">${escapeHtml(node.key)}</span>
        ${countLabel}
      </div>
      <div class="tree-children${isRoot ? '' : ' collapsed'}" id="children-pkl${nodeId}">
        ${childrenHtml}
      </div>
    </div>`;
  }

  // Leaf node
  let valueHtml: string;
  if (node.type === 'string') {
    const s = String(node.value);
    const display = s.length > 80 ? s.slice(0, 80) + '...' : s;
    valueHtml = `<span class="tree-str">"${escapeHtml(display)}"</span>`;
  } else if (typeof node.value === 'number') {
    valueHtml = `<span class="tree-num">${node.value}</span>`;
  } else if (typeof node.value === 'boolean') {
    valueHtml = `<span class="tree-bool">${node.value}</span>`;
  } else if (node.value === null || node.value === undefined) {
    valueHtml = `<span class="tree-null">null</span>`;
  } else if (Array.isArray(node.value)) {
    const preview = node.value.slice(0, 5).join(', ');
    valueHtml = `<span class="tree-num">[${preview}${node.value.length > 5 ? ', ...' : ''}]</span>`;
  } else {
    valueHtml = `<span>${escapeHtml(String(node.value))}</span>`;
  }

  return `<div class="tree-item" style="padding-left:20px">
    <span class="tree-key">${escapeHtml(node.key)}</span>: ${valueHtml}
  </div>`;
}

function renderHdf5View(data: any): string {
  const m = data.meta;
  hdf5NodeCounter = 0;

  const sidebarTree = renderHdf5SidebarTree(data.data, true);

  const sidebar = `
    <div class="sidebar">
      <div class="section-title">Overview</div>
      <div class="meta-row"><span class="meta-key">Format</span><span class="badge badge-dtype">HDF5</span></div>
      <div class="meta-row"><span class="meta-key">Datasets</span><span class="meta-val">${m.datasets || 0}</span></div>
      <div class="meta-row"><span class="meta-key">Groups</span><span class="meta-val">${m.groups || 0}</span></div>
      <div class="meta-row"><span class="meta-key">Size</span><span class="meta-val">${formatBytes(m.fileSize)}</span></div>
      <div style="margin-top:16px">
        <div class="section-title">Structure</div>
        ${sidebarTree}
      </div>
    </div>`;

  // Collect all datasets for detail panels
  const datasets: any[] = [];
  collectDatasets(data.data, datasets);

  let panelsHtml = '';
  if (datasets.length === 0) {
    panelsHtml = '<p style="color:var(--vscode-descriptionForeground)">No datasets found in this file.</p>';
  } else {
    datasets.forEach((ds, idx) => {
      const shape = ds.meta?.shape || [];
      const dtype = ds.meta?.dtype || '?';
      const totalElements = shape.reduce((a: number, b: number) => a * b, 1);
      const dsPath = ds.path ? ds.path.join('/') : ds.key;
      panelsHtml += `<div id="hdf-detail-${idx}" class="hdf-detail" style="${idx !== 0 ? 'display:none' : ''}">
        <h3 style="margin:0 0 8px 0">📄 ${escapeHtml(dsPath)}</h3>
        <div class="detail-badges">
          <span class="badge badge-shape">${shape.join(' × ') || 'scalar'}</span>
          <span class="badge badge-dtype">${friendlyDtype(dtype)}</span>
          <span class="badge badge-count">${totalElements.toLocaleString()} elements</span>
        </div>
        ${ds.meta?.tooLarge
          ? `<div class="truncation-note" style="margin-top:12px;padding:12px;border:1px dashed var(--vscode-panel-border,#555);border-radius:4px;">
              Dataset too large to preview (${totalElements.toLocaleString()} elements). Only structure and metadata are shown.
            </div>`
          : renderDataTable(ds.value, shape)}
      </div>`;
    });
  }

  const mainContent = `<div class="main">${panelsHtml}</div>`;

  const extraScript = `
    function selectHdfDataset(idx) {
      document.querySelectorAll('.hdf-tree-item').forEach(function(el) { el.classList.remove('active'); });
      document.querySelectorAll('.hdf-detail').forEach(function(el) { el.style.display = 'none'; });
      var item = document.querySelector('.hdf-tree-item[data-ds-idx="'+idx+'"]');
      if (item) item.classList.add('active');
      var panel = document.getElementById('hdf-detail-'+idx);
      if (panel) panel.style.display = 'block';
    }
    function toggleHdfGroup(id) {
      var children = document.getElementById('hdf-children-' + id);
      var arrow = document.getElementById('hdf-arrow-' + id);
      if (!children) return;
      children.classList.toggle('collapsed');
      if (arrow) arrow.classList.toggle('expanded');
    }
  `;

  return wrapHtml(m.filename, `HDF5 · ${formatBytes(m.fileSize)}`, sidebar + mainContent, extraScript);
}

let hdf5NodeCounter = 0;
let hdf5DatasetIndex = 0;

function collectDatasets(node: any, result: any[]): void {
  if (node.type === 'array' || node.type === 'scalar') {
    result.push(node);
  }
  if (node.children) {
    node.children.forEach((child: any) => collectDatasets(child, result));
  }
}

function renderHdf5SidebarTree(node: any, isRoot: boolean = false): string {
  if (isRoot) {
    hdf5DatasetIndex = 0;
  }
  const nodeId = hdf5NodeCounter++;

  if (node.children && node.children.length > 0) {
    // Group
    const childrenHtml = node.children.map((child: any) => renderHdf5SidebarTree(child)).join('');
    if (isRoot) {
      return childrenHtml; // Don't wrap root
    }
    return `<div>
      <div class="hdf-tree-item" onclick="toggleHdfGroup(${nodeId})" style="cursor:pointer">
        <span class="tree-arrow expanded" id="hdf-arrow-${nodeId}">▶</span>
        <span>📁</span>
        <span>${escapeHtml(node.key)}</span>
      </div>
      <div class="hdf-children" id="hdf-children-${nodeId}">
        ${childrenHtml}
      </div>
    </div>`;
  }

  // Dataset leaf
  const dsIdx = hdf5DatasetIndex++;
  const shapeBadge = node.meta?.shape ? ` <span class="badge badge-shape" style="font-size:10px">${node.meta.shape.join('×')}</span>` : '';
  return `<div class="hdf-tree-item${dsIdx === 0 ? ' active' : ''}" data-ds-idx="${dsIdx}" onclick="selectHdfDataset(${dsIdx})">
    <span style="width:12px;display:inline-block"></span>
    <span>📄</span>
    <span>${escapeHtml(node.key)}</span>${shapeBadge}
  </div>`;
}

function wrapHtml(filename: string, subtitle: string, body: string, extraScript: string = ''): string {
  // Reset pkl counter each render
  pklNodeCounter = 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(filename)}</title>
  <style>${getCommonStyles()}</style>
</head>
<body>
  <div class="header">
    <div class="header-title">📊 ${escapeHtml(filename)}</div>
    <div class="header-meta">${escapeHtml(subtitle)}</div>
  </div>
  <div class="layout">
    ${body}
  </div>
  <script>
    ${getCommonScripts()}
    ${extraScript}
  </script>
</body>
</html>`;
}

function getWebviewContent(data: any): string {
  const format = data.meta.format;
  switch (format) {
    case 'npy': return renderNpyView(data);
    case 'npz': return renderNpzView(data);
    case 'pkl': return renderPklView(data);
    case 'hdf5': return renderHdf5View(data);
    default: return renderNpyView(data); // fallback
  }
}

export function deactivate() {
  console.log('Data Viewer extension deactivated');
}
