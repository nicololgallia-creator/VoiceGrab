import { registryData as modelData } from "../models/registryData.js";

const catalog = (): typeof modelData.parakeetModels => modelData.parakeetModels;
// Only Whisper: the Oruk, NVIDIA and Cohere models run through the sherpa-onnx server,
// which listens on every network interface (see parakeetCapability.js).
export const LOCAL_ASR_ORGANIZATIONS = [{ id: "whisper", name: "OpenAI" }];

export function getASRModelOrganization(modelId: string): string {
  return (
    catalog()[modelId]?.organization?.id ||
    (catalog()[modelId]?.modelType === "cohere-transcribe" ? "cohere" : "nvidia")
  );
}

// Organization labels are separate from the existing installation/IPC backend.
export function getSelectedASROrganization(backend: string, modelId: string): string {
  return backend === "nvidia" ? getASRModelOrganization(modelId) : backend;
}

export function usesParakeetManager(organizationId: string): boolean {
  return organizationId === "oruk" || organizationId === "nvidia" || organizationId === "cohere";
}
