import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deepClone,
  pathKey,
  getAtPath,
  setAtPath,
  deleteAtPath,
  renameKey,
  moveArrayItem,
  inferType,
  coerceFromString,
  validatePaulipediaData,
} from "../assets/json_ops.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

test("deepClone creates an equal but independent copy", () => {
  const src = {a:1, b:{c:[1,2,3]}};
  const c = deepClone(src);
  assert.deepEqual(c, src);
  assert.notEqual(c, src);
  assert.notEqual(c.b, src.b);
  assert.notEqual(c.b.c, src.b.c);
});

test("pathKey serializes paths", () => {
  assert.equal(pathKey([]), "");
  assert.equal(pathKey(["a", "b"]), "a/b");
  assert.equal(pathKey(["a/b", "~x"]), "a~1b/~0x");
});

test("getAtPath/setAtPath round trip", () => {
  const obj = {a:{b:1}};
  assert.equal(getAtPath(obj, ["a","b"]), 1);
  setAtPath(obj, ["a","b"], 42);
  assert.equal(getAtPath(obj, ["a","b"]), 42);
});

test("deleteAtPath supports objects and arrays", () => {
  const obj = {a:{b:1, c:2}, arr:["x","y","z"]};
  deleteAtPath(obj, ["a","b"]);
  assert.deepEqual(obj.a, {c:2});
  deleteAtPath(obj, ["arr", 1]);
  assert.deepEqual(obj.arr, ["x","z"]);
});

test("renameKey renames object keys and rejects duplicates", () => {
  const obj = {a:{old:1, keep:2}};
  renameKey(obj, ["a","old"], "new");
  assert.deepEqual(obj.a, {new:1, keep:2});
  assert.throws(() => renameKey(obj, ["a","new"], "keep"));
});

test("moveArrayItem moves items within array bounds", () => {
  const obj = {arr:["a","b","c"]};
  moveArrayItem(obj, ["arr", 2], "up");
  assert.deepEqual(obj.arr, ["a","c","b"]);
  moveArrayItem(obj, ["arr", 0], "up");
  assert.deepEqual(obj.arr, ["a","c","b"]);
  moveArrayItem(obj, ["arr", 0], "down");
  assert.deepEqual(obj.arr, ["c","a","b"]);
});

test("inferType detects JSON-friendly types", () => {
  assert.equal(inferType(null), "null");
  assert.equal(inferType([1,2]), "array");
  assert.equal(inferType({a:1}), "object");
  assert.equal(inferType("x"), "string");
  assert.equal(inferType(1), "number");
  assert.equal(inferType(true), "boolean");
});

test("coerceFromString coerces values", () => {
  assert.equal(coerceFromString("string", 123), "123");
  assert.equal(coerceFromString("number", "12.5"), 12.5);
  assert.equal(coerceFromString("boolean", "true"), true);
  assert.equal(coerceFromString("boolean", "false"), false);
  assert.equal(coerceFromString("null", "x"), null);
  assert.deepEqual(coerceFromString("object", ""), {});
  assert.deepEqual(coerceFromString("array", ""), []);
});

test("validatePaulipediaData accepts the repository data.json", async () => {
  const jsonPath = path.join(repoRoot, "data", "data.json");
  const raw = await readFile(jsonPath, "utf-8");
  const obj = JSON.parse(raw);
  const result = validatePaulipediaData(obj);
  assert.equal(result.ok, true);
});
