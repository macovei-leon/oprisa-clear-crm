
const BASE_DATE = new Date('2026-06-17T00:00:00+03:00');
const totalDays = 7;
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
for (let i = 0; i < totalDays; i++) {
    const d = new Date(BASE_DATE.getTime() + i * 24 * 3600000);
    console.log(dayNames[d.getDay()], monthShortNames[d.getMonth()] + ' ' + d.getDate());
}

