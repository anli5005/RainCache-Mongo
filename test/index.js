const assert = require("assert");
const config = require("../config.json");
const should = require("should");
const {Test, MongoStorageEngine} = require("../lib/index.js");

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
});
