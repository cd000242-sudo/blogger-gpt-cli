const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(process.env.APPDATA || '', 'lba', '.env');
    const vars = {};
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const m = line.match(/^([^#=]+)=(.+)$/);
            if (m) vars[m[1].trim()] = m[2].trim();
        });
    }
    return vars;
}

async function main() {
    const tokenPath = path.join(process.env.APPDATA || '', 'lba', 'blogger-token.json');
    if (!fs.existsSync(tokenPath)) { console.log('No token'); process.exit(1); }
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    let accessToken = tokenData.access_token;

    const blogId = '7313363217330018818';
    const postId = '3732281168193987962';
    const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}?view=ADMIN`;

    let res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });

    if (res.status === 401) {
        console.log('Token expired, refreshing...');
        const env = loadEnv();
        const rr = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                refresh_token: tokenData.refresh_token,
                grant_type: 'refresh_token'
            })
        });
        if (!rr.ok) { console.log('Refresh failed:', rr.status); process.exit(1); }
        const nt = await rr.json();
        accessToken = nt.access_token;
        res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    }

    if (!res.ok) { console.log('Failed:', res.status); process.exit(1); }
    const post = await res.json();

    console.log('Title:', post.title);
    const html = post.content || '';
    console.log('HTML length:', html.length);

    // CSS classes
    const classMatches = html.match(/class="([^"]+)"/g);
    const uniqueClasses = new Set();
    if (classMatches) {
        classMatches.forEach(m => {
            m.replace('class="', '').replace('"', '').split(/\s+/).forEach(c => uniqueClasses.add(c));
        });
    }
    console.log('\n== CSS Classes ==');
    [...uniqueClasses].sort().forEach(c => console.log('  ' + c));

    // Style tags
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatches) {
        console.log('\n== Style Tags (' + styleMatches.length + ') ==');
        styleMatches.forEach((s, i) => {
            console.log('\nStyle #' + (i + 1) + ' (' + s.length + ' chars):');
            console.log(s.substring(0, 800) + '...');
        });
    } else {
        console.log('\nNO <style> tags');
    }

    console.log('\n== First 1500 chars ==');
    console.log(html.substring(0, 1500));

    fs.writeFileSync('reference-post.html', html, 'utf-8');
    console.log('\nSaved to reference-post.html');
}

main().catch(e => { console.error(e.message); process.exit(1); });
