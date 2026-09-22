const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.TEMPVS_DEV_ORIGIN ?? 'https://dev.tempvs.club';

module.exports = function (app) {
  for (const path of ['/api', '/auth']) {
    app.use(
      path,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        secure: true,
        xfwd: true,
        pathRewrite(path) {
          if (!path.startsWith('/auth/login')) return path;
          const url = new URL(path, target);
          url.searchParams.set('local', '1');
          return `${url.pathname}${url.search}`;
        },
        onProxyReq(proxyRequest) {
          if (proxyRequest.getHeader('origin')) {
            proxyRequest.setHeader('origin', target);
          }
        },
      }),
    );
  }
};
