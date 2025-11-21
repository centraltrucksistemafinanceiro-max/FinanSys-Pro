
import PocketBase from 'pocketbase';

// Initialize the PocketBase client with the specific backend URL
// Note: The SDK automatically appends '/api/' to requests.
const pb = new PocketBase('https://app.fs-sistema.cloud');

// Disable auto-cancellation to prevent race conditions in multiple simultaneous dashboard requests
pb.autoCancellation(false);

export default pb;
