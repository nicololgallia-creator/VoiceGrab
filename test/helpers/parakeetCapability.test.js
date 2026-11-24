const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertParakeetSupported,
  getParakeetCapability,
  PARAKEET_UNSUPPORTED_OS_CODE,
} = require("../../src/helpers/parakeetCapability");

test("Parakeet is off on every platform: its server listens on all network interfaces", () => {
  const capability = getParakeetCapability();
  assert.equal(capability.supported, false);
  assert.equal(capability.code, PARAKEET_UNSUPPORTED_OS_CODE);
  assert.throws(() => assertParakeetSupported(), { code: PARAKEET_UNSUPPORTED_OS_CODE });
});
