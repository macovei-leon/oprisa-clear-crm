const fs = require('fs');

const escapeString = (val) => val === null ? 'NULL' : (typeof val === 'string' ? "'" + val.replace(/'/g, "''") + "'" : (typeof val === 'object' ? "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb" : val));

const buildInserts = (filePath, tableName, boundary) => { 
  const resultStr = JSON.parse(fs.readFileSync(filePath, 'utf8')).result; 
  const jsonStr = resultStr.split(boundary)[2].trim().split('</' + boundary.substring(1))[0].trim(); 
  const data = JSON.parse(jsonStr); 
  if(data.length === 0) return ''; 
  const excludeColumns = ['confirmed_at', 'is_anonymous'];
  const keys = Object.keys(data[0]).filter(k => !excludeColumns.includes(k)); 
  let sql = ''; 
  data.forEach(row => { 
    sql += `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(k => escapeString(row[k])).join(', ')}) ON CONFLICT DO NOTHING;\n`; 
  }); 
  return sql; 
}; 

const buildIdentities = () => {
  const data = JSON.parse(fs.readFileSync('C:/Users/user/Desktop/oprisa-clear-crm/scratch_dump/identities.json', 'utf8'));
  if(data.length === 0) return '';
  const excludeColumns = ['email'];
  const keys = Object.keys(data[0]).filter(k => !excludeColumns.includes(k)); 
  let sql = ''; 
  data.forEach(row => { 
    sql += `INSERT INTO auth.identities (${keys.join(', ')}) VALUES (${keys.map(k => escapeString(row[k])).join(', ')}) ON CONFLICT DO NOTHING;\n`; 
  }); 
  return sql;
};

const authUsersSql = buildInserts('C:/Users/user/.gemini/antigravity-ide/brain/4ebbe18a-a5b8-43d9-87df-1d2dd390c2b2/.system_generated/steps/518/output.txt', 'auth.users', '<untrusted-data-53e94435-51e4-4558-bbda-d5bd09f059fe>'); 
const authIdSql = buildIdentities();

fs.writeFileSync('C:/Users/user/Desktop/oprisa-clear-crm/scratch_dump/insert_auth.sql', authUsersSql + '\n' + authIdSql);
console.log('Done');
