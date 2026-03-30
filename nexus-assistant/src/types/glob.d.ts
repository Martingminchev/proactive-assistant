declare module 'glob' {
  export interface GlobOptions {
    cwd?: string;
    absolute?: boolean;
    nodir?: boolean;
    maxdepth?: number;
    [key: string]: any;
  }

  export function glob(pattern: string, options?: GlobOptions): Promise<string[]>;
  
  // Default export for ES module compatibility
  const globFn: typeof glob;
  export default globFn;
}
