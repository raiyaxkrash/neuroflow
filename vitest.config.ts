import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    alias: {
      '@neuroflow/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@neuroflow/database': path.resolve(__dirname, './packages/database/src/index.ts'),
      '@neuroflow/nodes': path.resolve(__dirname, './packages/nodes/src/index.ts'),
      '@neuroflow/workflow-engine': path.resolve(__dirname, './packages/workflow-engine/src/index.ts'),
    },
  },
});
