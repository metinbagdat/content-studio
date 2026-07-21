/**
 * Seed + full pipeline from egitim.today blog: "Zamanı Zafere..."
 * Usage: npx tsx --env-file=.env scripts/run-zaman-pipeline.ts
 */

import { prisma } from '../lib/prisma'
import { createPipeline, processPipeline } from '../lib/pipeline'

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

async function main() {
  const hasAi = Boolean(process.env.OPENAI_API_KEY?.trim())
  console.log(`AI mode: ${hasAi ? 'OPENAI/Groq' : 'mock (set OPENAI_API_KEY for LLM)'}`)

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

  console.log('Source:', source.id, source.title.slice(0, 50))

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
    where: { sourceId: source.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, contentType: true, title: true, status: true, content: true },
  })

  console.log('\n=== Derived content (IN_REVIEW) ===\n')
  for (const d of derived) {
    console.log(`--- ${d.contentType} ---`)
    console.log(d.title)
    console.log(d.content.slice(0, 500) + (d.content.length > 500 ? '…' : ''))
    console.log('')
  }

  console.log(`Pipeline ${pipeline.id} COMPLETED. Review: http://localhost:3100/admin/review`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
