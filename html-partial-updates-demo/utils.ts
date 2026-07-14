import {envSchema} from "env-schema";
import {Type, Static} from "typebox";

export const noderegx = /^node(\d{1,2})$/;
export const MIME_TYPES = {
	default: "application/octet-stream",
	html: "text/html; charset=UTF-8",
	js: "text/javascript",
	css: "text/css",
	png: "image/png",
	jpg: "image/jpeg",
	gif: "image/gif",
	ico: "image/x-icon",
	svg: "image/svg+xml",
	json: "application/json",
	pdf: "application/pdf",
	txt: "text/plain",
	xml: "application/xml",
	csv: "text/csv",
};

export const EXTENSION_TYPES: { [key: string]: string } = {
	html: "html",
	js: "js",
	css: "css",
	png: "png",
	jpg: "jpg",
	gif: "gif",
	ico: "ico",
	svg: "svg",
	json: "json",
	pdf: "pdf",
	txt: "txt",
	xml: "xml",
	csv: "csv",
};

export function validateAndLoadEnv() {
	const schema = Type.Object({
		localhost: Type.String(),
		port: Type.Number({ minimum: 3000, maximum: 65535 }),
		pathname: Type.String(),
		DoDhost: Type.String(),
		tagLimit: Type.Number({ minimum: 1, maximum: 13 }),
		staticPath: Type.String(),
	});
	type Env = Static<typeof schema>;
	const env: Env = envSchema({ schema });
	return env;
}