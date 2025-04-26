import { buildHeaders, getPathname, getSecondsToExpire } from './utils';

export default (async (request, env, ctx) => {
	const cache = caches.default;
	const pathname = getPathname(request);

	let response = await cache.match(request);
	if (!response) {
		const object = await env.R2_BUCKET.head(pathname.substring(1));
		if (!object) {
			return new Response('Not Found', { status: 404 });
		}
		const headers = buildHeaders(object);
		headers.set('Cache-Control', `max-age=${getSecondsToExpire(env.jwt.exp)}, must-revalidate`);
		response = new Response(null, { status: 200, headers });
		ctx.waitUntil(cache.put(request, response.clone()));
	}

	return response;
}) satisfies ExportedHandlerFetchHandler<Env>;
