// Idempotent: safe to run any number of times.
// Uses its own client because src/db/index.ts is server-only.
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { lessons, programmes } from "./schema";

config({ path: ".env.local" });

// CC0 sample clip (MDN). Swap for real lesson videos later.
const PLACEHOLDER_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

type SeedLesson = [titleEn: string, titleAr: string, minutes: number];

const catalogue: {
  slug: string;
  titleEn: string;
  titleAr: string;
  description: string;
  position: number;
  lessons: SeedLesson[];
}[] = [
  {
    slug: "arabic",
    titleEn: "Arabic Programme",
    titleAr: "البرنامج العربي",
    description: "Read, write and understand Arabic, starting from the alphabet.",
    position: 1,
    lessons: [
      ["The Arabic alphabet", "الحروف الهجائية", 12],
      ["Short vowels", "الحركات القصيرة", 14],
      ["Sukoon and shaddah", "السكون والشدة", 11],
      ["Tanween", "التنوين", 10],
      ["Connecting and separating letters", "وصل الحروف وفصلها", 15],
      ["The sun and moon letters", "اللام الشمسية واللام القمرية", 13],
    ],
  },
  {
    slug: "precision",
    titleEn: "Precision in Knowledge",
    titleAr: "الدقة في العلم",
    description: "A structured path through the classical Islamic sciences.",
    position: 2,
    lessons: [
      ["Introduction to Aqeedah", "مدخل إلى العقيدة", 18],
      ["Introduction to Fiqh", "مدخل إلى الفقه", 17],
      ["Introduction to Tafseer", "مدخل إلى التفسير", 16],
      ["Introduction to Hadeeth", "مدخل إلى الحديث", 19],
      ["Introduction to Seerah", "مدخل إلى السيرة", 15],
      ["Introduction to Language and Logic", "مدخل إلى علوم اللغة والمنطق", 14],
    ],
  },
  {
    slug: "usool",
    titleEn: "Foundations of Knowledge",
    titleAr: "أصول العلم",
    description: "The manners and principles every student should begin with.",
    position: 3,
    lessons: [
      ["Sincerity in seeking knowledge", "الإخلاص في طلب العلم", 9],
      ["Patience in study", "الصبر في الطلب", 8],
      ["Manners with the teacher", "الأدب مع المعلم", 10],
      ["Acting upon knowledge", "العمل بالعلم", 9],
      ["Gradual progression", "التدرج في الطلب", 8],
      ["Avoiding argumentation", "ترك الجدال", 7],
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL_DIRECT or DATABASE_URL in .env.local");

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    for (const p of catalogue) {
      const { lessons: programmeLessons, ...fields } = p;
      const [row] = await db
        .insert(programmes)
        .values(fields)
        .onConflictDoUpdate({
          target: programmes.slug,
          set: {
            titleEn: fields.titleEn,
            titleAr: fields.titleAr,
            description: fields.description,
            position: fields.position,
          },
        })
        .returning({ id: programmes.id });

      await db
        .insert(lessons)
        .values(
          programmeLessons.map(([titleEn, titleAr, minutes], i) => ({
            programmeId: row.id,
            titleEn,
            titleAr,
            videoUrl: PLACEHOLDER_VIDEO,
            durationSec: minutes * 60,
            position: i + 1,
            isPreview: i === 0,
          })),
        )
        .onConflictDoUpdate({
          target: [lessons.programmeId, lessons.position],
          set: {
            titleEn: sql`excluded.title_en`,
            titleAr: sql`excluded.title_ar`,
            videoUrl: sql`excluded.video_url`,
            durationSec: sql`excluded.duration_sec`,
            isPreview: sql`excluded.is_preview`,
          },
        });
    }

    const [{ p }] = await db.execute<{ p: number }>(sql`select count(*)::int as p from programmes`);
    const [{ l }] = await db.execute<{ l: number }>(sql`select count(*)::int as l from lessons`);
    console.log(`${p} programmes, ${l} lessons`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
