/**
 * MATLAB .mat 文件解析器 (Level 5 MAT-file)
 * 使用 mat-for-js 库（纯 JS）解析 MATLAB v5 格式
 *
 * 注意：MATLAB v7.3 (.mat) 实际为 HDF5 格式，应由 Hdf5Provider 处理。
 * mat-for-js 会抛出 FeatureError 以提示。
 */

import { BaseProvider, ParseResult, ParseOptions } from './BaseProvider';

const MAX_SAMPLE = 100;

export class MatProvider extends BaseProvider {
  readonly supportedExtensions = ['.mat'];

  async parse(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    const { maxSampleSize = MAX_SAMPLE } = options;

    try {
      const buffer = await this.readFile(filePath);

      // mat-for-js 需要 ArrayBuffer
      let arrayBuffer: ArrayBuffer;
      if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
        arrayBuffer = buffer.buffer as ArrayBuffer;
      } else {
        arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer;
      }

      const { read } = require('mat-for-js');
      const result = read(arrayBuffer);
      const vars = result.data; // { varName: value, ... }
      const varNames = Object.keys(vars);

      const children = varNames.map((name) => {
        return this.buildVarNode(name, vars[name], [name], maxSampleSize);
      });

      return {
        meta: {
          filename: this.getFilename(filePath),
          format: 'mat',
          fileSize: buffer.length,
          fileType: 'MATLAB MAT-file',
          variables: varNames,
          lastModified: await this.getLastModified(filePath),
          previewSize: varNames.length,
        },
        data: {
          id: 'root',
          key: 'root',
          value: null,
          type: 'object',
          children,
          path: [],
        },
      };
    } catch (error: any) {
      // mat-for-js 对 v7.3 文件抛出 FeatureError
      if (error?.name === 'FeatureError') {
        throw new Error(
          'This .mat file uses MATLAB v7.3 (HDF5) format. Try renaming it to .h5 to open with the HDF5 viewer.',
        );
      }
      throw new Error(
        `Failed to parse MAT file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildVarNode(
    key: string,
    value: any,
    currentPath: string[],
    maxSample: number,
  ): any {
    // 字符串
    if (typeof value === 'string') {
      return {
        id: currentPath.join('.'),
        key,
        value,
        type: 'string',
        path: currentPath,
      };
    }

    // 数值标量
    if (typeof value === 'number' || typeof value === 'bigint') {
      return {
        id: currentPath.join('.'),
        key,
        value: typeof value === 'bigint' ? Number(value) : value,
        type: 'scalar',
        path: currentPath,
      };
    }

    // 数组（一维或多维扁平）
    if (Array.isArray(value)) {
      // 检查是否为嵌套数组（2D）
      const is2D = value.length > 0 && Array.isArray(value[0]);

      if (is2D) {
        const rows = value.length;
        const cols = Array.isArray(value[0]) ? value[0].length : 0;
        const sampled = value.slice(0, maxSample);
        return {
          id: currentPath.join('.'),
          key,
          value: sampled,
          type: 'array',
          meta: {
            shape: [rows, cols],
            size: rows * cols,
            dtype: this.inferDtype(value[0]?.[0]),
          },
          path: currentPath,
        };
      }

      // 1D 数组
      const sampled = value.length > maxSample ? value.slice(0, maxSample) : value;
      return {
        id: currentPath.join('.'),
        key,
        value: sampled,
        type: 'array',
        meta: {
          shape: [value.length],
          size: value.length,
          dtype: this.inferDtype(value[0]),
        },
        path: currentPath,
      };
    }

    // 对象（struct）
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      const children = keys.map((k) =>
        this.buildVarNode(k, value[k], [...currentPath, k], maxSample),
      );
      return {
        id: currentPath.join('.'),
        key,
        value: null,
        type: 'object',
        children,
        path: currentPath,
      };
    }

    // 其他
    return {
      id: currentPath.join('.'),
      key,
      value: value != null ? String(value) : null,
      type: 'scalar',
      path: currentPath,
    };
  }

  private inferDtype(sample: any): string {
    if (sample === undefined || sample === null) return 'unknown';
    if (typeof sample === 'number') {
      return Number.isInteger(sample) ? 'int32' : 'float64';
    }
    if (typeof sample === 'bigint') return 'int64';
    if (typeof sample === 'string') return 'char';
    if (typeof sample === 'boolean') return 'logical';
    if (typeof sample === 'object' && sample.r !== undefined) return 'complex';
    return 'unknown';
  }
}
