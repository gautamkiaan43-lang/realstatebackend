const fs = require('fs');

async function check() {
  try {
    const r = await fetch('https://toscointermedia.com/immobili');
    const t = await r.text();
    console.log("Includes TIRLI?", t.includes('TIRLI'));
    console.log("Links:", (t.match(/href="([^"]+)"/g) || []).filter(x => x.includes('immobili')).slice(0, 10));
  } catch (e) {
    console.error(e);
  }
}
check();
