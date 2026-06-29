const fs = require('fs');

const escapeString = (val) => val === null ? 'NULL' : (typeof val === 'string' ? "'" + val.replace(/'/g, "''") + "'" : (typeof val === 'object' ? "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb" : val));

const resultStr = JSON.parse(fs.readFileSync('C:/Users/user/.gemini/antigravity-ide/brain/4ebbe18a-a5b8-43d9-87df-1d2dd390c2b2/.system_generated/steps/649/output.txt', 'utf8')).result;
const match = resultStr.match(/\n<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data-[^>]+>\n/);
if (!match) throw new Error("Boundary not found");
const jsonStr = match[1].trim();
const rawData = JSON.parse(jsonStr);
const allData = rawData[0].data;

let finalSql = '';

Object.keys(allData).forEach(tableName => {
  const data = allData[tableName];
  if(!data || data.length === 0) return;
  const keys = Object.keys(data[0]); 
  let sql = ''; 
  data.forEach(row => { 
    sql += `INSERT INTO public.${tableName} (${keys.join(', ')}) VALUES (${keys.map(k => escapeString(row[k])).join(', ')}) ON CONFLICT DO NOTHING;\n`; 
  }); 
  finalSql += sql + '\n';
});

fs.writeFileSync('C:/Users/user/Desktop/oprisa-clear-crm/scratch_dump/insert_tables2.sql', finalSql);
console.log('Done');
