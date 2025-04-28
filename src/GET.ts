import { setResponseCacheHeaders, setResponseR2ObjectHeaders } from './utils';

export default (async (request, env, ctx) => {
	const cache = caches.default;

	let response = await cache.match(request);

	if (!response) {
		const object = await env.R2_BUCKET.get(env.objectKey);
		if (!object) {
			return new Response('Not Found', { status: 404 });
		}

		response = new Response(object.body, { status: 200 });
		setResponseR2ObjectHeaders(object)(response);
		setResponseCacheHeaders(env.jwt)(response);
		ctx.waitUntil(cache.put(request, response.clone()));
	}

	return response;
}) satisfies ExportedHandlerFetchHandler<Env>;
