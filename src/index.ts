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
import { getJwt, verifyJwt, type JwtPayload } from './utils';

declare global {
	namespace Cloudflare {
		interface Env {
			jwt: JwtPayload;
		}
	}
}

export default {
	async fetch(request, env, ctx) {
		try {
			env.jwt = await verifyJwt(getJwt(request), env.JWT_PUBLIC_KEY);
		} catch (e) {
			console.log({ message: 'Failed to authenticate request', details: e instanceof Error ? e.message : e + '' });
			return new Response('Unauthorized', { status: 401 });
		}

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
