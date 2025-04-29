export interface JwtPayload {
	nameid: string;
	role: string;
	iss: string;
	aud: string;
	nbf: number;
	exp: number;
	iat: number;
}

export const getPathname = (request: Request) => {
	const pathnameStart = request.url.indexOf('/', request.url.indexOf('://') + 3);
	return pathnameStart === -1 ? '/' : request.url.substring(pathnameStart);
};

export const setResponseR2ObjectHeaders = (object: R2Object) => (response: Response) => {
	object.writeHttpMetadata(response.headers);
	response.headers.set('ETag', object.httpEtag);
};

export const setResponseCacheHeaders = (jwt: JwtPayload) => (response: Response) => {
	response.headers.set('Cache-Control', `max-age=${getSecondsToExpire(jwt.exp)}, must-revalidate`);
};

export const verifyJwt = async (token: string, publicPemSkpi: string) => {
	const [headerB64, payloadB64, signatureB64] = token.split('.', 3);
	const encoder = new TextEncoder();

	const header = JSON.parse(base64UrlDecode(headerB64));
	const payload = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;
	const decodedSignature = base64UrlDecode(signatureB64);
	const signature = new Uint8Array(decodedSignature.length);

	for (let i = 0; i < decodedSignature.length; i++) {
		signature[i] = decodedSignature.charCodeAt(i);
	}

	if (header.alg !== 'RS256') {
		throw new Error('Unexpected JWT algorithm');
	}

	const key = await crypto.subtle.importKey(
		'spki',
		pemSkpiToArrayBuffer(publicPemSkpi),
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256',
		},
		false,
		['verify']
	);

	const verified = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		signature,
		encoder.encode(`${headerB64}.${payloadB64}`)
	);

	if (!verified) {
		throw new Error('Invalid signature');
	}

	const now = Math.floor(Date.now() / 1000);
	if (payload.exp < now) {
		throw new Error('Token has expired');
	}

	if (payload.nbf > now) {
		throw new Error('Token is not yet valid');
	}

	if (payload.iat > now) {
		throw new Error('Token was issued in the future');
	}

	return payload;
};

export const pemSkpiToArrayBuffer = (pemSkpi: string) => {
	const headerLength = 26; // -----PUBLIC PUBLIC KEY-----
	const footerLength = 24; // -----END PUBLIC KEY-----
	const content = pemSkpi.substring(headerLength + 1, pemSkpi.length - footerLength - 1);

	const binaryString = atob(content);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
};

export const base64UrlDecode = (str: string) => {
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	const pad = str.length % 4;
	if (pad) {
		str += '='.repeat(4 - pad);
	}
	return atob(str);
};

export const getJwt = (request: Request) => {
	const header = request.headers.get('Authorization');
	if (!header) {
		throw new Error('Missing Authorization header');
	}

	const schemeLength = 'Bearer'.length;
	const scheme = header.substring(0, schemeLength);
	const token = header.substring(schemeLength + 1);
	if (scheme !== 'Bearer') {
		throw new Error('Invalid Authorization scheme');
	}
	if (!token) {
		throw new Error('Missing JWT token in Authorization header');
	}

	return token;
};

export const getSecondsToExpire = (timestampInSeconds: number) => {
	const now = Math.floor(Date.now() / 1000);
	return Math.max(0, timestampInSeconds - now);
};

export const isOriginAllowed = (env: Env) => (origin: string) => {
	return origin && (env.ALLOWED_ORIGINS as unknown as string[]).includes(origin);
};

export const setResponseCorsHeaders = (origin: string, headers: string) => (response: Response) => {
	response.headers.set('Access-Control-Allow-Origin', origin);
	response.headers.set('Access-Control-Allow-Methods', 'OPTIONS,HEAD,GET');
	response.headers.set('Access-Control-Allow-Headers', headers);
	response.headers.set('Access-Control-Allow-Credentials', 'true');
};
