import { KeyValuePair } from '../interfaces/keyvaluepair';
import { ListItem } from '../interfaces/listitem';

import { MongoCollection } from '../interfaces/mongo.collection';
import { MongoDB } from '../interfaces/mongo.db';
import { Parsed } from '../interfaces/parsed';
import { collections } from './collections';

export interface MongoStorageEngineOptions {
	db: MongoDB;
	collectionNames?: { kv?: string, list?: string };
}

export class MongoStorageEngine {
	options: MongoStorageEngineOptions = null;

	db: MongoDB = null;
	listCollection: MongoCollection<ListItem> = null;
	collections: Object = {};

	constructor(options: MongoStorageEngineOptions) {
		this.options = options;
	}

	async initialize() {
		this.db = this.options.db;
		this.listCollection = this.db.collection('raincachelists');

		collections.forEach(collection => {
			this.collections[`${collection}`] = this.db.collection(`raincache-${collection}`);
		});

		// TODO: Create indices
	}

	async get(id: string): Promise<any> {
		let parsed = this.parseID(id);
		let pair = await this.collections[parsed.collection].findOne({ key: id });
		if (pair && pair.list) {
			throw new Error('Requested object is a list');
		}

		return pair && pair.value;
	}

	async upsert(id: string, updateData: any, useHash: boolean) {
		let parsed = this.parseID(id);
		let pair = await this.collections[parsed.collection].findOne({ key: id }, { fields: { _id: 1, list: 1, value: 1 } });
		if (pair) {
			// Update the data.
			if (pair.list) {
				throw new Error('Requested object is a list');
			}

			let value = (!pair.value || typeof pair.value === 'string' || typeof pair.value === 'number' || typeof pair.value === 'boolean') ? updateData : Object.assign(pair.value, updateData);
			this.collections[parsed.collection].updateOne({ _id: pair._id }, { $set: { value: value } });
		} else {
			// Insert the data.
			let toInsert: KeyValuePair = { key: id, value: updateData, list: false, namespaces: [] };
			let namespaces = id.split(".");

			namespaces.slice(1).map((component, index) => {
				return namespaces.slice(0, index).join('.');
			});

			toInsert.namespaces = namespaces;
			await this.collections[parsed.collection].insertOne(toInsert);
		}
	}

	async remove(id: string, useHash: boolean) {
		let parsed = this.parseID(id);
		await this.collections[parsed.collection].remove({ key: id });
	}

	async filter(fn: (value: any) => boolean, ids: string[], namespace: string): Promise<any[]> {
		let query: { [index: string]: any } = { namespaces: namespace, list: false };
		if (ids) {
			query.ids = { $in: ids };
		}

		let cursor = await this.collections[namespace].find(query);
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

	async find(fn: (value: any) => boolean, id: string[] | string, namespace: string): Promise<any> {
		let ids: string[] = null;

		if (typeof id === 'string') {
			ids.push(id);
		} else {
			ids = id;
		}

		let query: { [index: string]: any } = { namespaces: namespace, list: false };
		if (ids) {
			query.ids = { $in: ids };
		}

		let cursor = this.collections[namespace].find(query);
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
		let parsed = this.parseID(listId);
		let pair = await this.collections[parsed.collection].findOne({ key: parsed.key }, { fields: { _id: 1, list: 1 } });
		if (!pair) {
			return [];
		}
		if (!pair.list) {
			throw new Error('Requested object is not a list');
		}

		let members = await this.listCollection.find({ listID: pair._id }).toArray();
		return members.map((member: ListItem) => {
			return member.value;
		});
	}

	async addToList(listId: string, ids: string | string[]) {
		let parsed = this.parseID(listId);
		let pair = await this.collections[parsed.collection].findOne({ key: parsed.key }, { fields: { _id: 1, list: 1 } });
		if (pair && !pair.list) {
			throw new Error('Requested object is not a list');
		}

		if (!pair) {
			pair = await this.collections[parsed.collection].insertOne({
				key: parsed.key, list: true, value: null, namespaces: listId.split('.').slice(1).map((component: string, index: number, array: string[]): string => {
					return array.slice(0, index).join('.');
				})
			});
		}

		let toAdd: string[] = ids instanceof Array ? ids : [ids];

		let inList = {};
		let duplicates = await this.listCollection.find({ listID: pair._id, value: { $in: toAdd } }).toArray();

		if (duplicates.length === toAdd.length) {
			return;
		}

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
			return { listID: pair._id, value: value };
		}));
	}

	async isListMember(listId: string, id: string): Promise<boolean> {
		let parsed = this.parseID(listId);
		let pair = await this.collections[parsed.collection].findOne({ key: parsed.key }, { fields: { _id: 1, list: 1 } });
		if (!pair) {
			return false;
		}
		if (!pair.list) {
			throw new Error('Requested object is not a list');
		}

		let count = await this.listCollection.count({ listID: pair._id, value: id });
		return !!count;
	}

	async removeFromList(listId: string, id: string) {
		let parsed = this.parseID(listId);
		let pair = await this.collections[parsed.collection].findOne({ key: parsed.key }, { fields: { _id: 1, list: 1 } });
		if (!pair) {
			return false;
		}
		if (!pair.list) {
			throw new Error('Requested object is not a list');
		}

		await this.listCollection.remove({ listID: pair._id, value: id });
		return true;
	}

	async removeList(listId: string) {
		let parsed = this.parseID(listId);
		let pair = await this.collections[parsed.collection].findOne({ key: parsed.key }, { fields: { _id: 1, list: 1 } });
		if (!pair) {
			return false;
		}
		if (!pair.list) {
			throw new Error('Requested object is not a list');
		}

		await this.listCollection.remove({ listID: pair._id });
		await this.collections[parsed.collection].remove({ _id: pair._id });
		return true;
	}

	async getListCount(listId: string): Promise<number> {
		let parsed = this.parseID(listId);
		let pair = await this.collections[parsed.collection].findOne({ key: parsed.key }, { fields: { _id: 1, list: 1 } });
		if (!pair) {
			return 0;
		}
		if (!pair.list) {
			throw new Error('Requested object is not a list');
		}

		return await this.listCollection.count({ listID: pair._id });
	}

	parseID(id): Parsed {
		let parsed = id.split('.');
		let collection = parsed[0];
		parsed.splice(0, 1);
		let key = parsed.join('.');
		return { collection, key };
	}
}
