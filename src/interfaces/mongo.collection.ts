import { MongoCursor } from './mongo.cursor';
import { MongoUpdateOperations } from './mongo.update';

export interface MongoCollection<T> {
  count(query, options?): Promise<number>;
  find(query, options?): MongoCursor<T>;
  findOne(query, options?): Promise<T>;
  insertMany(docs: T[], options?): Promise<void>;
  insertOne(doc: T, options?): Promise<void>;
  updateOne(filter, update: MongoUpdateOperations, options?): Promise<void>;
  remove(selector, options?): Promise<void>;
}
