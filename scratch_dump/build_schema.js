const fs = require('fs'); 
const dataText = fs.readFileSync('C:/Users/user/.gemini/antigravity-ide/brain/4ebbe18a-a5b8-43d9-87df-1d2dd390c2b2/.system_generated/steps/419/output.txt', 'utf8');
const resultStr = JSON.parse(dataText).result;
const jsonStr = resultStr.split('<untrusted-data-2fd20437-15ab-445f-b08f-2631340a0657>')[2].trim().split('</untrusted-data-2fd20437-15ab-445f-b08f-2631340a0657>')[0].trim();
const data = JSON.parse(jsonStr); 
let sql = ''; 
const tables = [...new Set(data.map(d => d.table_name))]; 
for(let table of tables) { 
  sql += `CREATE TABLE IF NOT EXISTS public.${table} (\n`; 
  const cols = data.filter(d => d.table_name === table); 
  const colDefs = cols.map(c => `  ${c.column_name} ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`.trimRight()); 
  sql += colDefs.join(',\n') + '\n);\n\n'; 
} 
fs.writeFileSync('C:/Users/user/Desktop/oprisa-clear-crm/scratch_dump/all_tables.sql', sql); 
console.log('Done');
