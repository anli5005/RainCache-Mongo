import { MongoCollection } from './mongo.collection';

export interface MongoClient {
  collection<T>(name: string): MongoCollection<T>;
}
