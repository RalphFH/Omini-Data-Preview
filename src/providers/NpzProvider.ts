import { BaseProvider, ParseOptions } from './BaseProvider';
import { ParseResult } from '../types';

/**
 * NumPy .npz 文件解析器（ZIP 压缩的 .npy 集合）
 */
export class NpzProvider extends BaseProvider {
  readonly supportedExtensions = ['.npz'];

  async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
    const buffer = await this.readFile(filePath);

    // jszip 的默认导出在 CJS 打包后可能挂在 .default 上
    const JSZipModule = require('jszip');
    const JSZip = JSZipModule.default || JSZipModule;
    const zip = await JSZip.loadAsync(buffer);

    const keys: string[] = [];
    const children: any[] = [];

    for (const filename of Object.keys(zip.files)) {
      const file = zip.files[filename];
      if (file.dir || !filename.endsWith('.npy')) continue;

      const arrayName = filename.replace(/\.npy$/, '');
      keys.push(arrayName);

      const npyBuffer = Buffer.from(await file.async('uint8array'));
      const arrayData = this.parseNpyBuffer(npyBuffer);

      children.push({
        id: arrayName,
        key: arrayName,
        value: arrayData.data,
        type: 'array',
        meta: {
          dtype: arrayData.dtype,
          shape: arrayData.shape,
          size: arrayData.size,
        },
        path: [arrayName],
      });
    }

    return {
      meta: {
        filename: this.getFilename(filePath),
        format: 'npz',
        fileSize: buffer.length,
        fileType: 'NumPy Archive',
        keys,
        compression: 'ZIP',
        lastModified: await this.getLastModified(filePath),
        previewSize: keys.length,
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
  }

  /**
   * 解析单个 .npy buffer（内嵌在 .npz 里的）
   */
  private parseNpyBuffer(buffer: Buffer): {
    dtype: string;
    shape: number[];
    size: number;
    data: any[];
  } {
    // 用 latin1，\x93 > 127
    const magic = buffer.toString('latin1', 0, 6);
    if (magic !== '\x93NUMPY') {
      throw new Error('Invalid .npy file inside .npz');
    }

    const majorVersion = buffer.readUInt8(6);
    const headerStart = majorVersion === 1 ? 10 : 12;
    const headerLength =
      majorVersion === 1 ? buffer.readUInt16LE(8) : buffer.readUInt32LE(8);
    const dataStart = headerStart + headerLength;

    const headerStr = buffer.toString('latin1', headerStart, headerStart + headerLength);

    const dtypeMatch = headerStr.match(/'descr'\s*:\s*'(.*?)'/);
    const dtype = dtypeMatch ? dtypeMatch[1] : '<f8';

    const shapeMatch = headerStr.match(/'shape'\s*:\s*\((.*?)\)/);
    const shape = shapeMatch
      ? shapeMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : [];

    const size = shape.reduce((a, b) => a * b, 1);
    const sampleSize = Math.min(size, 100);
    const dataBuffer = buffer.subarray(dataStart);
    const data = this.readTypedArray(dataBuffer, dtype, sampleSize);

    return { dtype, shape, size, data };
  }

  private readTypedArray(buffer: Buffer, dtype: string, maxSize: number): any[] {
    const result: any[] = [];
    const typeChar = dtype[dtype.length - 1];
    const byteSize = parseInt(dtype.substring(1, dtype.length - 1)) || 1;

    for (let i = 0; i < Math.min(buffer.length / byteSize, maxSize); i++) {
      const offset = i * byteSize;
      try {
        switch (typeChar) {
          case 'f':
            if (byteSize === 4) result.push(buffer.readFloatLE(offset));
            else if (byteSize === 8) result.push(buffer.readDoubleLE(offset));
            break;
          case 'i':
            if (byteSize === 1) result.push(buffer.readInt8(offset));
            else if (byteSize === 2) result.push(buffer.readInt16LE(offset));
            else if (byteSize === 4) result.push(buffer.readInt32LE(offset));
            else if (byteSize === 8) result.push(Number(buffer.readBigInt64LE(offset)));
            break;
          case 'u':
            if (byteSize === 1) result.push(buffer.readUInt8(offset));
            else if (byteSize === 2) result.push(buffer.readUInt16LE(offset));
            else if (byteSize === 4) result.push(buffer.readUInt32LE(offset));
            else if (byteSize === 8) result.push(Number(buffer.readBigUInt64LE(offset)));
            break;
          case 'b':
            result.push(buffer.readUInt8(offset) !== 0);
            break;
          default:
            result.push(buffer.readDoubleLE(offset));
        }
      } catch {
        break;
      }
    }
    return result;
  }
}
