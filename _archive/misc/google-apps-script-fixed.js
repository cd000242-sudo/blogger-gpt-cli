/** ===================== 공용 ===================== **/

const SHEET_NAME = 'codes';                     // 코드 저장 시트명

const HEADER = ['code','type','used','user','usedAt','expiresAt','life']; // 스키마



function json(obj) {

  return ContentService.createTextOutput(JSON.stringify(obj))

    .setMimeType(ContentService.MimeType.JSON);

}

function nowISO() { return new Date().toISOString(); }

function addDaysISO(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d.toISOString(); }



/** ===================== 토큰/설정 ===================== **/

function getAdminToken_() {

  return (PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '').trim();

}

function readToken_(e, body) {

  const h = (e && e.headers) || {};

  return (h['x-admin-token'] || h['X-Admin-Token'] || (body && body.adminToken) || '').trim();

}



/** ===================== DB 고정: 스크립트 속성 DB_SHEET_ID 사용 ===================== **/

function dbSS_() {

  const props = PropertiesService.getScriptProperties();

  const id = props.getProperty('DB_SHEET_ID');

  if (id) return SpreadsheetApp.openById(id);



  // 없으면 현재 바운드/새로 생성한 시트를 최초 1회 고정

  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('license-db');

  props.setProperty('DB_SHEET_ID', ss.getId());

  return ss;

}



/** ===================== 시트 유틸 ===================== **/

function sheet_() {

  const ss = dbSS_();

  const s = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);



  // 최초 헤더

  if (s.getLastRow() === 0) {

    s.appendRow(HEADER);

    return s;

  }

  // 헤더 보정

  const first = s.getRange(1,1,1,s.getLastColumn()).getValues()[0].filter(Boolean);

  if (first.length !== HEADER.length || HEADER.some((h,i)=>first[i] !== h)) {

    const all = s.getDataRange().getValues(); // [header,...rows]

    const headIdx = {};

    first.forEach((h,i)=> headIdx[h] = i);

    const rows = all.slice(1).map(r=>{

      const obj = {}; first.forEach((h,i)=> obj[h] = r[i]);

      return HEADER.map(h => obj[h] ?? '');

    });

    s.clear();

    s.getRange(1,1,1,HEADER.length).setValues([HEADER]);

    if (rows.length) s.getRange(2,1,rows.length,HEADER.length).setValues(rows);

  }

  return s;

}



function findRowByCode_(s, code) {

  const vals = s.getDataRange().getValues();

  for (let i=1;i<vals.length;i++){

    if (vals[i][0] === code) return { row: i+1, vals: vals[i] };

  }

  return null;

}



function listCodes_() {

  const s = sheet_();

  const rows = s.getDataRange().getValues().slice(1).filter(r=>r[0]);

  return rows.map(r=>({ code:r[0], type:r[1], used:!!r[2], user:r[3], usedAt:r[4], expiresAt:r[5], life:r[6] }));

}



/** ===================== 발급/사용 로직 ===================== **/

function issueCodes_(type, count, prefix) {

  if (!['TRIAL7','PAID30','LIFE'].includes(type)) throw new Error('bad_type');

  const s = sheet_(); const out = [];

  const n = Math.max(1, Number(count||1)|0);

  const pf = (prefix ? String(prefix).trim() : '');

  for (let i=0;i<n;i++){

    const code = (pf ? pf + '-' : '') + Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();

    s.appendRow([code, type, '', '', '', '', '']);

    out.push({ code, type });

  }

  return out;

}



