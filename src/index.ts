/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
		switch (request.method) {
			case 'HEAD':
				return HEAD(request, env, ctx);
			case 'GET':
				return GET(request, env, ctx);
			default:
				return new Response('Method Not Allowed', {
					status: 405,
					headers: {
						Allow: 'HEAD, GET',
					},
				});
		}
	},
} satisfies ExportedHandler<Env>;

const HEAD: ExportedHandlerFetchHandler<Env> = async (request, env, ctx) => {
	const cache = caches.default;
	const pathname = getPathname(request);

	let response = await cache.match(request);
	if (!response) {
		const object = await env.R2_BUCKET.head(pathname.substring(1));
		if (!object) {
			return new Response('Not Found', { status: 404 });
		}
		const headers = buildHeaders(object);
		response = new Response(null, { status: 200, headers });
		ctx.waitUntil(cache.put(request, response.clone()));
	}
	return response;
};

const GET: ExportedHandlerFetchHandler<Env> = async (request, env, ctx) => {
	const cache = caches.default;
	const pathname = getPathname(request);

	let response = await cache.match(request);

	if (!response) {
		const object = await env.R2_BUCKET.get(pathname.substring(1));
		if (!object) {
			return new Response('Not Found', { status: 404 });
		}
		const headers = buildHeaders(object);
		response = new Response(object.body, { status: 200, headers });
		ctx.waitUntil(cache.put(request, response.clone()));
	}

	return response;
};

const getPathname = (request: Request) => {
	const pathnameStart = request.url.indexOf('/', request.url.indexOf('://') + 3);
	return pathnameStart === -1 ? '/' : request.url.substring(pathnameStart);
};

const buildHeaders = (object: R2Object) => {
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('ETag', object.httpEtag);
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');

	return headers;
};
