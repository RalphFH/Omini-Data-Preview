/**
 * 二进制解析工具
 * 用于解析各种二进制数据格式
 */

/**
 * 字节顺序类型
 */
export type ByteOrder = 'little' | 'big';

/**
 * 数据类型
 */
export type DataType =
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'float32'
  | 'float64'
  | 'bool'
  | 'string';

/**
 * 数据类型字节大小映射
 */
const DATA_TYPE_SIZES: Record<DataType, number> = {
  int8: 1,
  int16: 2,
  int32: 4,
  int64: 8,
  uint8: 1,
  uint16: 2,
  uint32: 4,
  uint64: 8,
  float32: 4,
  float64: 8,
  bool: 1,
  string: 1,
};

/**
 * 二进制解析器
 */
export class BinaryParser {
  private buffer: Buffer;
  private offset: number = 0;
  private byteOrder: ByteOrder = 'little';

  constructor(buffer: Buffer, byteOrder: ByteOrder = 'little') {
    this.buffer = buffer;
    this.byteOrder = byteOrder;
  }

  /**
   * 获取当前偏移量
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * 设置偏移量
   */
  setOffset(offset: number): void {
    this.offset = offset;
  }

  /**
   * 跳过指定字节数
   */
  skip(bytes: number): void {
    this.offset += bytes;
  }

  /**
   * 检查是否还有数据可读
   */
  hasMore(bytes: number = 1): boolean {
    return this.offset + bytes <= this.buffer.length;
  }

  /**
   * 读取指定类型的数据
   */
  read(type: DataType, count: number = 1): any {
    const size = DATA_TYPE_SIZES[type];
    const totalSize = size * count;

    if (!this.hasMore(totalSize)) {
      throw new Error(`Not enough data to read ${count} ${type} values`);
    }

    const result: any[] = [];

    for (let i = 0; i < count; i++) {
      const value = this.readValue(type);
      result.push(value);
    }

    return count === 1 ? result[0] : result;
  }

  /**
   * 读取单个值
   */
  private readValue(type: DataType): any {
    switch (type) {
      case 'int8':
        return this.buffer.readInt8(this.offset++);
      case 'int16':
        return this.byteOrder === 'little'
          ? this.buffer.readInt16LE(this.offset)
          : this.buffer.readInt16BE(this.offset);
      case 'int32':
        return this.byteOrder === 'little'
          ? this.buffer.readInt32LE(this.offset)
          : this.buffer.readInt32BE(this.offset);
      case 'int64':
        return this.byteOrder === 'little'
          ? Number(this.buffer.readBigInt64LE(this.offset))
          : Number(this.buffer.readBigInt64BE(this.offset));
      case 'uint8':
        return this.buffer.readUInt8(this.offset++);
      case 'uint16':
        return this.byteOrder === 'little'
          ? this.buffer.readUInt16LE(this.offset)
          : this.buffer.readUInt16BE(this.offset);
      case 'uint32':
        return this.byteOrder === 'little'
          ? this.buffer.readUInt32LE(this.offset)
          : this.buffer.readUInt32BE(this.offset);
      case 'uint64':
        return this.byteOrder === 'little'
          ? Number(this.buffer.readBigUInt64LE(this.offset))
          : Number(this.buffer.readBigUInt64BE(this.offset));
      case 'float32':
        return this.byteOrder === 'little'
          ? this.buffer.readFloatLE(this.offset)
          : this.buffer.readFloatBE(this.offset);
      case 'float64':
        return this.byteOrder === 'little'
          ? this.buffer.readDoubleLE(this.offset)
          : this.buffer.readDoubleBE(this.offset);
      case 'bool':
        return this.buffer.readUInt8(this.offset++) !== 0;
      case 'string':
        return this.readString();
    }

    this.offset += DATA_TYPE_SIZES[type];
    return null;
  }

  /**
   * 读取字符串（以 null 结尾）
   */
  readString(): string {
    const start = this.offset;
    while (this.hasMore() && this.buffer.readUInt8(this.offset) !== 0) {
      this.offset++;
    }
    const str = this.buffer.toString('utf8', start, this.offset);
    this.offset++; // 跳过 null 终止符
    return str;
  }

  /**
   * 读取固定长度字符串
   */
  readFixedString(length: number): string {
    const str = this.buffer.toString('utf8', this.offset, this.offset + length);
    this.offset += length;
    return str.replace(/\0.*$/, '');
  }

  /**
   * 读取字节数组
   */
  readBytes(length: number): Buffer {
    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  /**
   * 解析 NumPy dtype 字符串
   * 例如: '<f8', '>i4', '|S10'
   */
  static parseDtype(dtype: string): {
    byteOrder: ByteOrder | 'native';
    type: DataType;
    size: number;
  } {
    const byteOrderChar = dtype[0];
    const typeChar = dtype[dtype.length - 1];
    const sizeStr = dtype.substring(1, dtype.length - 1);
    const size = parseInt(sizeStr) || 1;

    let byteOrder: ByteOrder | 'native' = 'native';
    if (byteOrderChar === '<') byteOrder = 'little';
    else if (byteOrderChar === '>') byteOrder = 'big';
    else if (byteOrderChar === '|') byteOrder = 'native';

    let type: DataType = 'uint8';
    switch (typeChar) {
      case 'f':
        type = size === 4 ? 'float32' : 'float64';
        break;
      case 'i':
        if (size === 1) type = 'int8';
        else if (size === 2) type = 'int16';
        else if (size === 4) type = 'int32';
        else if (size === 8) type = 'int64';
        break;
      case 'u':
        if (size === 1) type = 'uint8';
        else if (size === 2) type = 'uint16';
        else if (size === 4) type = 'uint32';
        else if (size === 8) type = 'uint64';
        break;
      case 'b':
        type = 'bool';
        break;
      case 'S':
        type = 'string';
        break;
    }

    return { byteOrder, type, size };
  }

  /**
   * 计算数组元素总数
   */
  static calculateArraySize(shape: number[]): number {
    return shape.reduce((acc, dim) => acc * dim, 1);
  }

  /**
   * 采样数组数据
   */
  static sampleArray<T>(arr: T[], maxSize: number = 100): T[] {
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
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
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
   * 重置解析器
   */
  reset(): void {
    this.offset = 0;
  }

  /**
   * 获取剩余字节数
   */
  getRemainingBytes(): number {
    return this.buffer.length - this.offset;
  }
}

/**
 * 创建二进制解析器实例
 */
export function createBinaryParser(
  buffer: Buffer,
  byteOrder?: ByteOrder
): BinaryParser {
  return new BinaryParser(buffer, byteOrder);
}