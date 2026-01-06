import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(), // Inline all assets for ChatGPT MCP widgets
  ],
  root: 'web',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        TimerWidget: path.resolve(__dirname, 'web/TimerWidget.html'),
        ProjectList: path.resolve(__dirname, 'web/ProjectList.html'),
        ProjectCard: path.resolve(__dirname, 'web/ProjectCard.html'),
        TaskList: path.resolve(__dirname, 'web/TaskList.html'),
        TaskCard: path.resolve(__dirname, 'web/TaskCard.html'),
        Statistics: path.resolve(__dirname, 'web/Statistics.html'),
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});
