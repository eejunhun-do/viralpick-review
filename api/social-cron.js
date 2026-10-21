import {runQueue} from '../lib/social-publishing.js';
export const GET=runQueue;

// Allow image processing and Meta API container publishing to complete.
export const config={maxDuration:60};
