import { defineConfig } from "vitest/config";
import path from "node:path";

// The date helpers must behave identically in every timezone. Run the suite under several with:
//   TZ=America/Los_Angeles npm test    TZ=Asia/Kolkata npm test    TZ=Pacific/Auckland npm test
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
