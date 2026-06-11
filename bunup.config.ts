import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["src/index.ts", "src/schemas.ts"],
  dtsOnly: true,
  dts: {
    inferTypes: true,
  },
});
