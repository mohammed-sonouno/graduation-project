import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({ connectionString: DATABASE_URL });

const LIST_URL = 'https://www.najah.edu/en/academic/undergraduate-programs/by-faculty/';

const TITLE_EXCEPTIONS = new Map([
  ['speech pathology', 'audiology and speech sciences'],
]);

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&hellip;/gi, '...')
    .replace(/&lrm;|&rlm;/gi, '')
    .replace(/&#160;/g, ' ')
    .replace(/&#xA0;/gi, ' ');
}

function stripTags(value) {
  return decodeHtml(String(value || ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeName(value) {
  return decodeHtml(String(value || ''))
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanInline(value) {
  return stripTags(value).replace(/\s+/g, ' ').trim();
}

function extractFirst(html, regex) {
  const match = html.match(regex);
  return match ? cleanInline(match[1]) : null;
}

function extractRowValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<span class="bold">${escaped}<\\/span>[\\s\\S]*?<div class="col-sm-17">([\\s\\S]*?)<\\/div>`,
    'i'
  );
  return extractFirst(html, regex);
}

function extractSectionParagraph(html, sectionId) {
  const regex = new RegExp(
    `<section id="${sectionId}"[\\s\\S]*?<h3[^>]*>[\\s\\S]*?<\\/h3>[\\s\\S]*?<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i'
  );
  return extractFirst(html, regex);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; GraduationProjectBot/1.0; +https://www.najah.edu/)',
    },
  });
  if (response.ok) {
    return response.text();
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const waitMs = 1500 * attempt;
    await sleep(waitMs);
    return fetchText(url, attempt + 1);
  }
  throw new Error(`Failed ${response.status} for ${url}`);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function collectProgramUrls() {
  const html = await fetchText(LIST_URL);
  return [...new Set(
    [...html.matchAll(/href="([^"]*\/academic\/undergraduate-programs\/program\/[^"#]+\/?)"/g)]
      .map((match) => (match[1].startsWith('http') ? match[1] : `https://www.najah.edu${match[1]}`).replace(/(?<!\/)$/, '/'))
  )].filter((url) => !/\/(info-card|details|study-plan|careers|quotes)\/$/.test(url));
}

function buildFacts({
  title,
  titleAr,
  faculty,
  facultyAr,
  duration,
  degree,
  programCode,
  descriptionEn,
  descriptionAr,
  careersEn,
  careersAr,
}) {
  const enParts = [
    `${title} is listed by An-Najah National University under ${faculty}.`,
    duration ? `Duration: ${duration}.` : null,
    degree ? `Degree awarded: ${degree}.` : null,
    programCode ? `Program code: ${programCode}.` : null,
    descriptionEn ? `Official program description: ${descriptionEn}` : null,
    careersEn ? `Official career opportunities section: ${careersEn}` : null,
  ].filter(Boolean);

  const arParts = [
    `تدرج جامعة النجاح الوطنية تخصص ${titleAr || title} ضمن ${facultyAr || faculty}.`,
    duration ? `مدة الدراسة: ${duration}.` : null,
    degree ? `الدرجة الممنوحة: ${degree}.` : null,
    programCode ? `رمز البرنامج: ${programCode}.` : null,
    descriptionAr ? `وصف البرنامج الرسمي: ${descriptionAr}` : descriptionEn ? `الوصف الرسمي المتوفر بالإنجليزية: ${descriptionEn}` : null,
    careersAr ? `فرص العمل المذكورة رسميًا: ${careersAr}` : careersEn ? `فرص العمل المذكورة رسميًا بالإنجليزية: ${careersEn}` : null,
  ].filter(Boolean);

  return {
    factsEn: enParts.join(' '),
    factsAr: arParts.join(' '),
  };
}

async function main() {
  const client = await pool.connect();
  try {
    const majorRows = (await client.query(`
      SELECT m.id, m.name, c.name AS college_name
      FROM majors m
      JOIN colleges c ON c.id = m.college_id
      ORDER BY m.id
    `)).rows;

    const majorsByName = new Map();
    for (const row of majorRows) {
      const key = normalizeName(row.name);
      if (!majorsByName.has(key)) majorsByName.set(key, []);
      majorsByName.get(key).push(row);
    }

    const programUrls = await collectProgramUrls();
    const scraped = await mapLimit(programUrls, 3, async (baseUrl) => {
      const infoEnUrl = `${baseUrl}info-card/`;
      const careersEnUrl = `${baseUrl}careers/`;
      const infoArUrl = infoEnUrl.replace('/en/', '/ar/');
      const careersArUrl = careersEnUrl.replace('/en/', '/ar/');

      const [infoEn, careersEn, infoAr, careersAr] = await Promise.all([
        fetchText(infoEnUrl),
        fetchText(careersEnUrl).catch(() => ''),
        fetchText(infoArUrl).catch(() => ''),
        fetchText(careersArUrl).catch(() => ''),
      ]);

      const title = extractFirst(infoEn, /<div class="f24 dark-blue margin-btm-md">\s*([\s\S]*?)\s*<\/div>/i);
      const titleAr = extractFirst(infoAr, /<div class="f24 dark-blue margin-btm-md">\s*([\s\S]*?)\s*<\/div>/i);

      return {
        baseUrl,
        title,
        titleAr,
        duration: extractFirst(infoEn, /<span class="text-bold">Duration:<\/span>\s*([\s\S]*?)<\/div>/i),
        degree: extractFirst(infoEn, /<span class="text-bold">Degree Awarded:<\/span>\s*([\s\S]*?)<\/div>/i),
        programCode: extractRowValue(infoEn, 'Program Code') || extractRowValue(infoAr, 'رمز البرنامج'),
        faculty: extractRowValue(infoEn, 'Faculty'),
        facultyAr: extractRowValue(infoAr, 'الكلية'),
        facultyWebsite: extractRowValue(infoEn, 'Faculty Website') || extractRowValue(infoAr, 'الموقع الإلكتروني للكلية'),
        descriptionEn: extractRowValue(infoEn, 'Program Description'),
        descriptionAr: extractRowValue(infoAr, 'وصف البرنامج'),
        careersEn: extractSectionParagraph(careersEn, 'career_opportunities'),
        careersAr: extractSectionParagraph(careersAr, 'career_opportunities'),
      };
    });

    let matchedPrograms = 0;
    let unmatchedPrograms = 0;
    let updatedMajorFacts = 0;
    const unmatchedTitles = [];
    const facultyMap = new Map();

    await client.query('BEGIN');

    for (const row of scraped) {
      const titleKeyRaw = normalizeName(row.title);
      const titleKey = TITLE_EXCEPTIONS.get(titleKeyRaw) || titleKeyRaw;
      const matches = majorsByName.get(titleKey) || [];

      if (!matches.length) {
        unmatchedPrograms += 1;
        unmatchedTitles.push(row.title);
        continue;
      }

      matchedPrograms += 1;
      const facts = buildFacts(row);

      for (const match of matches) {
        await client.query(
          `UPDATE major_chat_context
           SET facts_en = $2,
               facts_ar = $3
           WHERE major_id = $1`,
          [match.id, facts.factsEn, facts.factsAr]
        );
        updatedMajorFacts += 1;
      }

      const facultyKey = normalizeName(row.faculty);
      if (facultyKey) {
        if (!facultyMap.has(facultyKey)) {
          facultyMap.set(facultyKey, {
            faculty: row.faculty,
            facultyAr: row.facultyAr,
            facultyWebsite: row.facultyWebsite,
            programs: [],
          });
        }
        facultyMap.get(facultyKey).programs.push(row.title);
      }
    }

    for (const item of facultyMap.values()) {
      const samplePrograms = item.programs.slice().sort().join(', ');
      const overviewEn = `${item.faculty} appears on An-Najah National University's official undergraduate programs pages. The programs linked to this faculty in the official catalogue are: ${samplePrograms}.${item.facultyWebsite ? ` Official faculty website: ${item.facultyWebsite}.` : ''}`;
      const overviewAr = `${item.facultyAr || item.faculty} تظهر في الصفحات الرسمية لبرامج البكالوريوس في جامعة النجاح الوطنية. التخصصات المرتبطة بهذه الكلية في الدليل الرسمي هي: ${samplePrograms}.${item.facultyWebsite ? ` الموقع الرسمي للكلية: ${item.facultyWebsite}.` : ''}`;

      await client.query(
        `UPDATE faculty_qa fq
         SET answer_en = $2,
             answer_ar = $3,
             updated_at = NOW()
         FROM faculty_profiles fp
         WHERE fq.faculty_id = fp.id
           AND fp.official_name_en = $1
           AND fq.normalized_intent = 'FACULTY_PROGRAMS_BASELINE'`,
        [item.faculty, overviewEn, overviewAr]
      );
    }

    await client.query('COMMIT');

    console.log(JSON.stringify({
      officialProgramUrls: programUrls.length,
      matchedPrograms,
      unmatchedPrograms,
      updatedMajorFacts,
      facultyOverviewsUpdated: facultyMap.size,
      unmatchedTitles: unmatchedTitles.slice(0, 20),
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
