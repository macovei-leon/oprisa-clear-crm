
let minTime = new Date('2026-06-17 13:57:00+03:00').getTime();
const baseDateObj = new Date(minTime);
const yyyy = baseDateObj.getFullYear();
const mm = String(baseDateObj.getMonth() + 1).padStart(2, '0');
const dd = String(baseDateObj.getDate()).padStart(2, '0');
const baseDateStr = yyyy + '-' + mm + '-' + dd + 'T00:00:00+03:00';
console.log(baseDateStr);
console.log(new Date(minTime).toString());

