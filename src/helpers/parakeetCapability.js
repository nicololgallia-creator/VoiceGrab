const PARAKEET_MINIMUM_MACOS_VERSION = "15.5";
const PARAKEET_UNSUPPORTED_OS_CODE = "PARAKEET_UNSUPPORTED_OS";

function compareVersions(left, right) {
  const leftParts = String(left).split(".").map(Number);
  const rightParts = String(right).split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }

  return 0;
}

// The sherpa-onnx WebSocket server has no host option: it listens on every network
// interface (asio tcp::v4 in sherpa-onnx v1.13.8), with no password. Every local model
// that runs through it (Oruk, NVIDIA, Cohere) stays off until it can bind 127.0.0.1.
function getParakeetCapability() {
  return {
    supported: false,
    code: PARAKEET_UNSUPPORTED_OS_CODE,
    message:
      "Parakeet is turned off in VoiceGrab: its server cannot be limited to this computer. Use Whisper.",
  };
}

function assertParakeetSupported(options) {
  const capability = getParakeetCapability(options);
  if (capability.supported) return;

  throw Object.assign(new Error(capability.message), {
    code: capability.code,
  });
}

module.exports = {
  PARAKEET_MINIMUM_MACOS_VERSION,
  PARAKEET_UNSUPPORTED_OS_CODE,
  compareVersions,
  getParakeetCapability,
  assertParakeetSupported,
};
