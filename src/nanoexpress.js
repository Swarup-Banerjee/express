import uWS from 'uWebSockets.js';
import Ajv from 'ajv';

import { http, ws } from './middlewares';
import { routeMapper } from './helpers';

const nanoexpress = (options = {}) => {
  const time = Date.now(); // For better managing start-time / lags
  let app;
  let ajv = new Ajv(options.ajv);

  if (options.https) {
    app = uWS.SSLApp(options.https);
  } else {
    app = uWS.App();
  }
  if (options.configureAjv) {
    ajv = options.configureAjv(ajv);
  }

  const httpMethods = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'any',
    'head',
    'options',
    'trace'
  ];
  // App configuration
  let middlewares = [];
  const pathMiddlewares = {};
  const config = {};

  const _app = {
    config: {
      set: (key, value) => {
        config[key] = value;
      },
      get: (key) => config[key]
    },
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        if (port === undefined) {
          console.log('[Server]: PORT is required');
          return;
        }
        app.listen(port, host, (token) => {
          if (token) {
            console.log(
              `[Server]: started successfully at [localhost:${port}] in [${Date.now() -
                time}ms]`
            );
            resolve(_app);
          } else {
            console.log(`[Server]: failed to host at [localhost:${port}]`);
            reject();
          }
        });
      }),
    use: async (path, ...fns) => {
      if (typeof path === 'function') {
        fns.unshift(path);
        middlewares.push(...fns);

        // Avoid duplicates if contains for performance
        middlewares = middlewares.filter(
          (item, i, self) => self.indexOf(item) === i
        );
      } else if (typeof path === 'string') {
        if (!pathMiddlewares[path]) {
          pathMiddlewares[path] = [];
        }

        // Avoid duplicates if contains for performance
        pathMiddlewares[path].push(...fns);
        pathMiddlewares[path] = pathMiddlewares[path].filter(
          (item, i, self) => self.indexOf(item) === i
        );
      }
      return _app;
    },
    ws: (path, options, fn) => {
      app.ws(path, ws(path, options, fn));
      return _app;
    }
  };

  httpMethods.forEach((method) => {
    _app[method] = (path, ...fns) => {
      app[method](
        path,
        http(
          path,
          middlewares.concat(pathMiddlewares[path] || []).concat(fns),
          config,
          ajv
        )
      );
      return _app;
    };
  });

  _app.define = routeMapper(_app);

  return _app;
};

export { nanoexpress as default };
