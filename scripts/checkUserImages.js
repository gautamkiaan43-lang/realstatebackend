const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const props = await prisma.property.findMany({
    where: {
      OR: [
        { title: { contains: 'Hotel' } },
        { title: { contains: 'MARINA DI GROSSETO' } },
        { title: { contains: 'PISTOIA' } },
        { title: { contains: 'SEMPRONIANO' } },
        { title: { contains: 'CASALE DA COSTRUIRE' } }
      ]
    }
  });
  props.forEach(p => console.log(p.title, '->', p.media.substring(0, 70)));
  
  // Let's also find all missing images by checking size
  const allProps = await prisma.property.findMany();
  let missing = [];
  allProps.forEach(p => {
      let mediaArr = [];
      try {
          mediaArr = JSON.parse(p.media);
      } catch(e){}
      
      if(mediaArr && mediaArr.length > 0) {
          const url = mediaArr[0].url;
          if(url.startsWith('/images/')) {
              const localPath = '../../frontend_23may/public' + url;
              try {
                  const size = fs.statSync(__dirname + '/' + localPath).size;
                  if(size < 30000) { // likely placeholder
                      missing.push({title: p.title, url, size});
                  }
              } catch(e) {
                  missing.push({title: p.title, url, error: 'File not found'});
              }
          }
      }
  });
  
  console.log('\n--- Missing or small placeholder images ---');
  console.log('Count:', missing.length);
  missing.forEach(m => console.log(m.title, m.url, m.size || m.error));
}

check().finally(() => prisma.$disconnect());
