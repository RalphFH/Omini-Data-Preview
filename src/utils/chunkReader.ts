import { createReadStream } from 'fs';
import { ChunkReadConfig } from '../types';

/**
 * 分块读取配置默认值
 */
const DEFAULT_CONFIG: ChunkReadConfig = {
  chunkSize: 1024 * 1024, // 1MB
  maxMemory: 512 * 1024 * 1024, // 512MB
  sampleSize: 100,
};

/**
 * 分块读取器
 * 用于大文件的分块读取，避免内存溢出
 */
export class ChunkReader {
  private config: ChunkReadConfig;
  private memoryUsage: number = 0;

  constructor(config: Partial<ChunkReadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分块读取文件
   * @param filePath 文件路径
   * @param onChunk 每个分块的回调函数
   * @param onComplete 完成回调
   */
  async readChunks(
    filePath: string,
    onChunk: (chunk: Buffer, chunkIndex: number) => void,
    onComplete?: () => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, {
        highWaterMark: this.config.chunkSize,
      });

      let chunkIndex = 0;

      stream.on('data', (chunk: string | Buffer) => {
        // 检查内存使用
        if (!this.checkMemory()) {
          stream.destroy();
          reject(new Error('Memory limit exceeded'));
          return;
        }

        const buffer = chunk instanceof Buffer ? chunk : Buffer.from(chunk);
        this.memoryUsage += buffer.length;
        onChunk(buffer, chunkIndex++);
      });

      stream.on('end', () => {
        if (onComplete) onComplete();
        resolve();
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 读取文件指定范围的数据
   * @param filePath 文件路径
   * @param start 起始位置
   * @param end 结束位置
   */
  async readRange(filePath: string, start: number, end: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, {
        start,
        end,
        highWaterMark: end - start + 1,
      });

      const chunks: Buffer[] = [];

      stream.on('data', (chunk: string | Buffer) => {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 读取文件头部
   * @param filePath 文件路径
   * @param bytes 要读取的字节数
   */
  async readHeader(filePath: string, bytes: number = 1024): Promise<Buffer> {
    return this.readRange(filePath, 0, bytes - 1);
  }

  /**
   * 采样读取数据
   * @param filePath 文件路径
   * @param sampleSize 采样数量
   * @param elementSize 每个元素的字节大小
   */
  async sampleData(
    filePath: string,
    sampleSize: number,
    elementSize: number
  ): Promise<Buffer> {
    // 读取文件头部获取数据起始位置
    const headerSize = 128; // 假设头部最大 128 字节
    const header = await this.readHeader(filePath, headerSize);

    // 计算采样间隔
    const totalElements = Math.floor((this.getFileSize(filePath) - headerSize) / elementSize);
    const step = Math.max(1, Math.floor(totalElements / sampleSize));

    const sampledData: Buffer[] = [];
    const actualSampleSize = Math.min(sampleSize, totalElements);

    for (let i = 0; i < actualSampleSize; i++) {
      const offset = headerSize + i * step * elementSize;
      const chunk = await this.readRange(filePath, offset, offset + elementSize - 1);
      sampledData.push(chunk);
    }

    return Buffer.concat(sampledData);
  }

  /**
   * 检查内存使用是否在限制内
   */
  private checkMemory(): boolean {
    return this.memoryUsage < this.config.maxMemory;
  }

  /**
   * 获取文件大小
   * @param filePath 文件路径
   */
  private getFileSize(filePath: string): number {
    const fs = require('fs');
    return fs.statSync(filePath).size;
  }

  /**
   * 重置内存使用计数
   */
  resetMemoryUsage(): void {
    this.memoryUsage = 0;
  }

  /**
   * 获取当前内存使用量
   */
  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.resetMemoryUsage();
  }
}

/**
 * 创建分块读取器实例
 */
export function createChunkReader(config?: Partial<ChunkReadConfig>): ChunkReader {
  return new ChunkReader(config);
}