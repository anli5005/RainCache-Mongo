const assert = require("assert");
const config = require("../config.json");
const {MongoClient} = require("mongodb");
const should = require("should");
const {Test, MongoStorageEngine} = require("../lib/index.js");

let client;

describe("MongoDB", () => {
  it("should be connected", async () => {
    client = await MongoClient.connect(config.databaseURL);
    console.log("Connected to MongoDB!");
  });
});

describe("Test", () => {
  it("should exist", () => {
    should.exist(Test);
  });

  let test = new Test();

  it("should have a property named test", () => {
    test.should.have.property("test");
  });

  describe("test", () => {
    it("should be a string", () => {
      test.test.should.be.an.instanceOf(String);
    });

    it("should be equal to \"testy test test\"", () => {
      test.test.should.equal("testy test test");
    });
  });
});

describe("MongoStorageEngine", () => {
  it("should exist", () => {
    should.exist(MongoStorageEngine);
  });

  let storageEngine;

  it("should have an options property", () => {
    storageEngine = new MongoStorageEngine({db: client.db(config.databaseName)});
    should.exist(storageEngine.options);
  });

  it("should initialize itself", async () => {
    await storageEngine.initialize();
  });

  it("should have a connection to MongoDB", () => {
    should.exist(storageEngine.db);
  });

  it("should have a KV collection", () => {
    should.exist(storageEngine.kvCollection);
  });

  it("should have a list collection", () => {
    should.exist(storageEngine.listCollection);
  });

  describe("upsert", () => {
    it("should upsert a string", async () => {
      await storageEngine.upsert("string", "String!");
    });

    it("should upsert an object", async () => {
      await storageEngine.upsert("object", {key: "value"});
    });
  });

  describe("get", () => {
    it("should get a string", async () => {
      let string = await storageEngine.get("string");
      string.should.be.an.instanceOf(String);
      string.should.equal("String!");
    });

    it("should get an object", async () => {
      let object = await storageEngine.get("object");
      object.should.be.an.instanceOf(Object);
      object.should.have.property("key");
    });
  });

  describe("remove", () => {
    it("should remove keys", async () => {
      await storageEngine.remove("string");
      await storageEngine.remove("object");
    });

    it("should no longer have the keys", async () => {
      let string = await storageEngine.get("string");
      should.not.exist(string);
      let object = await storageEngine.get("object");
      should.not.exist(object);
    });
  });
});
