const fs = require('fs');
const html = fs.readFileSync('temp-check.html', 'utf8');
console.log('✅ count:', (html.match(/✅/g) || []).length);
console.log('📌 count:', (html.match(/📌/g) || []).length);
console.log('Sample H3:', html.match(/<h3[^>]*>[^<]{0,50}/g)?.slice(0, 2));

