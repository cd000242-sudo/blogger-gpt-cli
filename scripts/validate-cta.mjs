// scripts/validate-cta.mjs
import fs from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const [,, dataPath = 'data/cta/cta-links.json', schemaPath = 'data/cta/cta-links.schema.json'] = process.argv;

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const data   = JSON.parse(fs.readFileSync(dataPath,   'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv); // ← ★ uri, uri-reference, date-time 등 활성화

const validate = ajv.compile(schema);
const ok = validate(data);

if (ok) {
  console.log('✅ Schema validation passed');
  process.exit(0);
} else {
  console.error('❌ Schema validation failed:');
  for (const err of validate.errors ?? []) {
    console.error('-', err.instancePath || '(root)', err.message, JSON.stringify(err.params));
  }
  process.exit(1);
}
