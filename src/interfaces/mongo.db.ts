import { MongoCollection } from './mongo.collection';

export interface MongoDB {
  collection<T>(name: string): MongoCollection<T>;
}
