import { BaseProvider, ParseOptions, ParseResult } from './BaseProvider';
import { TreeNode } from '../types';

/**
 * Pickle 文件解析器 (.pkl, .pickle)
 */
export class PklProvider extends BaseProvider {
  readonly supportedExtensions = ['.pkl', '.pickle'];

  async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
    const buffer = await this.readFile(filePath);

    // pickleparser 导出的是 { Parser } 命名导出
    const { Parser } = require('pickleparser');
    const parser = new Parser();
    const data = parser.parse(buffer);

    const tree = this.convertToTree(data, 'root', [], options);

    return {
      meta: {
        filename: this.getFilename(filePath),
        format: 'pkl',
        fileSize: buffer.length,
        fileType: 'Python Pickle',
        lastModified: await this.getLastModified(filePath),
        previewSize: this.calculatePreviewSize(data),
      },
      data: tree,
    };
  }

  private convertToTree(data: any, key: string, path: string[], options?: ParseOptions): TreeNode {
    const nodePath = [...path, key];

    if (data === null || data === undefined) {
      return this.createTreeNode(key, data ?? null, 'scalar', path);
    }

    if (typeof data === 'string') {
      return this.createTreeNode(key, data, 'string', path);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return this.createTreeNode(key, data, 'scalar', path);
    }

    if (Array.isArray(data)) {
      const sampleSize = options?.maxSampleSize || 100;
      const sampled = this.sampleArray(data, sampleSize);
      const children = sampled.map((item, index) =>
        this.convertToTree(item, `[${index}]`, nodePath, options),
      );

      return {
        id: nodePath.join('.'),
        key,
        value: sampled,
        type: 'array',
        children,
        path: nodePath,
        expanded: false,
        meta: { size: data.length, dtype: typeof data[0] },
      };
    }

    if (typeof data === 'object') {
      const children: TreeNode[] = [];
      for (const [k, v] of Object.entries(data)) {
        children.push(this.convertToTree(v, k, nodePath, options));
      }

      return {
        id: nodePath.join('.'),
        key,
        value: data,
        type: 'object',
        children,
        path: nodePath,
        expanded: false,
      };
    }

    return this.createTreeNode(key, data, 'scalar', path);
  }
}