function redeemCode_(code, who) {

  const s = sheet_(); const f = findRowByCode_(s, code);

  if (!f) throw new Error('code_not_found');

  const r = f.row, v = f.vals.slice(); // [code,type,used,user,usedAt,expiresAt,life]

  let type=v[1], used=!!v[2], user=v[3]||'', usedAt=v[4]||'', expiresAt=v[5]||'', life=v[6]||'';



  if (type === 'TRIAL7') {

    if (!used) {

      used = true; user = who || user; usedAt = usedAt || nowISO(); expiresAt = addDaysISO(new Date(), 7);

    }

  } else if (type === 'PAID30') {

    const base = expiresAt ? new Date(expiresAt) : new Date();

    expiresAt = addDaysISO(base, 30);

    used = true; user = who || user; if (!usedAt) usedAt = nowISO();

  } else if (type === 'LIFE') {

    life = 'Y'; expiresAt = ''; used = true; user = who || user; if (!usedAt) usedAt = nowISO();

  } else {

    throw new Error('unsupported_type');

  }



  s.getRange(r,1,1,HEADER.length).setValues([[v[0], type, used, user, usedAt, expiresAt, life]]);

  return { code:v[0], type, used, user, usedAt, expiresAt, life };

}



function codeInfo_(code) {

  const s = sheet_(); const f = findRowByCode_(s, code);

  if (!f) throw new Error('code_not_found');

  const r = f.vals;

  return { code:r[0], type:r[1], used:!!r[2], user:r[3], usedAt:r[4], expiresAt:r[5], life:r[6] };

}



/** ===================== 디버그/운영 보조 ===================== **/

function dbInfo_() {

  const ss = dbSS_();

  const s = sheet_();

  const rows = s.getDataRange().getValues();

  return {

    ok: true,

    scriptId: ScriptApp.getScriptId(),

    spreadsheetId: ss.getId(),

    spreadsheetUrl: ss.getUrl(),

    sheetName: s.getName(),

    totalRows: Math.max(0, rows.length - 1),

    first5Codes: rows.slice(1, 6).map(r => r[0])

  };

}



/** ===================== HTTP 진입점 ===================== **/

function doPost(e) {

  try {

    const bodyStr = e && e.postData && e.postData.contents ? e.postData.contents : '{}';

    const body = JSON.parse(bodyStr || '{}');

    const action = (body.action || '').trim();



    // 관리자 보호 액션

    const adminActions = new Set(['list','issue','revoke','dbinfo']);

    if (adminActions.has(action)) {

      const reqToken = readToken_(e, body);

      const serverToken = getAdminToken_();

      if (!serverToken || reqToken !== serverToken) {

        return json({ ok:false, error:'unauthorized' });

      }

    }



    // 관리자/운영

    if (action === 'list')    return json({ ok:true, data:listCodes_() });

    if (action === 'issue')   return json({ ok:true, created: issueCodes_(body.type, body.count, body.prefix) });

    if (action === 'revoke') {

      const s = sheet_(); const f = findRowByCode_(s, body.code);

      if (!f) return json({ ok:true, revoked:false });

      s.deleteRow(f.row); return json({ ok:true, revoked:true });

    }

    if (action === 'dbinfo')  return json(dbInfo_());  // 디버그용



    // 공개(툴)

    if (action === 'status') {

      if (!body.code) throw new Error('code_required');

      return json({ ok:true, info: codeInfo_(String(body.code)) });

    }

    if (action === 'activate') {

      if (!body.code) throw new Error('code_required');

      if (!body.who)  throw new Error('who_required');

      const info = redeemCode_(String(body.code), String(body.who));

      return json({ ok:true, info });

    }



    return json({ ok:false, error:'unknown_action' });

  } catch (err) {

    Logger.log('doPost error: %s', err && err.stack || err);

    return json({ ok:false, error:String(err && err.message || err) });

  }

}

// ⬇️ doGet 함수를 doPost 함수 밖으로 이동했습니다!
function doGet(e) {

  try {

    const path = (e.parameter && e.parameter.path) || (e.pathInfo) || '';

    

    if (path === 'time' || !path) {

      return ContentService.createTextOutput(JSON.stringify({

        timestamp: Date.now()

      }))

      .setMimeType(ContentService.MimeType.JSON);

    }

    

    return ContentService.createTextOutput(JSON.stringify({

      ok: false,

      error: 'unknown_path'

    }))

    .setMimeType(ContentService.MimeType.JSON);

    

  } catch (err) {

    Logger.log('doGet error: %s', err && err.stack || err);

    return ContentService.createTextOutput(JSON.stringify({

      ok: false,

      error: String(err && err.message || err)

    }))

    .setMimeType(ContentService.MimeType.JSON);

  }

}






