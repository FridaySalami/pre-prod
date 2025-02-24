import adapter from '@sveltejs/adapter-netlify';

export default {
  kit: {
    adapter: adapter(),
    // if your site is served from a subfolder (like /parkers), you can specify it:
    paths: {
      base: '/parkers'
    }
  }
};