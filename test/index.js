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
      await storageEngine.upsert("test.namespace.string", "string.");
    });

    it("should upsert an object", async () => {
      await storageEngine.upsert("test.namespace.object", {key: "value"});
    });

    it("should upsert an existing string", async () => {
      await storageEngine.upsert("test.namespace.string", "String!");
    });
  });

  describe("get", () => {
    it("should get a string", async () => {
      let string = await storageEngine.get("test.namespace.string");
      string.should.be.an.instanceOf(String);
      string.should.equal("String!");
    });

    it("should get an object", async () => {
      let object = await storageEngine.get("test.namespace.object");
      object.should.be.an.instanceOf(Object);
      object.should.have.property("key");
    });
  });

  describe("filter", () => {
    it("should filter out all strings in namespace test", async () => {
      let values = await storageEngine.filter((value) => {
        return typeof value !== "string";
      }, null, "test");

      values.length.should.equal(1);
      values[0].should.have.property("key");
    });

    it("should filter out all strings with certain IDs", async () => {
      let values = await storageEngine.filter((value) => {
        return typeof value !== "string";
      }, ["test.namespace.string"], "test");

      values.length.should.equal(0);
    });
  });

  describe("find", () => {
    it("should find the string in namespace test.namespace", async () => {
      let value = await storageEngine.find((value) => {
        return typeof value === "string";
      }, "test.namespace");

      value.should.be.an.instanceOf(String);
      value.should.equal("String!");
    });

    it("should find no strings in certain IDs", async () => {
      let value = await storageEngine.find((value) => {
        return typeof value === "string";
      }, ["test.namespace.object"], "test.namespace");

      should.not.exist(value);
    });
  });

  describe("lists", () => {
    describe("addToList", () => {
      it("should not add list items to non-lists", async () => {
        try {
          await storageEngine.addToList("test.namespace.string", "This should not exist");
          // If we actually do get here, fail
          should.fail("Operation succeeded");
        } catch(e) {
          should.exist(e);
        }
      });

      it("should create a list", async () => {
        await storageEngine.addToList("test.lists.greetings", "Hello, world!");
      });

      it("should add to an existing list", async () => {
        await storageEngine.addToList("test.lists.greetings", "Hello, universe!");
      });

      it("should multiple items to an existing list", async () => {
        await storageEngine.addToList("test.lists.greetings", ["Hello there!", "Hello, universe!", "Hello, universe!"]);
      });

      it("should be able to create multiple lists", async () => {
        await storageEngine.addToList("test.lists.otherlist", "1234");
      });
    });

    describe("isListMember", () => {
      it("should tell whether \"Hello, world!\" is part of the list", async () => {
        let result = await storageEngine.isListMember("test.lists.greetings", "Hello, world!");
        result.should.be.true();
      });

      it("should tell whether 1234 is part of the list", async () => {
        let result = await storageEngine.isListMember("test.lists.greetings", "1234");
        result.should.not.be.true();
      });

      it("should handle multiple lists", async () => {
        let result = await storageEngine.isListMember("test.lists.otherlist", "1234");
        result.should.be.true();
      });
    });

    describe("getListMembers", () => {
      it("should get members of a list", async () => {
        let members = await storageEngine.getListMembers("test.lists.greetings");
        members.length.should.equal(3);
        members[0].should.equal("Hello, world!");
        members[1].should.equal("Hello, universe!");
      });

      it("should handle multiple lists", async () => {
        let members = await storageEngine.getListMembers("test.lists.otherlist");
        members.length.should.be.above(0);
        members[0].should.equal("1234");
      });
    });

    describe("getListCount", () => {
      it("should count members in a list", async () => {
        let count = await storageEngine.getListCount("test.lists.greetings");
        count.should.equal(3);
      });
    });

    describe("removeFromList", () => {
      it("should remove an item from a list", async () => {
        await storageEngine.removeFromList("test.lists.greetings", "Hello, world!");
      });

      it("should no longer have the item", async () => {
        let result = await storageEngine.isListMember("test.lists.greetings", "Hello, world!");
        result.should.not.be.true();
      });

      it("should still have other items", async () => {
        let result = await storageEngine.isListMember("test.lists.greetings", "Hello, universe!");
        result.should.be.true();
      });
    });

    describe("removeList", () => {
      it("should remove a list", async () => {
        await storageEngine.removeList("test.lists.greetings");
      });

      it("should no longer have the list", async () => {
        try {
          await storageEngine.getListMembers("test.lists.greetings");
          // If we actually do get here, fail
          should.fail("Operation succeeded");
        } catch(e) {
          should.exist(e);
        }
      });
    });
  });

  describe("remove", () => {
    it("should not remove lists", async () => {
      try {
        await storageEngine.remove("test.lists.otherlist");
        // If we actually do get here, fail
        should.fail("Operation succeeded");
      } catch(e) {
        should.exist(e);
      }
    });

    it("should remove keys", async () => {
      await storageEngine.remove("test.namespace.string");
      await storageEngine.remove("test.namespace.object");
    });

    it("should no longer have the keys", async () => {
      let string = await storageEngine.get("test.namespace.string");
      should.not.exist(string);
      let object = await storageEngine.get("test.object");
      should.not.exist(object);
    });
  });
});
