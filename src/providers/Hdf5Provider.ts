/**
 * HDF5 文件解析器 (.h5, .hdf5)
 * 使用 jsfive 库（纯 JS）解析 HDF5 格式
 *
 * 大文件策略：jsfive 需要完整 ArrayBuffer 来解析文件结构，
 * 但 Dataset.value 是惰性 getter，访问时才真正解码数据。
 * 对于大数据集（元素数 > 阈值），只读 shape/dtype 不读 value，避免内存溢出。
 */

import { BaseProvider, ParseResult, ParseOptions } from './BaseProvider';

/** 超过此元素数量的数据集不预览数据，只显示 shape/dtype */
const MAX_PREVIEW_ELEMENTS = 10000;

export class Hdf5Provider extends BaseProvider {
  readonly supportedExtensions = ['.h5', '.hdf5'];

  async parse(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    const { maxSampleSize = 100 } = options;

    try {
      const fs = require('fs');
      const nodeBuffer: Buffer = fs.readFileSync(filePath);

      const jsfive = require('jsfive');
      const HDF5File = jsfive.File || jsfive.default?.File;

      // 避免不必要的 ArrayBuffer 拷贝
      let arrayBuffer: ArrayBuffer;
      if (nodeBuffer.byteOffset === 0 && nodeBuffer.byteLength === nodeBuffer.buffer.byteLength) {
        arrayBuffer = nodeBuffer.buffer as ArrayBuffer;
      } else {
        arrayBuffer = nodeBuffer.buffer.slice(
          nodeBuffer.byteOffset,
          nodeBuffer.byteOffset + nodeBuffer.byteLength,
        ) as ArrayBuffer;
      }

      const file = new HDF5File(arrayBuffer);

      const meta = await this.buildMetaInfo(filePath, file, nodeBuffer.length);
      const data = this.buildDataTree(file, [], maxSampleSize);

      return { meta, data };
    } catch (error) {
      throw new Error(
        `Failed to parse HDF5 file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async buildMetaInfo(filePath: string, file: any, fileSize: number): Promise<any> {
    const keys: string[] = [];
    const datasets: any[] = [];
    const groups: string[] = [];

    this.traverse(file, '', keys, datasets, groups);

    return {
      filename: this.getFilename(filePath),
      format: 'hdf5',
      fileSize,
      fileType: 'HDF5 File',
      keys,
      datasets: datasets.length,
      groups: groups.length,
      previewSize: datasets.length,
      lastModified: await this.getLastModified(filePath),
    };
  }

  /**
   * 判断 jsfive 对象是否是 Dataset（不触发 .value getter）
   * Dataset 有 shape/dtype 属性且没有 .keys/.get 方法
   */
  private isDataset(obj: any): boolean {
    return obj && typeof obj.get !== 'function' && obj.shape !== undefined;
  }

  /**
   * 判断 jsfive 对象是否是 Group
   */
  private isGroup(obj: any): boolean {
    return obj && obj.keys && typeof obj.get === 'function';
  }

  private traverse(
    obj: any,
    prefix: string,
    keys: string[],
    datasets: any[],
    groups: string[],
  ) {
    if (this.isGroup(obj)) {
      if (prefix) groups.push(prefix);
      for (const name of obj.keys) {
        const child = obj.get(name);
        const childPath = prefix ? `${prefix}/${name}` : name;
        this.traverse(child, childPath, keys, datasets, groups);
      }
    } else if (this.isDataset(obj)) {
      keys.push(prefix);
      datasets.push({
        path: prefix,
        shape: obj.shape || [],
        dtype: obj.dtype || 'unknown',
      });
    }
  }

  private buildDataTree(obj: any, currentPath: string[], maxSize: number): any {
    if (this.isGroup(obj)) {
      const children: any[] = [];
      for (const name of obj.keys) {
        const child = obj.get(name);
        children.push(this.buildDataTree(child, [...currentPath, name], maxSize));
      }
      return {
        id: currentPath.join('/') || 'root',
        key: currentPath[currentPath.length - 1] || 'root',
        value: null,
        type: 'object',
        children,
        path: currentPath,
      };
    }

    if (this.isDataset(obj)) {
      const shape: number[] = obj.shape || [];
      const totalElements = shape.length > 0 ? shape.reduce((a: number, b: number) => a * b, 1) : 0;

      let value: any = null;
      let tooLarge = false;

      if (totalElements <= MAX_PREVIEW_ELEMENTS) {
        // 小数据集：读 value
        try {
          value = obj.value;
          if (Array.isArray(value)) {
            value = this.sampleArray(value, maxSize);
          } else if (ArrayBuffer.isView(value)) {
            value = Array.from((value as any).slice(0, maxSize));
          }
        } catch {
          value = null;
          tooLarge = true;
        }
      } else {
        tooLarge = true;
      }

      return {
        id: currentPath.join('/') || 'root',
        key: currentPath[currentPath.length - 1] || 'root',
        value,
        type: 'array',
        meta: {
          dtype: obj.dtype || 'unknown',
          shape,
          size: totalElements,
          tooLarge,
        },
        path: currentPath,
      };
    }

    return {
      id: currentPath.join('/') || 'root',
      key: currentPath[currentPath.length - 1] || 'root',
      value: obj,
      type: 'scalar',
      path: currentPath,
    };
  }
}
