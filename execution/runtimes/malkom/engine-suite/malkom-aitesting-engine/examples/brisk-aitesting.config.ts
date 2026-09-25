import { defineHostConfig } from 'brisk-aitesting';

export default defineHostConfig({
  app: {
    name: 'Example SaaS',
    baseUrl: 'http://localhost:3000',
    repoPath: '.',
  },
});
