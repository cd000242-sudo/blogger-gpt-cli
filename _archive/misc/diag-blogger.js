const path = require('path');
const fs = require('fs');

// Load env
const envModule = require(path.join(__dirname, 'dist', 'env.js'));
const env = envModule.loadEnvFromFile();

// Google OAuth2 settings
const clientId = env.googleClientId || env.GOOGLE_CLIENT_ID || '';
const clientSecret = env.googleClientSecret || env.GOOGLE_CLIENT_SECRET || '';
const blogId = env.blogId || env.BLOGGER_BLOG_ID || env.GOOGLE_BLOG_ID || env.BLOG_ID || '';

console.log('CLIENT_ID_FOUND: ' + (!!clientId));
console.log('CLIENT_ID_LEN: ' + clientId.length);
console.log('CLIENT_SECRET_FOUND: ' + (!!clientSecret));
console.log('CLIENT_SECRET_LEN: ' + clientSecret.length);
console.log('BLOG_ID_FOUND: ' + (!!blogId));
console.log('BLOG_ID_VALUE: ' + blogId);

// All blogger-related env keys
const bloggerKeys = Object.keys(env).filter(k =>
    k.toLowerCase().includes('blog') ||
    k.toLowerCase().includes('google') ||
    k.toLowerCase().includes('oauth')
);
console.log('BLOGGER_RELATED_KEYS: ' + bloggerKeys.join(', '));

// Auth module
const auth = require(path.join(__dirname, 'src', 'core', 'blogger-modules', 'auth.js'));
auth.checkBloggerAuthStatus().then(s => {
    console.log('AUTH_AUTHENTICATED: ' + s.authenticated);
    console.log('AUTH_NEEDS_REFRESH: ' + (s.needsRefresh || false));
    console.log('AUTH_ERROR: ' + (s.error || 'none'));
    if (s.tokenData) {
        console.log('TOKEN_ACCESS_LEN: ' + (s.tokenData.access_token ? s.tokenData.access_token.length : 0));
        console.log('TOKEN_REFRESH_LEN: ' + (s.tokenData.refresh_token ? s.tokenData.refresh_token.length : 0));
        const expiresAt = s.tokenData.expires_at;
        if (expiresAt) {
            console.log('TOKEN_EXPIRES_IN_MIN: ' + Math.round((expiresAt - Date.now()) / 60000));
        }
    }

    // Token file path
    try {
        const utils = require(path.join(__dirname, 'src', 'core', 'blogger-modules', 'utils.js'));
        const tokenPath = utils.getTokenFilePath();
        console.log('TOKEN_FILE_PATH: ' + tokenPath);
        console.log('TOKEN_FILE_EXISTS: ' + fs.existsSync(tokenPath));
    } catch (e) {
        console.log('TOKEN_FILE_CHECK_ERROR: ' + e.message);
    }
}).catch(e => console.log('AUTH_CHECK_ERROR: ' + e.message));
