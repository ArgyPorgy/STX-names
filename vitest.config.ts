/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import {
  vitestSetupFilePath,
  getClarinetVitestsArgv,
} from "@stacks/clarinet-sdk/vitest";

export default defineConfig({
  test: {
    // use vitest-environment-clarinet
    environment: "clarinet",
    pool: "forks",
    // clarinet handles test isolation by resetting the simnet between tests
    isolate: false,
    maxWorkers: 1,
    setupFiles: [
      vitestSetupFilePath,
      // custom setup files can be added here
    ],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
        // add or override options
      },
    },
    include: ["tests/**/*.test.ts"],
    globals: true,
    testTimeout: 30000,
  },
});
