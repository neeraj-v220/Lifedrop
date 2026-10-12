const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "local_db.json");

// Ensure data folder exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], donors: [], requests: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) {
    return { users: [], donors: [], requests: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function matchQuery(item, query) {
  if (!query) return true;
  for (let key in query) {
    const queryVal = query[key];
    const itemVal = item[key];

    if (queryVal instanceof RegExp) {
      if (itemVal === undefined || itemVal === null) return false;
      if (!queryVal.test(String(itemVal))) return false;
    } else if (typeof queryVal === "object" && queryVal !== null) {
      if (key === "$or") {
        if (!Array.isArray(queryVal)) return false;
        const matchesAny = queryVal.some(subQuery => matchQuery(item, subQuery));
        if (!matchesAny) return false;
      } else if (queryVal.$exists !== undefined) {
        const exists = itemVal !== undefined;
        if (exists !== queryVal.$exists) return false;
      } else {
        // Loose fallback comparison
      }
    } else {
      if (itemVal !== queryVal) return false;
    }
  }
  return true;
}

function makeHybridModel(modelName, mongooseModel) {
  const collectionKey = modelName.toLowerCase() + "s"; // users, donors, requests

  class HybridModel {
    constructor(data = {}) {
      Object.assign(this, data);
    }

    static get isFallback() {
      // Use fallback if mongoose is not connected (readyState !== 1)
      return mongoose.connection.readyState !== 1;
    }

    async save() {
      if (!HybridModel.isFallback) {
        if (this._id) {
          const updated = await mongooseModel.findByIdAndUpdate(this._id, this, { new: true, upsert: true });
          return updated;
        } else {
          const mongooseInstance = new mongooseModel(this);
          const saved = await mongooseInstance.save();
          return saved;
        }
      }

      // Fallback save logic
      const db = readDb();
      const items = db[collectionKey] || [];

      // Copy values from `this` properties (excluding internal properties)
      const saveData = {};
      for (let key in this) {
        if (key !== "_id" && !key.startsWith("_")) {
          saveData[key] = this[key];
        }
      }

      if (this._id) {
        saveData._id = this._id;
        saveData.updatedAt = new Date();
        const index = items.findIndex(item => item._id === this._id);
        if (index !== -1) {
          items[index] = { ...items[index], ...saveData };
        } else {
          items.push(saveData);
        }
      } else {
        saveData._id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        saveData.createdAt = new Date();
        saveData.updatedAt = new Date();
        this._id = saveData._id;
        items.push(saveData);
      }

      db[collectionKey] = items;
      writeDb(db);
      return this;
    }

    static async findOne(query) {
      if (!this.isFallback) {
        return await mongooseModel.findOne(query);
      }
      const db = readDb();
      const items = db[collectionKey] || [];
      const found = items.find(item => matchQuery(item, query));
      return found ? new HybridModel(found) : null;
    }

    static async findById(id) {
      if (!this.isFallback) {
        return await mongooseModel.findById(id);
      }
      const db = readDb();
      const items = db[collectionKey] || [];
      const found = items.find(item => item._id === String(id));
      return found ? new HybridModel(found) : null;
    }

    static async create(data) {
      if (!this.isFallback) {
        return await mongooseModel.create(data);
      }
      const instance = new HybridModel(data);
      return await instance.save();
    }

    static find(query) {
      if (!this.isFallback) {
        return mongooseModel.find(query);
      }
      const db = readDb();
      const items = db[collectionKey] || [];
      const matched = items.filter(item => matchQuery(item, query));

      const chain = {
        select: function() { return this; },
        lean: function() { return this; },
        then: function(resolve, reject) {
          // Resolve with plain objects (similar to .lean())
          resolve(matched);
        },
        catch: function(reject) {}
      };
      return chain;
    }
  }

  return HybridModel;
}

module.exports = makeHybridModel;
