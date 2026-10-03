import { createStart, createCsrfMiddleware } from '@tanstack/react-start';

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === 'serverFn',
      allowRequestsWithoutOriginCheck: true,
      secFetchSite: ['same-origin', 'same-site', 'none'],
    }),
  ],
}));
