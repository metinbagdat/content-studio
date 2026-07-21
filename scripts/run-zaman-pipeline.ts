/**
 * Seed + full pipeline from egitim.today blog: "Zamanı Zafere..."
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/run-zaman-pipeline.ts
 *   npx tsx --env-file=.env scripts/run-zaman-pipeline.ts --fresh   # eski IN_REVIEW sil, yeniden üret
 */

import { prisma } from '../lib/prisma'
import { createPipeline, processPipeline } from '../lib/pipeline'
import { llmModeLabel } from '../lib/ai/llmClient'

const TITLE = 'Zamanı Zafere Dönüştürmek: Planlama Bilinciyle Geleceği İnşa Etmek'

const CONTENT = `
## Zamanı Zafere Dönüştürmek

Zaman, durdurulamayan bir nehir gibi akıp gidiyor. İster ona sarılmaya çalışın, ister onunla savaşın; her saniye, geri dönüşü olmayan bir yolculuğa çıkarıyor bizi. Peki bu yolculukta ne yapıyoruz? Çoğu zaman, zamanın içinde sürükleniyor, onun akışına kapılıp gidiyoruz. Oysa, zamanı sadece yaşamak değil, onu inşa etmek de mümkün.

Gelin, zamanı bir düşman gibi değil, bir müttefik gibi görmeyi deneyelim. Bu perspektif, sadece iş hayatında değil; ailemizde, ilişkilerimizde ve kendi iç dünyamızda nasıl bir dönüşüm yaratabileceğine odaklanıyor.

## Zamanın Doğası: Durduramazsın, Ama Yönlendirebilirsin

Bir saniyeyi durdurma gücümüz yok. Saatin yelkovanına ne kadar sımsıkı sarılsak da, dakikalar ilerlemeye devam eder. Zamanın akışını değiştiremesek de, içinde nereye gideceğimize karar verebiliriz.

Zaman, tüketilecek bir boşluk değil; ekilecek bir tarladır. Bugün ektiğimiz düşünceler, alışkanlıklar ve eylemler, yarının hasadını belirler. Planlama, zamanı anlamlı kılmanın aracıdır.

## Gelecek Endişesi mi, Planlama Bilinci mi?

"Bugün, geleceğimi inşa etmek için ne yaptım?" sorusu, kaygıyı eyleme dönüştürür. Planlama bilinci, geleceği pasif beklemek değil; onu aktif olarak şekillendirmektir.

## Gürültünün Kalabalığında Zamanı Duymak

Gürültü yalnızca dışarıdaki ses değildir: bildirimler, e-postalar, iç sesler... Planlama, hangi saatlerde tek işe odaklanacağımıza karar verdiğimizde gürültüyü arka plana iter.

## Egonun Gölgesinden Çıkmak

Her yaptığımız iş, kendimize ayırdığımız zamandır. İşi kaliteli yapmak, potansiyelimize duyduğumuz saygının ifadesidir.

## "Ne Öğreneceğim" Değil, "Hangi Saatte, Ne Kadar Kaliteli Var Olacağım"

Öğrenmek, bilgiye değil ona verdiğimiz kaliteli zamana bağlıdır. Planlama, o "kalma" süresini belirlememize yardımcı olur.

## Öz-Yatırım Bilinci

Zamanı planlamak, kendimize yaptığımız en büyük yatırımdır. Her planlı an, gelecekteki pişmanlıklardan korur; çünkü o anı bilinçli yaşamışızdır.

Kaynak: https://www.egitim.today/blog/zamani-zafere-donusturmek
`.trim()

const fresh = process.argv.includes('--fresh')

async function main() {
  console.log(`AI mode: ${llmModeLabel()}`)
  if (llmModeLabel().startsWith('mock')) {
    console.log('  Groq (önerilen): GROQ_API_KEY=gsk_...  https://console.groq.com/keys')
  }

  const existing = await prisma.contentSource.findFirst({
    where: { title: TITLE },
  })

  const source =
    existing ??
    (await prisma.contentSource.create({
      data: {
        title: TITLE,
        content: CONTENT,
        category: 'motivasyon',
        tags: ['zaman', 'planlama', 'egitim.today', 'blog'],
      },
    }))

  if (fresh) {
    const removed = await prisma.derivedContent.deleteMany({
      where: { sourceId: source.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
    })
    console.log(`--fresh: ${removed.count} eski taslak silindi`)
  }

  console.log('Source:', source.id)

  const batchStart = new Date()

  const pipeline = await createPipeline(source.id, {
    platforms: ['TWITTER', 'LINKEDIN'],
    includeMarchSong: true,
    marchStyle: 'motivational',
    musicGenre: 'pop',
    podcastDuration: 10,
    videoStyle: 'educational',
  })

  await processPipeline(pipeline.id)

  const derived = await prisma.derivedContent.findMany({
    where: { sourceId: source.id, createdAt: { gte: batchStart } },
    orderBy: { contentType: 'asc' },
    select: { id: true, contentType: true, title: true, status: true, content: true, metadata: true },
  })

  console.log(`\n=== Bu batch: ${derived.length} içerik (${derived[0]?.metadata && typeof derived[0].metadata === 'object' && (derived[0].metadata as { mock?: boolean }).mock ? 'mock' : 'LLM'}) ===\n`)
  for (const d of derived) {
    console.log(`--- ${d.contentType} ---`)
    console.log(d.content.slice(0, 600) + (d.content.length > 600 ? '…' : ''))
    console.log('')
  }

  const total = await prisma.derivedContent.count({ where: { sourceId: source.id } })
  if (total > derived.length) {
    console.log(`Not: Toplam ${total} kayıt var (eski batch'ler). Temizlemek için: --fresh`)
  }

  console.log(`Pipeline ${pipeline.id} COMPLETED → http://localhost:3100/admin/review`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
