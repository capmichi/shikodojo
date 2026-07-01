import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// api/ は Vercel Functions として動く（本番）。ローカルは `vercel dev` 推奨。
export default defineConfig({
  plugins: [react()],
});
