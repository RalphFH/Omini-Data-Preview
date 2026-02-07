/**
 * BaseProvider 抽象基类
 * 所有文件解析器必须继承此类并实现 parse方法
 */

import * as fs from 'fs';
import * as path from 'path';
import { MetaInfo, TreeNode } from '../types';

/**
 * Npy 文件头接口
 */
export interface NpyHeader {
  dtype: string;
  fortranOrder: boolean;
  shape: number[];
}

/**
 * 解析结果接口
 */
export interface ParseResult {
  meta: any;
  data: any;
  warnings?: string[];
}

/**
 * 解析选项
 */
export interface ParseOptions {
  /**
   * 最大采样大小（数组元素数量）
   */
  maxSampleSize?: number;

  /**
   * 最大内存限制（MB）
   */
  maxMemoryMB?: number;

  /**
   * 是否启用懒加载
   */
  lazyLoad?: boolean;

  /**
   * 是否包含完整数据
   */
  includeFullData?: boolean;
}

export abstract class BaseProvider {
  /**
   * 支持的文件扩展名
   */
  abstract readonly supportedExtensions: string[];

  /**
   * 解析文件并返回元信息和数据树
   * @param filePath 文件路径
   * @param options 解析选项
   */
  abstract parse(filePath: string, options?: ParseOptions): Promise<ParseResult>;

  /**
   * 读取文件内容
   */
  protected async readFile(filePath: string): Promise<Buffer> {
    return await fs.promises.readFile(filePath);
  }

  /**
   * 获取文件名
   */
  protected getFilename(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * 获取最后修改时间
   */
  protected async getLastModified(filePath: string): Promise<Date> {
    const stats = await fs.promises.stat(filePath);
    return stats.mtime;
  }

  /**
   * 计算预览大小
   */
  protected calculatePreviewSize(data: any): number {
    if (Array.isArray(data)) {
      return data.length;
    }
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length;
    }
    return 1;
  }

  /**
   * 检查文件是否支持
   */
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * 获取文件元信息
   */
  protected async getMetaInfo(filePath: string): Promise<MetaInfo> {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();

    return {
      filename: path.basename(filePath),
      format: this.getFormat(ext),
      fileSize: stats.size,
      fileType: ext.substring(1),
      lastModified: stats.mtime,
      previewSize: 0,
    };
  }

  /**
   * 获取格式类型
   */
  protected getFormat(ext: string): 'npy' | 'npz' | 'pkl' | 'hdf5' {
    const formatMap: Record<string, 'npy' | 'npz' | 'pkl' | 'hdf5'> = {
      '.npy': 'npy',
      '.npz': 'npz',
      '.pkl': 'pkl',
      '.pickle': 'pkl',
      '.h5': 'hdf5',
      '.hdf5': 'hdf5',
    };
    return formatMap[ext] || 'npy';
  }

  /**
   * 格式化文件大小
   */
  protected formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 创建树节点
   */
  protected createTreeNode(
    key: string,
    value: any,
    type: 'scalar' | 'array' | 'object' | 'string',
    parentPath: string[] = []
  ): TreeNode {
    const nodePath = [...parentPath, key];

    return {
      id: nodePath.join('.'),
      key,
      value,
      type,
      path: nodePath,
      expanded: false,
    };
  }

  /**
   * 采样数组数据（用于大文件优化）
   */
  protected sampleArray<T>(arr: T[], maxSize: number = 100): T[] {
    if (arr.length <= maxSize) {
      return arr;
    }

    const step = Math.ceil(arr.length / maxSize);
    const sampled: T[] = [];

    for (let i = 0; i < arr.length; i += step) {
      sampled.push(arr[i]);
    }

    return sampled;
  }

  /**
   * 检查内存使用情况
   */
  protected checkMemoryUsage(maxMemoryMB: number = 512): boolean {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return used < maxMemoryMB;
  }
}