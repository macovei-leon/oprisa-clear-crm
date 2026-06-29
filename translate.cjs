const fs = require('fs');

let content = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

const replaces = [
  [">Mod Vizualizare Depart.<", ">{t.navDeptViewMode || 'Mod Vizualizare Depart.'}<"],
  [">Mesaje<", ">{t.navMessages || 'Mesaje'}<"],
  [">Cum să lucrezi<", ">{t.navHowToWork || 'Cum să lucrezi'}<"],
  [">Cum s? lucrezi<", ">{t.navHowToWork || 'Cum să lucrezi'}<"],
  [">Notificări<", ">{t.navNotifications || 'Notificări'}<"],
  [">Notific?ri<", ">{t.navNotifications || 'Notificări'}<"],
  [">Bază de Date<", ">{t.navDatabase || 'Bază de Date'}<"],
  [">Baz? de Date<", ">{t.navDatabase || 'Bază de Date'}<"],
  [">Istoric Repetitiv<", ">{t.navRepetitiveHistory || 'Istoric Repetitiv'}<"]
];

for (const [from, to] of replaces) {
  if (typeof from === 'string') {
    content = content.split(from).join(to);
  } else {
    content = content.replace(from, to);
  }
}

fs.writeFileSync('src/components/layout/Sidebar.jsx', content);
console.log('Sidebar.jsx updated');
