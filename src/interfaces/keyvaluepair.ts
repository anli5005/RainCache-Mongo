export interface KeyValuePair {
  _id?: string;
  key: string;
  namespaces: string[];
  list: boolean;
  value: any;
}
