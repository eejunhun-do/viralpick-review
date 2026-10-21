import {socialGET,socialPOST,preflight} from '../lib/social-publishing.js';
export function OPTIONS(req){return preflight(req)}
export const GET=socialGET;
export const POST=socialPOST;

// Allow bounded Meta insights requests and OAuth exchanges.
export const config={maxDuration:60};
