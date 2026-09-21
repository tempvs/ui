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
        onProxyReq(proxyRequest) {
          if (proxyRequest.getHeader('origin')) {
            proxyRequest.setHeader('origin', target);
          }
        },
      }),
    );
  }
};
