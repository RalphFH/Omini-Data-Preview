// 数据可视化插件类型定义

export type DataFormat = 'npy' | 'npz' | 'pkl' | 'hdf5';

export type NodeType = 'scalar' | 'array' | 'object' | 'string';

/**
 * 元信息接口
 */
export interface MetaInfo {
  filename: string;
  format: DataFormat;
  fileSize: number;
  fileType: string;

  // npy/npz 专用
  shape?: number[];
  dtype?: string;
  fortranOrder?: boolean;

  // npz/hdf5 专用
  keys?: string[];
  compression?: string;

  lastModified: Date;
  previewSize: number;
}

/**
 * 树节点接口
 */
export interface TreeNode {
  id: string;
  key: string;
  value: any;
  type: NodeType;
  children?: TreeNode[];
  expanded?: boolean;
  path: string[];
  meta?: {
    dtype?: string;
    shape?: number[];
    size?: number;
  };
}

/**
 * 解析结果接口
 */
export interface ParseResult {
  meta: MetaInfo;
  data: TreeNode;
  warnings?: string[];
}

/**
 * 分块读取配置
 */
export interface ChunkReadConfig {
  chunkSize: number;
  maxMemory: number; // 字节
  sampleSize: number; // 采样数量
}

/**
 * 文件提供者接口
 */
export interface FileProvider {
  readonly format: DataFormat;

  /**
   * 解析文件
   */
  parse(filePath: string, config?: Partial<ChunkReadConfig>): Promise<ParseResult>;

  /**
   * 验证文件格式
   */
  validate(filePath: string): Promise<boolean>;

  /**
   * 获取文件元信息
   */
  getMetaInfo(filePath: string): Promise<MetaInfo>;
}