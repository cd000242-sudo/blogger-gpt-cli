// Quick token file check
const path = require('path');
const fs = require('fs');
const utils = require(path.join(__dirname, 'src', 'core', 'blogger-modules', 'utils.js'));
const tokenPath = utils.getTokenFilePath();
const stat = fs.statSync(tokenPath);
const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
const now = Date.now();

// Simple output
console.log('TOKEN_MODIFIED:', stat.mtime.toISOString());
console.log('SECS_AGO:', Math.round((now - stat.mtime.getTime()) / 1000));
console.log('HAS_ACCESS:', !!data.access_token);
console.log('HAS_REFRESH:', !!data.refresh_token);
console.log('EXPIRES_AT:', data.expires_at ? new Date(data.expires_at).toISOString() : 'NONE');
console.log('IS_EXPIRED:', data.expires_at ? (now > data.expires_at) : 'NO_FIELD');

// Try direct API call with the token
fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { 'Authorization': 'Bearer ' + data.access_token }
}).then(r => {
    console.log('API_STATUS:', r.status);
    return r.text();
}).then(t => {
    console.log('API_RESPONSE:', t.substring(0, 200));
}).catch(e => console.log('API_ERROR:', e.message));
