/**
 * Data Viewer Webview Controller
 */
class DataViewer {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    // 监听来自扩展的消息
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  handleMessage(event) {
    const message = event.data;

    switch (message.type) {
      case 'loading':
        this.showLoading();
        break;
      case 'data':
        this.data = message.data;
        this.render();
        break;
      case 'error':
        this.showError(message.error);
        break;
    }
  }

  showLoading() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
      </div>
    `;
  }

  showError(error) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="error">
        <h2>Error</h2>
        <p>${error}</p>
      </div>
    `;
  }

  render() {
    if (!this.data || !this.data.meta) {
      this.showError('No data available');
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Data Viewer - ${this.data.meta.filename}</h1>
        </div>
        <div class="content">
          <div class="meta-panel">
            <h2>File Information</h2>
            ${this.renderMetaPanel()}
          </div>
          <div class="tree-panel">
            <h2>Data Preview</h2>
            ${this.renderTreeNode(this.data.data, true)}
          </div>
        </div>
      </div>
    `;

    // 绑定展开/折叠事件
    this.bindEvents();
  }

  renderMetaPanel() {
    const meta = this.data.meta;
    const items = [];

    items.push(this.renderMetaItem('Filename', meta.filename));
    items.push(this.renderMetaItem('Format', meta.format.toUpperCase()));
    items.push(this.renderMetaItem('File Size', this.formatBytes(meta.fileSize)));
    items.push(this.renderMetaItem('File Type', meta.fileType));

    if (meta.shape && meta.shape.length > 0) {
      items.push(this.renderMetaItem('Shape', `[${meta.shape.join(', ')}]`));
    }

    if (meta.dtype) {
      items.push(this.renderMetaItem('Data Type', meta.dtype));
    }

    if (meta.fortranOrder !== undefined) {
      items.push(this.renderMetaItem('Fortran Order', meta.fortranOrder ? 'True' : 'False'));
    }

    if (meta.keys && meta.keys.length > 0) {
      items.push(this.renderMetaItem('Keys', meta.keys.length));
      items.push(this.renderMetaItem('Key List', meta.keys.join(', ')));
    }

    if (meta.compression) {
      items.push(this.renderMetaItem('Compression', meta.compression));
    }

    items.push(this.renderMetaItem('Last Modified', new Date(meta.lastModified).toLocaleString()));
    items.push(this.renderMetaItem('Preview Size', this.formatBytes(meta.previewSize)));

    return items.join('');
  }

  renderMetaItem(label, value) {
    return `
      <div class="meta-item">
        <span class="meta-label">${label}:</span>
        <span class="meta-value">${value}</span>
      </div>
    `;
  }

  renderTreeNode(node, isRoot = false) {
    const rootClass = isRoot ? 'tree-node-root' : 'tree-node';
    const hasChildren = node.children && node.children.length > 0;

    let html = `
      <div class="${rootClass}">
        <div class="node-header" data-node-id="${node.id}">
          ${hasChildren ? '<span class="node-expand">▶</span>' : '<span class="node-expand"></span>'}
          <span class="node-key">${node.key}</span>
          <span class="node-type">(${node.type})</span>
          ${node.meta ? `<span class="node-meta">[${node.meta.dtype || ''} ${node.meta.shape ? '[' + node.meta.shape.join(', ') + ']' : ''}]</span>` : ''}
          ${!hasChildren ? `<span class="node-value">: ${this.formatValue(node.value)}</span>` : ''}
        </div>
        ${hasChildren ? '<div class="node-children">' + node.children.map(child => this.renderTreeNode(child)).join('') + '</div>' : ''}
      </div>
    `;

    return html;
  }

  formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;

    if (Array.isArray(value)) {
      if (value.length > 10) {
        return `[${value.slice(0, 10).join(', ')}... (${value.length} items)]`;
      }
      return `[${value.join(', ')}]`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length > 5) {
        return `{${keys.slice(0, 5).join(', ')}... (${keys.length} keys)}`;
      }
      return `{${keys.join(', ')}}`;
    }

    return String(value);
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return size.toFixed(2) + ' ' + units[unitIndex];
  }

  bindEvents() {
    const headers = document.querySelectorAll('.node-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        const children = header.nextElementSibling;
        if (children && children.classList.contains('node-children')) {
          const expand = header.querySelector('.node-expand');
          if (children.classList.contains('expanded')) {
            children.classList.remove('expanded');
            expand.textContent = '▶';
          } else {
            children.classList.add('expanded');
            expand.textContent = '▼';
          }
        }
      });
    });
  }
}

// 初始化应用
const viewer = new DataViewer();

// 发送准备就绪消息
const vscode = (window as any).acquireVsCodeApi();
vscode.postMessage({ type: 'ready' });