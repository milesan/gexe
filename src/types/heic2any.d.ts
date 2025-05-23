declare module 'heic2any' {
  interface ConvertOptions {
    blob: Blob;
    toType: string;
    quality?: number;
  }

  function heic2any(options: ConvertOptions): Promise<Blob | Blob[]>;
  export default heic2any;
} 