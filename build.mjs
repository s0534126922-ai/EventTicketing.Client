import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const value = process.env.EVENTTICKETING_API_BASE_URL;
if (!value) {
    throw new Error("EVENTTICKETING_API_BASE_URL is required.");
}

const api = new URL(value);
if (api.protocol !== "https:" || api.username || api.password ||
    api.pathname !== "/api" || api.search || api.hash) {
    throw new Error("Use an HTTPS API URL that ends with /api.");
}

const output = "dist";
await rm(output, { recursive: true, force: true });
await mkdir(output);

const pages = (await readdir(".")).filter(name => name.endsWith(".html"));
for (const path of [...pages, "assets", "css", "js"]) {
    await cp(path, join(output, path), { recursive: true });
}

await writeFile(
    join(output, "js/deployment.js"),
    `export const DEPLOYED_API_BASE_URL = ${JSON.stringify(api.href)};\n`
);
