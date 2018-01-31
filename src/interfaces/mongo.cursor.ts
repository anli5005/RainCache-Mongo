export interface MongoCursor<T> {
  close(options?): Promise<void>;
  hasNext(): Promise<boolean>;
  next(): Promise<T>;
  toArray(): Promise<T[]>;
}
