import { KeyValuePair } from '../interfaces/keyvaluepair';
import { ListItem } from '../interfaces/listitem';

import { MongoCollection } from '../interfaces/mongo.collection';
import { MongoDB } from '../interfaces/mongo.db';

export interface MongoStorageEngineOptions {
  db: MongoDB;
  collectionNames?: {kv?: string, list?: string};
}

export class MongoStorageEngine {
  options: MongoStorageEngineOptions = null;

  db: MongoDB = null;
  kvCollection: MongoCollection<KeyValuePair> = null;
  listCollection: MongoCollection<ListItem> = null;

  constructor(options: MongoStorageEngineOptions) {
    this.options = options;
  }

  async initialize() {
    this.db = this.options.db;
    const collectionNames = this.options.collectionNames || {};
    this.kvCollection = this.db.collection(collectionNames.kv || "raincache");
    this.listCollection = this.db.collection(collectionNames.list || "raincachelists");

    // TODO: Create indices
  }

  async get(id: string, useHash: boolean): Promise<any> {
    let pair = await this.kvCollection.findOne({key: id});
    if (pair && pair.list) {
      throw new Error("Requested object is a list");
    }

    return pair && pair.value;
  }

  async upsert(id: string, updateData: any, useHash: boolean) {
    let pair = await this.kvCollection.findOne({key: id}, {fields: {_id: 1, list: 1, value: 1}});
    if (pair) {
      // Update the data.
      if (pair.list) {
        throw new Error("Requested object is a list");
      }

      let value = (!pair.value || typeof pair.value === "string" || typeof pair.value === "number" || typeof pair.value === "boolean") ? updateData : Object.assign(pair.value, updateData);
      this.kvCollection.updateOne({_id: pair._id}, {$set: {value: value}});
    } else {
      // Insert the data.
      let toInsert: KeyValuePair = {key: id, value: updateData, list: false, namespaces: []};
      toInsert.namespaces = id.split(".").map((component: string, index: number, array: string[]): string => {
        return array.slice(0, index).join(".");
      });
      await this.kvCollection.insertOne(toInsert);
    }
  }

  async remove(id: string, useHash: boolean) {
    await this.kvCollection.remove({key: id});
  }

  async filter(fn: (value: any) => boolean, ids: string[], namespace: string): Promise<any[]> {
    let query: {[index: string]: any} = {namespaces: namespace, list: false};
    if (ids) {
      query.ids = {$in: ids};
    }

    let cursor = await this.kvCollection.find(query);
    let result = [];
    while (await cursor.hasNext()) {
      let pair = await cursor.next();
      if (fn(pair.value)) {
        result.push(pair.value);
      }
    }

    await cursor.close();
    return result;
  }

  async find(fn: (value: any) => boolean, param1: string[] | string, param2?: string): Promise<any> {
    let ids: string[] = null;
    let namespace: string;

    if (typeof param1 === "string" && !param2) {
      namespace = param1;
    } else {
      ids = param1 as string[];
      namespace = param2;
    }

    let query: {[index: string]: any} = {namespaces: namespace, list: false};
    if (ids) {
      query.ids = {$in: ids};
    }

    let cursor = this.kvCollection.find(query);
    let result: any;
    while (await cursor.hasNext()) {
      let pair = await cursor.next();
      if (fn(pair.value)) {
        result = pair.value;
        break;
      }
    }

    await cursor.close();
    return result;
  }

  async getListMembers(listId: string): Promise<any[]> {
    let pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1, list: 1}});
    if (!pair) {
      throw new Error("Requested object not found");
    }
    if (!pair.list) {
      throw new Error("Requested object is not a list");
    }

    let members = await this.listCollection.find({listID: pair._id}).toArray();
    return members.map((member: ListItem) => {
      return member.value;
    });
  }

  async addToList(listId: string, ids: string | string[]) {
    let pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1, list: 1}});
    if (pair && !pair.list) {
      throw new Error("Requested object is not a list");
    }

    if (!pair) {
      await this.kvCollection.insertOne({key: listId, list: true, value: null, namespaces: listId.split(".").map((component: string, index: number, array: string[]): string => {
        return array.slice(0, index).join(".");
      })});
      pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1}});
    }

    let toAdd: string[] = ids instanceof Array ? ids : [ids];

    let inList = {};
    let duplicates = await this.listCollection.find({listID: pair._id, value: {$in: toAdd}}).toArray();
    duplicates.forEach((duplicate) => {
      inList[duplicate.value] = true;
    });

    await this.listCollection.insertMany(toAdd.filter((value) => {
      if (inList[value]) {
        return false;
      } else {
        inList[value] = true;
        return true;
      }
    }).map((value: any): ListItem => {
      return {listID: pair._id, value: value};
    }));
  }

  async isListMember(listId: string, id: string): Promise<boolean> {
    let pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1, list: 1}});
    if (!pair) {
      throw new Error("Requested object not found");
    }
    if (!pair.list) {
      throw new Error("Requested object is not a list");
    }

    let count = await this.listCollection.count({listID: pair._id, value: id});
    return !!count;
  }

  async removeFromList(listId: string, id: string) {
    let pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1, list: 1}});
    if (!pair) {
      throw new Error("Requested object not found");
    }
    if (!pair.list) {
      throw new Error("Requested object is not a list");
    }

    await this.listCollection.remove({listID: pair._id, value: id});
  }

  async removeList(listId: string) {
    let pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1, list: 1}});
    if (!pair) {
      throw new Error("Requested object not found");
    }
    if (!pair.list) {
      throw new Error("Requested object is not a list");
    }

    await this.listCollection.remove({listID: pair._id});
    await this.kvCollection.remove({_id: pair._id});
  }

  async getListCount(listId: string): Promise<number> {
    let pair = await this.kvCollection.findOne({key: listId}, {fields: {_id: 1, list: 1}});
    if (!pair) {
      throw new Error("Requested object not found");
    }
    if (!pair.list) {
      throw new Error("Requested object is not a list");
    }

    return await this.listCollection.count({listID: pair._id});
  }
}
