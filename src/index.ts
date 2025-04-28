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

import GET from './GET';
import HEAD from './HEAD';
import { getJwt, getPathname, isOriginAllowed, setResponseCorsHeaders, verifyJwt, type JwtPayload } from './utils';

declare global {
	namespace Cloudflare {
		interface Env {
			objectKey: string;
			jwt: JwtPayload;
		}
	}
}

export default {
	async fetch(request, env, ctx) {
		const requestOrigin = request.headers.get('Origin') || request.headers.get('Referrer');
		const requestHeaders = request.headers.get('Access-Control-Request-Headers') ?? '*';
		if (!requestOrigin || !isOriginAllowed(env)(requestOrigin)) {
			return new Response('Forbidden', { status: 403 });
		}

		try {
			env.jwt = await verifyJwt(getJwt(request), env.JWT_PUBLIC_KEY);
		} catch (e) {
			console.info({ message: 'Failed to authenticate request', details: e instanceof Error ? e.message : e + '' });
			const response = new Response('Unauthorized', { status: 401 });
			setResponseCorsHeaders(requestOrigin, requestHeaders)(response);
			return response;
		}

		const pathname = getPathname(request);
		const { success } = await env.USER_RATE_LIMITER.limit({ key: env.jwt.nameid });
		if (!success) {
			const response = new Response('Rate limit exceeded', { status: 429 });
			response.headers.set('Retry-After', '60');
			setResponseCorsHeaders(requestOrigin, requestHeaders)(response);
			return response;
		}

		if (request.method === 'OPTIONS') {
			const response = new Response(null, { status: 204 });
			setResponseCorsHeaders(requestOrigin, requestHeaders)(response);
			return response;
		}

		env.objectKey = pathname.substring(1);

		let response: Response = undefined!;
		switch (request.method) {
			case 'HEAD':
				response = await HEAD(request, env, ctx);
				break;
			case 'GET':
				response = await GET(request, env, ctx);
				break;
			default:
				response = new Response('Method Not Allowed', {
					status: 405,
					headers: {
						Allow: 'OPTIONS, HEAD, GET',
					},
				});
				break;
		}

		setResponseCorsHeaders(requestOrigin, requestHeaders)(response);
		return response;
	},
} satisfies ExportedHandler<Env>;
