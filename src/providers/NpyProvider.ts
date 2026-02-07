import { BaseProvider, ParseOptions } from './BaseProvider';
import { ParseResult } from '../types';

interface NpyHeader {
  dtype: string;
  fortranOrder: boolean;
  shape: number[];
  dataOffset: number;
}

/**
 * NumPy .npy 文件解析器
 */
export class NpyProvider extends BaseProvider {
  readonly supportedExtensions = ['.npy'];

  async parse(filePath: string, options?: ParseOptions): Promise<ParseResult> {
    const buffer = await this.readFile(filePath);
    const header = this.parseHeader(buffer);
    const data = this.parseData(buffer, header);

    return {
      meta: {
        filename: this.getFilename(filePath),
        format: 'npy',
        fileSize: buffer.length,
        fileType: 'NumPy Array',
        shape: header.shape,
        dtype: header.dtype,
        fortranOrder: header.fortranOrder,
        lastModified: await this.getLastModified(filePath),
        previewSize: this.calculatePreviewSize(data),
      },
      data: this.createTreeNode('array', data, 'array', []),
    };
  }

  private parseHeader(buffer: Buffer): NpyHeader {
    // magic: \x93NUMPY (6 bytes) — 用 latin1 读，因为 \x93 > 127 不是合法 ASCII
    const magic = buffer.toString('latin1', 0, 6);
    if (magic !== '\x93NUMPY') {
      throw new Error('Invalid .npy file: magic string mismatch');
    }

    const majorVersion = buffer.readUInt8(6);

    let headerLength: number;
    let headerStart: number;
    if (majorVersion === 1) {
      headerLength = buffer.readUInt16LE(8);
      headerStart = 10;
    } else if (majorVersion === 2) {
      headerLength = buffer.readUInt32LE(8);
      headerStart = 12;
    } else {
      throw new Error(`Unsupported .npy version: ${majorVersion}`);
    }

    const headerStr = buffer.toString('latin1', headerStart, headerStart + headerLength);
    return { ...this.parseHeaderDict(headerStr), dataOffset: headerStart + headerLength };
  }

  private parseHeaderDict(headerStr: string): Omit<NpyHeader, 'dataOffset'> {
    const dtypeMatch = headerStr.match(/'descr'\s*:\s*'(.*?)'/);
    const dtype = dtypeMatch ? dtypeMatch[1] : '<f8';

    const fortranMatch = headerStr.match(/'fortran_order'\s*:\s*(True|False)/);
    const fortranOrder = fortranMatch ? fortranMatch[1] === 'True' : false;

    const shapeMatch = headerStr.match(/'shape'\s*:\s*\((.*?)\)/);
    const shape = shapeMatch
      ? shapeMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : [];

    return { dtype, fortranOrder, shape };
  }

  private parseData(buffer: Buffer, header: NpyHeader): any[] | any[][] {
    const dataBuffer = buffer.subarray(header.dataOffset);
    const totalElements = header.shape.reduce((a, b) => a * b, 1);

    if (header.shape.length === 2) {
      // 2D: return nested array structure (rows × cols), sample rows
      const [rows, cols] = header.shape;
      const maxRows = Math.min(rows, 100);
      const flat = this.readTypedArray(dataBuffer, header.dtype, maxRows * cols);
      const result: any[][] = [];
      for (let r = 0; r < maxRows; r++) {
        result.push(flat.slice(r * cols, (r + 1) * cols));
      }
      return result;
    }

    // 1D or higher: flat sample
    const sampleSize = Math.min(totalElements, 100);
    return this.readTypedArray(dataBuffer, header.dtype, sampleSize);
  }

  private readTypedArray(buffer: Buffer, dtype: string, maxSize: number): any[] {
    const result: any[] = [];
    const endian = dtype[0]; // '<' little, '>' big
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
