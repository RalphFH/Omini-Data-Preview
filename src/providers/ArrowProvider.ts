/**
 * Apache Arrow / Feather 文件解析器 (.arrow, .feather)
 * 使用 apache-arrow 库（纯 JS）解析 Arrow IPC / Feather v2 格式
 */

import { BaseProvider, ParseResult, ParseOptions } from './BaseProvider';

const MAX_PREVIEW_ROWS = 100;
const MAX_PREVIEW_COLS = 50;

export class ArrowProvider extends BaseProvider {
  readonly supportedExtensions = ['.arrow', '.feather'];

  async parse(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    const { maxSampleSize = MAX_PREVIEW_ROWS } = options;

    try {
      const buffer = await this.readFile(filePath);
      const { tableFromIPC } = require('apache-arrow');
      const table = tableFromIPC(buffer);

      const numRows: number = table.numRows;
      const numCols: number = table.numCols;
      const fields: { name: string; type: string }[] = table.schema.fields.map(
        (f: any) => ({ name: f.name, type: String(f.type) }),
      );

      const columns = fields.map((f: { name: string }) => f.name);
      const displayCols = Math.min(numCols, MAX_PREVIEW_COLS);
      const displayRows = Math.min(numRows, maxSampleSize);

      // 按行组装 2D 数据
      const rows: any[][] = [];
      const colArrays: any[] = [];
      for (let c = 0; c < displayCols; c++) {
        const col = table.getChildAt(c);
        colArrays.push(col);
      }

      for (let r = 0; r < displayRows; r++) {
        const row: any[] = [];
        for (let c = 0; c < displayCols; c++) {
          const v = colArrays[c].get(r);
          // BigInt → Number for display
          row.push(typeof v === 'bigint' ? Number(v) : v);
        }
        rows.push(row);
      }

      return {
        meta: {
          filename: this.getFilename(filePath),
          format: 'arrow',
          fileSize: buffer.length,
          fileType: 'Apache Arrow',
          columns,
          numRows,
          numCols,
          lastModified: await this.getLastModified(filePath),
          previewSize: displayRows,
        },
        data: {
          id: 'table',
          key: 'table',
          value: rows,
          type: 'array',
          path: [],
          meta: {
            shape: [numRows, numCols],
            size: numRows * numCols,
          },
          columns,
          columnTypes: fields.map((f: { type: string }) => f.type),
        } as any,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse Arrow file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
