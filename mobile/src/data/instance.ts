import { createMockRepository, type PaseoRepository } from "./repository";

// Single repository instance for the app. Swap createMockRepository() for the
// daemon-wired implementation in M2-S05 without touching screens.
export const repository: PaseoRepository = createMockRepository();
