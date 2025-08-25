import {defineConfig} from '@junobuild/config';

export default defineConfig({
  satellite: {
    ids: {
      development: '<DEV_SATELLITE_ID>',
      production: 'dpl4s-kqaaa-aaaal-asg3a-cai'
    },
    source: 'build',
    predeploy: ['pnpm build']
  },
  orbiter: {
    id: 'p2pi7-hiaaa-aaaal-asaia-cai'
  }
});
