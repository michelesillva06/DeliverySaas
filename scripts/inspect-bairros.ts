import { db } from '../src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function main() {
  console.log('--- INSPECTOR DE BAIRROS E STORES ---');

  // 1. Checar coleção 'delivery_zones'
  const colDelivery = collection(db, 'delivery_zones');
  const snapDelivery = await getDocs(colDelivery);
  console.log(`Coleção 'delivery_zones': ${snapDelivery.size} documentos`);
  snapDelivery.forEach((doc) => {
    console.log('   delivery_zones doc:', doc.id, doc.data());
  });

  // 2. Checar coleção 'stores'
  const colStores = collection(db, 'stores');
  const snapStores = await getDocs(colStores);
  console.log(`\nColeção 'stores': ${snapStores.size} documentos`);
  for (const storeDoc of snapStores.docs) {
    const data = storeDoc.data();
    console.log(`   Store [${storeDoc.id}] nome: ${data.nome}, slug: ${data.slug}`);
    
    // Subcoleção stores/{storeDoc.id}/deliveryZones
    const subCol = collection(db, 'stores', storeDoc.id, 'deliveryZones');
    const snapSub = await getDocs(subCol);
    console.log(`     subcoleção 'stores/${storeDoc.id}/deliveryZones': ${snapSub.size} documentos`);
    snapSub.forEach((d) => {
      console.log('       subcol doc:', d.id, d.data());
    });

    // Subcoleção stores/{storeDoc.id}/delivery_zones
    const subCol2 = collection(db, 'stores', storeDoc.id, 'delivery_zones');
    const snapSub2 = await getDocs(subCol2);
    console.log(`     subcoleção 'stores/${storeDoc.id}/delivery_zones': ${snapSub2.size} documentos`);
    snapSub2.forEach((d) => {
      console.log('       subcol2 doc:', d.id, d.data());
    });
  }
}

main().catch(console.error);
