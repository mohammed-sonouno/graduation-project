import { EngineeringProgramsRepository } from '../../repositories/engineeringPrograms.repository.js';

function normalizeStream(stream) {
  const s = String(stream || '').toLowerCase().trim();
  if (['scientific', 'sci', 'علمي', 'علميه'].includes(s)) return 'scientific';
  if (['industrial', 'ind', 'صناعي', 'صناعية'].includes(s)) return 'industrial';
  return null;
}

function isCompatible(programStream, userStream) {
  if (!userStream) return true; // if unknown, don't block; service will mark as uncertain
  if (programStream === 'both') return true;
  return programStream === userStream;
}

function programMatchesInterestTerms(program, terms) {
  if (!terms?.length) return true;
  const kn = (program.keywords || []).map((k) => String(k).toLowerCase());
  const ne = String(program.nameEn || '').toLowerCase();
  const na = String(program.nameAr || '').toLowerCase();
  return terms.some((t) => {
    const tt = String(t).toLowerCase().trim();
    if (!tt) return false;
    return (
      kn.some((k) => k.includes(tt) || tt.includes(k)) ||
      ne.includes(tt) ||
      na.includes(tt)
    );
  });
}

function programThreshold(program) {
  // For ranking: use mid-point when range exists
  // pg NUMERIC can arrive as string depending on configuration; normalize.
  const a = Number(program.minAvgMin);
  const b = Number(program.minAvgMax);
  const hasA = Number.isFinite(a);
  const hasB = Number.isFinite(b);
  if (hasA && hasB) return (a + b) / 2;
  if (hasA) return a;
  if (hasB) return b;
  return null;
}

export class ProgramRecommendationService {
  constructor({
    repo = new EngineeringProgramsRepository(),
    nearMatchDelta = 3,
    catalogCache = null,
    facultySlug = 'an-najah-faculty-engineering'
  } = {}) {
    this.repo = repo;
    this.nearMatchDelta = nearMatchDelta;
    this.catalogCache = catalogCache;
    this.facultySlug = facultySlug;
  }

  async _loadProgramsForRecommendation() {
    const slug = this.facultySlug;
    if (!this.catalogCache) {
      return this.repo.listForRecommendation({ facultySlug: slug });
    }
    const key = `eng_programs:${slug}`;
    const hit = this.catalogCache.get(key);
    if (hit) return hit;
    const rows = await this.repo.listForRecommendation({ facultySlug: slug });
    this.catalogCache.set(key, rows);
    return rows;
  }

  /**
   * @param {{ average: number, stream: string|null, interestTerms?: string[] }} input
   * @returns {Promise<{ user: { average: number, stream: string|null }, safeOptions: any[], competitiveOptions: any[], ineligibleOptions: any[], streamUnspecified: boolean, interestTerms?: string[], interestMatchedNone?: boolean }>}
   */
  async recommend({ average, stream, interestTerms = [] }) {
    const userStream = normalizeStream(stream);
    const programs = await this._loadProgramsForRecommendation();

    let compatible = programs.filter((p) => isCompatible(p.streamType, userStream));

    let interestMatchedNone = false;
    if (interestTerms.length) {
      const narrowed = compatible.filter((p) => programMatchesInterestTerms(p, interestTerms));
      if (narrowed.length === 0) {
        interestMatchedNone = true;
        // No keyword/name overlap in DB — fall back to average-only ranking (honest note in reply).
      } else {
        compatible = narrowed;
      }
    }

    const withThreshold = compatible
      .map((p) => ({ ...p, _threshold: programThreshold(p) }))
      .filter((p) => p._threshold !== null);

    const safe = withThreshold.filter((p) => p._threshold <= average);
    const near = withThreshold.filter((p) => p._threshold > average && p._threshold <= average + this.nearMatchDelta);
    const ineligible = withThreshold.filter((p) => p._threshold > average + this.nearMatchDelta);

    safe.sort((a, b) => (b._threshold - a._threshold) || a.nameEn.localeCompare(b.nameEn));
    near.sort((a, b) => (a._threshold - b._threshold) || a.nameEn.localeCompare(b.nameEn));
    ineligible.sort((a, b) => (a._threshold - b._threshold) || a.nameEn.localeCompare(b.nameEn));

    const cap = 8;
    return {
      user: { average, stream: userStream },
      safeOptions: safe.map(stripInternal),
      competitiveOptions: near.map(stripInternal),
      ineligibleOptions: ineligible.slice(0, cap).map(stripInternal),
      streamUnspecified: !userStream,
      interestTerms: interestTerms.length ? interestTerms : undefined,
      interestMatchedNone: interestTerms.length ? interestMatchedNone : undefined
    };
  }
}

function stripInternal(p) {
  // Remove internal helper field
  const { _threshold, ...rest } = p;
  return rest;
}

