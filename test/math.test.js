import assert from "node:assert/strict";
import test from "node:test";
import { evaluateArithmetic, parseDuration } from "../math.js";

test("arithmetic parser supports precedence, parentheses, and powers", () => {
  assert.equal(evaluateArithmetic("2 + 3 * (4 - 1)"), 11);
  assert.equal(evaluateArithmetic("2^3^2"), 512);
  assert.equal(evaluateArithmetic("-2 + 5"), 3);
});

test("arithmetic parser rejects code, malformed input, and zero division", () => {
  assert.throws(() => evaluateArithmetic("process.exit()"), /Only numbers/);
  assert.throws(() => evaluateArithmetic("1 / 0"), /Division by zero/);
  assert.throws(() => evaluateArithmetic("(2 + 4"), /parentheses/);
});

test("duration parser accepts supported suffixes only", () => {
  assert.equal(parseDuration("30m"), 1_800_000);
  assert.equal(parseDuration("2h"), 7_200_000);
  assert.equal(parseDuration("3d"), 259_200_000);
  assert.equal(parseDuration("nope"), null);
});