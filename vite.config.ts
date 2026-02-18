import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
     allowedHosts: [
      'willis-unplodding-nontheoretically.ngrok-free.dev', // Add your ngrok host here
      'all', // This will allow all hosts (use cautiously)
    ],
    host: '127.0.0.1',
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
