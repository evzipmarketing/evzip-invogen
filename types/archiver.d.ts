declare module "archiver" {
  import { Writable } from "stream";

  interface ArchiverOptions {
    zlib?: { level?: number };
  }

  interface Archiver {
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    append(
      source: string | Buffer | NodeJS.ReadableStream,
      data: { name: string }
    ): this;
    finalize(): this;
  }

  function archiver(format: string, options?: ArchiverOptions): Archiver;

  export = archiver;
}
