import { usePolling } from '../usePolling';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Item { title: string; detail: string }
interface ApprovedEntrySummary {
  asset_id: string;
  class: string;
  revision: number;
  path: string;
  sha256: string;
  bytes: number;
  dims: string;
  note: string;
}
interface BaseReleaseSummary {
  id: string;
  generation: number;
  minClient: string;
  notes: string;
  fileCount: number;
  totalBytes: number;
  approvedArtCount: number;
  approvedEntries: ApprovedEntrySummary[];
}
interface ReviewCatalogItem {
  id: string;
  groupId: string;
  groupTitle: string;
  subGroupId: string;
  subGroupTitle: string;
  sortOrder: number;
  category:
    | 'STEPS'
    | 'BANNERS'
    | 'PORTRAITS'
    | 'CHIBI_ATLAS'
    | 'CONCEPT_SHEETS'
    | 'BACKGROUNDS'
    | 'STILLS_CG'
    | 'ICONS_WEAPONS'
    | 'UI_BRAND_STORE'
    | 'AUDIO_SFX_BGM'
    | 'VOICES'
    | 'EVIDENCE_SCREENS';
  badge: string;
  origin: 'd30_new' | 'prev_approved';
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneJump?: string;
  targetPath: string;
  dims?: string;
  bytes?: number;
  sha256?: string;
}

interface Progress {
  generatedAt: string;
  summary: { total: number; done: number; partial: number; missing: number };
  baseRelease?: BaseReleaseSummary;
  roadmap: { n: number; area: string; status: string; detail: string }[];
  decisions: { id: string; when: string; what: string; note: string }[];
  commits: { sha: string; at: string; subject: string }[];
  screens: { file: string; caption: string }[];
  storeAssets?: { file: string; label: string; kind: 'brand' | 'screenshot' }[];
  reviewCatalog?: ReviewCatalogItem[];
  now: Item[];
  next: Item[];
  blockedOnOwner: Item[];
  ideas: { from: string; date: string; text: string; status: string }[];
  // docs/DEV_TRACKER.json (spread into progress.json by tools/build_progress.ts)
  reviewedAt?: string;
  sourceCommit?: string;
  currentAssignment?: { id: string; status: string; nextProposed: string; workflow: string };
  flow?: string;
  phases?: { n: number; title: string; status: string; done: string[]; remaining: string[] }[];
  capabilities?: { id: string; title: string; taskStatus: string; implementationStatus: string; implemented: string; evidenceIds: string[]; blockerIds: string[] }[];
  evidence?: { id: string; level: string; result: string; verifiedAt: string | null }[];
  blockers?: { id: string; level: string; title: string; detail: string }[];
  media?: { kind: string; drawn: string; inGame: string; missing: string }[];
  checks?: { date: string; commit: string; items: { name: string; result: string; detail: string }[] };
}

/** package code status -> badge class; acceptance stays separate (open blockers) */
const codeBadge = (s: string): string => (s === 'COMPLETE' ? 'ok' : s === 'PARTIAL' ? 'warn' : 'bad');
const checkBadge = (r: string): string => (r === 'pass' ? 'ok' : r === 'partial' ? 'warn' : r === 'fail' ? 'bad' : 'info');
interface Note { id: number; area: string; kind: string; body: string; status: string; resolution: string; created_by: string; created_at: string; updated_by: string | null }

const TABS = ['Onay & Denetim Merkezi (707 Eser)', 'Overview', 'Live preview', 'Store & Brand Kit', 'Screens', 'Feedback'] as const;
type Tab = (typeof TABS)[number];
const AREAS = ['General', 'Splash & Studio', 'Title', 'Prologue (120s)', 'Story', 'Battle', 'Patch Wait & Restart', 'Company hub', 'Summon', 'Roster', 'Mail', 'Shop', 'Account', 'Chapters', 'Control Center', 'Economy', 'Art direction'];

const REVIEW_GROUPS: { id: string; shortLabel: string; fullTitle: string }[] = [
  { id: 'G01', shortLabel: 'Grup 1: Marka & Mağaza (16)', fullTitle: 'Grup 1: Marka, Açılış & Google Play Mağaza Vitrini' },
  { id: 'G02', shortLabel: 'Grup 2: Prolog & Bölüm CG (26)', fullTitle: 'Grup 2: Prolog & Bölüm 1–7 Sinematik CG Sahneleri' },
  { id: 'G03', shortLabel: 'Grup 3: 25 Kahraman Paketi (166)', fullTitle: 'Grup 3: 25 Oynanabilir Kahraman (Konsept + Chibi + 4 Portre + İmza Silah)' },
  { id: 'G04', shortLabel: 'Grup 4: Antagonist & 7 Boss (44)', fullTitle: 'Grup 4: Ana Antagonistler & 7 Part I Boss\'u (Bölüm Sırasıyla Tam Paket)' },
  { id: 'G05', shortLabel: 'Grup 5: 22 Düşman Birimi (42)', fullTitle: 'Grup 5: 22 Düşman Birimi (Bölüm 1–7 Sırasıyla Konsept + Chibi Yan Yana)' },
  { id: 'G06', shortLabel: 'Grup 6: Harita & 47 Mekan (47)', fullTitle: 'Grup 6: Dünya Haritası & 47 Mekan / Savaş Alanı Arka Planı (Bölüm Sırasıyla)' },
  { id: 'G07', shortLabel: 'Grup 7: 16 Gacha Banner (16)', fullTitle: 'Grup 7: 16 Gacha Çağrı Bannerı (Kalıcı & Oath #1–#7 Karakter + Silah Çiftleri)' },
  { id: 'G08', shortLabel: 'Grup 8: UI Kit, İkon & GIF (144)', fullTitle: 'Grup 8: UI Ekran Plakaları, 9-Slice UI Kit, İkon Setleri & Animasyon GIF\'leri' },
  { id: 'G09', shortLabel: 'Grup 9: Müzik, SFX & 116 Ses (139)', fullTitle: 'Grup 9: Ses Efektleri (16 SFX), Müzik (7 BGM) & 116 Seslendirme (Sahne Sırasıyla)' },
  { id: 'G10', shortLabel: 'Grup 10: D-30 & Kanıt Ekranları (67)', fullTitle: 'Grup 10: D-30 Mimari Teslimatlar (§4.1–§4.7) & Canlı Oyun Kanıt Ekranları' },
  { id: 'ALL', shortLabel: 'Tüm Gruplar Bir Arada (707)', fullTitle: 'Tüm Gruplar (Grup 1 → Grup 10 Bir Arada)' }
];

/** Where the browser build of the game lives: the sibling Worker of this admin, or the local dev server. */
function gameUrl(scene = '', target: 'worker' | 'vite' = 'worker'): string {
  const h = window.location.hostname;
  const port = target === 'vite' ? '5173' : '8787';
  const base = h === '127.0.0.1' || h === 'localhost' ? `http://127.0.0.1:${port}/` : `${window.location.protocol}//${h.replace(/^uomd-admin/, 'uomd-game')}/`;
  return scene ? `${base}?preview_scene=${encodeURIComponent(scene)}` : base;
}

export function Development({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [tab, setTab] = useState<Tab>('Onay & Denetim Merkezi (707 Eser)');
  const readProgress = useCallback(async (signal: AbortSignal): Promise<Progress> => {
    const r = await fetch(`/dev/progress.json?t=${Date.now()}`, { cache: 'no-store', signal });
    if (!r.ok) throw new Error('progress.json missing');
    return r.json() as Promise<Progress>;
  }, []);
  const { data: p, error: err } = usePolling(readProgress);
  const [area, setArea] = useState('Art direction');
  const [jumpScene, setJumpScene] = useState('fresh_flow');
  if (err) return <ErrorNotice error={err} />;
  if (!p) return <p>Loading development data…</p>;
  const catalog = p.reviewCatalog ?? [];
  return (
    <>
      <header className="page">
        <h2>Development &amp; Kapsamlı Onay Merkezi</h2>
        <span className="badge ok">D-30 §4.1–§4.7 Tamamlandı · {catalog.length} Doğrulanmış Eser &amp; Adım</span>
        <span className="badge">{packageSummary(p)}</span>
      </header>
      <div className="row" role="tablist" style={{ flexWrap: 'wrap', gap: 6 }}>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} className={`btn${t === tab ? ' primary' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Onay & Denetim Merkezi (707 Eser)' ? (
        <D30ReviewCenter
          catalog={catalog}
          me={me}
          say={say}
          onJumpPreview={(sc) => {
            setJumpScene(sc);
            setTab('Live preview');
          }}
        />
      ) : null}
      {tab === 'Overview' ? <Overview p={p} onOpenReview={() => setTab('Onay & Denetim Merkezi (707 Eser)')} /> : null}
      {tab === 'Live preview' ? <Preview initialScene={jumpScene} /> : null}
      {tab === 'Store & Brand Kit' ? <StoreKit p={p} /> : null}
      {tab === 'Screens' ? <Screens p={p} onNote={(a) => { setArea(a); setTab('Feedback'); }} /> : null}
      {tab === 'Feedback' ? <Feedback me={me} say={say} area={area} setArea={setArea} /> : null}
    </>
  );
}

interface D30DecisionState {
  status: 'approved' | 'rejected' | 'pending';
  comment: string;
  noteId?: number;
  updatedAt?: string;
}

function parseD30Notes(notes: Note[]): Record<string, D30DecisionState> {
  const out: Record<string, D30DecisionState> = {};
  const sorted = [...notes].sort((a, b) => a.id - b.id);
  for (const n of sorted) {
    const m = /^\[D30:([a-z0-9_-]+)\]\s*(?:ONAYLANDI|REDDEDİLDİ|REVİZE)?\s*[:—-]?\s*(.*)$/i.exec(n.body);
    if (!m) continue;
    const itemId = m[1]!;
    const rawRest = m[2]?.trim() ?? '';
    const noteMatch = /\|\s*Not:\s*(.*)$/i.exec(rawRest);
    const comment = noteMatch ? noteMatch[1]!.trim() : '';
    const isRejected = n.kind === 'change_request' || n.body.includes('REDDEDİLDİ') || (n.status === 'open' && n.kind !== 'approved');
    out[itemId] = {
      status: isRejected ? 'rejected' : 'approved',
      comment,
      noteId: n.id,
      updatedAt: n.created_at
    };
  }
  return out;
}

function D30ReviewCenter({
  catalog,
  me,
  say,
  onJumpPreview
}: {
  catalog: ReviewCatalogItem[];
  me: Me;
  say: (m: string) => void;
  onJumpPreview: (scene: string) => void;
}): ReactNode {
  const [activeGroup, setActiveGroup] = useState<string>('G01');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'd30_new' | 'prev_approved'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('ALL');
  const [search, setSearch] = useState('');
  const [collapsedSubs, setCollapsedSubs] = useState<Record<string, boolean>>({});
  const [decisions, setDecisions] = useState<Record<string, D30DecisionState>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [loadedDims, setLoadedDims] = useState<Record<string, string>>({});
  const [retryMap, setRetryMap] = useState<Record<string, number>>({});
  const [lightboxItem, setLightboxItem] = useState<ReviewCatalogItem | null>(null);
  const [checkerBg, setCheckerBg] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDecisions = useCallback((): void => {
    api<{ notes: Note[] }>('/dev/notes')
      .then((r) => {
        const parsed = parseD30Notes(r.notes);
        setDecisions(parsed);
        setDraftComments((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(parsed)) {
            if (next[k] === undefined && v.comment) next[k] = v.comment;
          }
          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const recordDecision = async (item: ReviewCatalogItem, newStatus: 'approved' | 'rejected'): Promise<void> => {
    setSavingId(item.id);
    const comment = (draftComments[item.id] ?? decisions[item.id]?.comment ?? '').trim();
    const label = newStatus === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ';
    const body = `[D30:${item.id}] ${label} — ${item.title} (${item.targetPath})${comment ? ` | Not: ${comment}` : ''}`;
    const kind = newStatus === 'approved' ? 'approved' : 'change_request';
    try {
      const existing = decisions[item.id];
      if (existing?.noteId) {
        await api(`/dev/notes/${existing.noteId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: newStatus === 'approved' ? 'done' : 'open',
            resolution: `${label}${comment ? `: ${comment}` : ''}`
          })
        }).catch(() => undefined);
      }
      await api('/dev/notes', {
        method: 'POST',
        body: JSON.stringify({
          area: 'Art direction',
          kind,
          body
        })
      });
      say(
        newStatus === 'approved'
          ? `✅ "${item.title}" onaylandı ve canlı D1 veritabanına kaydedildi.`
          : `❌ "${item.title}" için red/revize talebi canlı D1 veritabanına kaydedildi.`
      );
      loadDecisions();
    } catch (e) {
      say(e instanceof ApiError ? `${e.code}: ${e.message}` : String((e as Error).message));
    } finally {
      setSavingId(null);
    }
  };

  const approveBatch = async (items: ReviewCatalogItem[], labelText: string): Promise<void> => {
    const toApprove = items.filter((i) => decisions[i.id]?.status !== 'approved');
    if (toApprove.length === 0) {
      say('Seçili gruptaki tüm maddeler zaten onaylanmış durumda.');
      return;
    }
    setSavingId('BULK');
    try {
      for (const item of toApprove) {
        const comment = (draftComments[item.id] ?? '').trim();
        await api('/dev/notes', {
          method: 'POST',
          body: JSON.stringify({
            area: 'Art direction',
            kind: 'approved',
            body: `[D30:${item.id}] ONAYLANDI — ${item.title} (${item.targetPath})${comment ? ` | Not: ${comment}` : ''}`
          })
        });
      }
      say(`✅ ${labelText}: ${toApprove.length} kalem onaylandı ve D1 veritabanına kaydedildi.`);
      loadDecisions();
    } catch (e) {
      say(e instanceof ApiError ? `${e.code}: ${e.message}` : String((e as Error).message));
    } finally {
      setSavingId(null);
    }
  };

  const qNorm = search.trim().toLowerCase();
  const effectiveGroup = qNorm ? 'ALL' : activeGroup;

  const filtered = catalog.filter((item) => {
    if (effectiveGroup !== 'ALL' && item.groupId !== effectiveGroup) return false;
    if (originFilter !== 'ALL' && item.origin !== originFilter) return false;
    const decStatus = decisions[item.id]?.status ?? 'pending';
    if (statusFilter !== 'ALL' && decStatus !== statusFilter) return false;
    if (qNorm) {
      const hay = `${item.id} ${item.groupTitle} ${item.subGroupTitle} ${item.title} ${item.subtitle} ${item.description} ${item.targetPath} ${item.badge}`.toLowerCase();
      if (!hay.includes(qNorm)) return false;
    }
    return true;
  });

  // Group filtered items into ordered Sub-Groups
  const subGroups: { subGroupId: string; subGroupTitle: string; groupTitle: string; items: ReviewCatalogItem[] }[] = [];
  const subGroupMap = new Map<string, { subGroupId: string; subGroupTitle: string; groupTitle: string; items: ReviewCatalogItem[] }>();
  for (const item of filtered) {
    let sg = subGroupMap.get(item.subGroupId);
    if (!sg) {
      sg = {
        subGroupId: item.subGroupId,
        subGroupTitle: item.subGroupTitle,
        groupTitle: item.groupTitle,
        items: []
      };
      subGroupMap.set(item.subGroupId, sg);
      subGroups.push(sg);
    }
    sg.items.push(item);
  }

  const orderedGroupIds = REVIEW_GROUPS.filter((g) => g.id !== 'ALL').map((g) => g.id);
  const currentGroupIdx = orderedGroupIds.indexOf(activeGroup);
  const prevGroupId = currentGroupIdx > 0 ? orderedGroupIds[currentGroupIdx - 1] : null;
  const nextGroupId = currentGroupIdx >= 0 && currentGroupIdx < orderedGroupIds.length - 1 ? orderedGroupIds[currentGroupIdx + 1] : null;
  const currentGroupMeta = REVIEW_GROUPS.find((g) => g.id === effectiveGroup) ?? REVIEW_GROUPS[0]!;

  const approvedCount = catalog.filter((i) => decisions[i.id]?.status === 'approved').length;
  const rejectedCount = catalog.filter((i) => decisions[i.id]?.status === 'rejected').length;
  const pendingCount = catalog.length - approvedCount - rejectedCount;

  const d30NewCount = catalog.filter((i) => i.origin === 'd30_new').length;
  const prevApprovedCount = catalog.filter((i) => i.origin === 'prev_approved').length;

  const groupStats = (gId: string): { total: number; app: number; rej: number } => {
    const gItems = gId === 'ALL' ? catalog : catalog.filter((x) => x.groupId === gId);
    let app = 0;
    let rej = 0;
    for (const x of gItems) {
      const st = decisions[x.id]?.status;
      if (st === 'approved') app++;
      else if (st === 'rejected') rej++;
    }
    return { total: gItems.length, app, rej };
  };

  const stepLightbox = (dir: -1 | 1): void => {
    if (!lightboxItem) return;
    const idx = filtered.findIndex((x) => x.id === lightboxItem.id);
    if (idx < 0) return;
    const nextIdx = (idx + dir + filtered.length) % filtered.length;
    setLightboxItem(filtered[nextIdx] ?? null);
  };

  const curStats = groupStats(effectiveGroup);

  return (
    <div>
      <section className="card" style={{ marginBottom: 16, border: '1.5px solid #d4a857' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, color: '#f3d287' }}>
              🎨 Adım Adım Gruplandırılmış Onay &amp; Denetim Merkezi — 10 Ana Grup · {catalog.length} Doğrulanmış Eser
            </h3>
            <p style={{ margin: '6px 0 0', color: 'var(--dim)' }}>
              Tüm eserler <strong>Grup 1 → Grup 10</strong> ve kendi içlerinde <strong>Alt-Gruplar (her karakterin ve boss&apos;un Konsept Paftası + Chibi Savaş Atlası + 4 VN Portresi + İmza Silahı bir arada)</strong> olacak şekilde sıraya dizilmiştir. Grup grup ilerleyerek ister <strong>Alt-Grubu tek tıkla</strong>, ister <strong>tekil görselleri</strong> onaylayabilir veya revize isteyebilirsiniz.
            </p>
          </div>
          <div className="row" style={{ gap: 8, margin: 0 }}>
            <span className="badge ok">✅ Toplam Onaylı: {approvedCount} / {catalog.length}</span>
            <span className="badge bad">❌ Red / Revize: {rejectedCount}</span>
            <span className="badge warn">⏳ Bekleyen: {pendingCount}</span>
          </div>
        </div>

        {/* 10 Ordered Major Group Selector Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))',
            gap: 8,
            marginTop: 14,
            marginBottom: 10
          }}
        >
          {REVIEW_GROUPS.map((grp) => {
            const st = groupStats(grp.id);
            const isSelected = effectiveGroup === grp.id;
            const isAllApproved = st.total > 0 && st.app === st.total;
            return (
              <button
                key={grp.id}
                type="button"
                className={`btn${isSelected ? ' primary' : ''}`}
                onClick={() => {
                  setActiveGroup(grp.id);
                  if (search) setSearch('');
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: isSelected
                    ? '1.5px solid #f3d287'
                    : isAllApproved
                      ? '1px solid #3fa36c'
                      : st.rej > 0
                        ? '1px solid #d14949'
                        : undefined
                }}
              >
                <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: 12.5 }}>{grp.shortLabel}</span>
                <span
                  className={`badge ${isAllApproved ? 'ok' : st.rej > 0 ? 'bad' : st.app > 0 ? 'info' : ''}`}
                  style={{ marginLeft: 6, fontSize: 10.5 }}
                >
                  {isAllApproved ? '✓ Tamam' : st.rej > 0 ? `${st.rej} Red` : `${st.app}/${st.total}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="row" style={{ marginTop: 8, marginBottom: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn${originFilter === 'ALL' ? ' primary' : ''}`}
              onClick={() => setOriginFilter('ALL')}
            >
              Kaynak: Tümü ({catalog.length})
            </button>
            <button
              type="button"
              className={`btn${originFilter === 'd30_new' ? ' primary' : ''}`}
              onClick={() => setOriginFilter('d30_new')}
            >
              🆕 Yeni D-30 ({d30NewCount})
            </button>
            <button
              type="button"
              className={`btn${originFilter === 'prev_approved' ? ' primary' : ''}`}
              onClick={() => setOriginFilter('prev_approved')}
            >
              🏛️ Önceden Onaylı ({prevApprovedCount})
            </button>

            <span style={{ color: 'var(--dim)', padding: '0 4px' }}>|</span>

            <button
              type="button"
              className={`btn${statusFilter === 'ALL' ? ' primary' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              Durum: Tümü
            </button>
            <button
              type="button"
              className={`btn${statusFilter === 'pending' ? ' primary' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              ⏳ Bekleyen
            </button>
            <button
              type="button"
              className={`btn${statusFilter === 'approved' ? ' primary' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              ✅ Onaylanan
            </button>
            <button
              type="button"
              className={`btn${statusFilter === 'rejected' ? ' primary' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              ❌ Red / Revize
            </button>
          </div>

          <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Tüm gruplarda ara (karakter, boss, dosya adı…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 260 }}
            />
            {search ? (
              <button type="button" className="btn" onClick={() => setSearch('')}>
                ✕ Aramayı Temizle
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Active Group Banner + Step-by-Step Navigation + Sub-Group Quick Jump Pills */}
      <section className="card" style={{ marginBottom: 16, background: '#120d1d', border: '1px solid #4d3966' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: 0 }}>
          <div>
            <div className="mono" style={{ fontSize: 11.5, color: '#d4a857' }}>
              AKTİF İNCELEME GRUBU · {subGroups.length} ALT-GRUP · {filtered.length} ESER
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 18, color: '#fff' }}>
              {qNorm ? `🔍 Arama Sonuçları: "${search}" (${filtered.length} Eser)` : currentGroupMeta.fullTitle}
            </h3>
            <div className="row" style={{ gap: 8, marginTop: 6, marginBottom: 0 }}>
              <span className="badge ok">✅ Bu Grupta Onaylanan: {curStats.app} / {curStats.total}</span>
              <span className="badge bad">❌ Bu Grupta Red: {curStats.rej}</span>
              <span className="badge warn">⏳ Bu Grupta Bekleyen: {curStats.total - curStats.app - curStats.rej}</span>
            </div>
          </div>

          <div className="row" style={{ margin: 0, gap: 8, flexWrap: 'wrap' }}>
            {prevGroupId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setActiveGroup(prevGroupId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                ← Önceki Grup ({prevGroupId})
              </button>
            ) : null}
            {me.role !== 'viewer' && filtered.length > 0 ? (
              <button
                type="button"
                className="btn primary"
                disabled={savingId !== null}
                onClick={() => void approveBatch(filtered, currentGroupMeta.shortLabel)}
              >
                {savingId === 'BULK' ? 'Kaydediliyor…' : `✅ Bu Grubun Tamamını Onayla (${filtered.length})`}
              </button>
            ) : null}
            {me.role !== 'viewer' && nextGroupId && filtered.length > 0 ? (
              <button
                type="button"
                className="btn primary"
                disabled={savingId !== null}
                onClick={async () => {
                  await approveBatch(filtered, currentGroupMeta.shortLabel);
                  setActiveGroup(nextGroupId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                ✅ Grubu Onayla &amp; Sonraki Gruba Geç →
              </button>
            ) : null}
            {nextGroupId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setActiveGroup(nextGroupId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Sonraki Grup ({nextGroupId}) →
              </button>
            ) : null}
          </div>
        </div>

        {/* Sub-Group Quick Jump Index inside Active Group */}
        {subGroups.length > 1 ? (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #2b203a' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>
              ALT-GRUPLARA HIZLI ATLA ({subGroups.length} Alt-Grup):
            </div>
            <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
              {subGroups.map((sg) => {
                const sgApp = sg.items.filter((i) => decisions[i.id]?.status === 'approved').length;
                const sgRej = sg.items.filter((i) => decisions[i.id]?.status === 'rejected').length;
                const shortSg = sg.subGroupTitle.split('—')[0]?.trim() ?? sg.subGroupTitle;
                return (
                  <a
                    key={sg.subGroupId}
                    href={`#subgroup-${sg.subGroupId}`}
                    className="btn"
                    style={{
                      fontSize: 11.5,
                      padding: '4px 8px',
                      textDecoration: 'none',
                      border:
                        sgApp === sg.items.length
                          ? '1px solid #3fa36c'
                          : sgRej > 0
                            ? '1px solid #d14949'
                            : '1px solid #382a4a'
                    }}
                  >
                    {shortSg} ({sgApp}/{sg.items.length})
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {loading ? <p>Onay durumları D1 veritabanından yükleniyor…</p> : null}

      {/* Render Each Sub-Group as a Structured Section Box */}
      {subGroups.map((sg) => {
        const sgApproved = sg.items.filter((i) => decisions[i.id]?.status === 'approved').length;
        const sgRejected = sg.items.filter((i) => decisions[i.id]?.status === 'rejected').length;
        const isCollapsed = Boolean(collapsedSubs[sg.subGroupId]);

        return (
          <section
            key={sg.subGroupId}
            id={`subgroup-${sg.subGroupId}`}
            className="card"
            style={{
              marginBottom: 20,
              border:
                sgApproved === sg.items.length
                  ? '1.5px solid #3fa36c'
                  : sgRejected > 0
                    ? '1.5px solid #d14949'
                    : '1.5px solid #4a3863'
            }}
          >
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                margin: 0,
                paddingBottom: isCollapsed ? 0 : 12,
                borderBottom: isCollapsed ? 'none' : '1px solid #2e223f'
              }}
            >
              <div>
                {effectiveGroup === 'ALL' ? (
                  <div className="mono" style={{ fontSize: 11, color: '#d4a857' }}>{sg.groupTitle}</div>
                ) : null}
                <h4 style={{ margin: 0, fontSize: 16, color: '#f3d287' }}>{sg.subGroupTitle}</h4>
              </div>
              <div className="row" style={{ margin: 0, gap: 8, flexWrap: 'wrap' }}>
                <span className="badge info">{sg.items.length} Eser</span>
                <span className={`badge ${sgApproved === sg.items.length ? 'ok' : sgRejected > 0 ? 'bad' : 'warn'}`}>
                  ✅ {sgApproved} Onaylı · ❌ {sgRejected} Red · ⏳ {sg.items.length - sgApproved - sgRejected} Bekleyen
                </span>
                {me.role !== 'viewer' ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={savingId !== null || sgApproved === sg.items.length}
                    onClick={() => void approveBatch(sg.items, sg.subGroupTitle)}
                  >
                    {sgApproved === sg.items.length
                      ? '✓ Alt-Grup Onaylı'
                      : `✅ Bu Alt-Grubu Onayla (${sg.items.length})`}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCollapsedSubs((prev) => ({ ...prev, [sg.subGroupId]: !prev[sg.subGroupId] }))}
                >
                  {isCollapsed ? `▸ Göster (${sg.items.length})` : '▾ Daralt'}
                </button>
              </div>
            </div>

            {!isCollapsed ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: 14,
                  marginTop: 14
                }}
              >
                {sg.items.map((item) => {
                  const dec = decisions[item.id] ?? { status: 'pending', comment: '' };
                  const border =
                    dec.status === 'approved'
                      ? '1.5px solid #3fa36c'
                      : dec.status === 'rejected'
                        ? '1.5px solid #d14949'
                        : '1px solid #382a4a';
                  const statusBadge =
                    dec.status === 'approved' ? (
                      <span className="badge ok">ONAYLANDI ✅</span>
                    ) : dec.status === 'rejected' ? (
                      <span className="badge bad">REDDEDİLDİ / REVİZE ❌</span>
                    ) : item.origin === 'prev_approved' ? (
                      <span className="badge warn" title="Önceki fazlarda onaylandı; buradan tekrar onaylayabilir veya revize isteyebilirsiniz">
                        ÖNCEDEN ONAYLI · İNCELE ⏳
                      </span>
                    ) : (
                      <span className="badge warn">ONAY BEKLİYOR ⏳</span>
                    );

                  const retryCount = retryMap[item.id] ?? 0;
                  const imgSrc = item.imageUrl
                    ? retryCount > 0
                      ? `${item.imageUrl}${item.imageUrl.includes('?') ? '&' : '?'}r=${retryCount}`
                      : item.imageUrl
                    : undefined;

                  return (
                    <article
                      key={item.id}
                      className="card"
                      style={{
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        border
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', margin: 0, gap: 6, flexWrap: 'wrap' }}>
                        <div className="row" style={{ margin: 0, gap: 6 }}>
                          <span className="badge info">{item.badge}</span>
                          {loadedDims[item.id] ? (
                            <span className="badge ok" title="Tarayıcıda eksiksiz yüklendi">
                              ✓ {loadedDims[item.id]}
                            </span>
                          ) : null}
                        </div>
                        {statusBadge}
                      </div>

                      <h3 style={{ margin: 0, fontSize: 15 }}>{item.title}</h3>
                      <div className="mono" style={{ fontSize: 11.5, color: '#f3d287' }}>{item.subtitle}</div>

                      {imgSrc ? (
                        <div
                          style={{
                            position: 'relative',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #382a4a',
                            background:
                              item.category === 'PORTRAITS' || item.category === 'CHIBI_ATLAS' || item.category === 'ICONS_WEAPONS'
                                ? 'repeating-conic-gradient(#171124 0% 25%, #0e0a17 0% 50%) 50% / 20px 20px'
                                : '#09060e'
                          }}
                        >
                          <img
                            src={imgSrc}
                            alt={item.title}
                            loading="lazy"
                            onClick={() => setLightboxItem(item)}
                            onLoad={(e) => {
                              const el = e.currentTarget;
                              if (el.naturalWidth && el.naturalHeight) {
                                const d = `${el.naturalWidth}×${el.naturalHeight}`;
                                setLoadedDims((prev) => (prev[item.id] === d ? prev : { ...prev, [item.id]: d }));
                              }
                            }}
                            onError={() => {
                              setLoadedDims((prev) => ({ ...prev, [item.id]: 'HATA' }));
                            }}
                            style={{
                              width: '100%',
                              maxHeight: item.category === 'PORTRAITS' || item.category === 'CHIBI_ATLAS' ? 260 : 220,
                              objectFit: 'contain',
                              display: 'block',
                              cursor: 'zoom-in'
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              right: 6,
                              bottom: 6,
                              display: 'flex',
                              gap: 4
                            }}
                          >
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: '2px 8px', fontSize: 11, background: 'rgba(10,6,18,0.85)' }}
                              onClick={() => setLightboxItem(item)}
                            >
                              🔍 Tam Ekran İncele
                            </button>
                            {loadedDims[item.id] === 'HATA' ? (
                              <button
                                type="button"
                                className="btn primary"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => setRetryMap((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))}
                              >
                                🔄 Yeniden Yükle
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {item.audioUrl ? (
                        <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0b0712', border: '1px solid #382a4a' }}>
                          <audio controls preload="none" src={item.audioUrl} style={{ width: '100%', height: 36 }} />
                        </div>
                      ) : null}

                      <p style={{ margin: 0, fontSize: 12.5 }}>{item.description}</p>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', wordBreak: 'break-all' }}>
                        <strong>Dosya:</strong> {item.targetPath}
                        {item.sha256 ? ` · SHA256: ${item.sha256.slice(0, 12)}…` : ''}
                      </div>

                      {dec.comment ? (
                        <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(212,168,87,0.12)', fontSize: 12.5 }}>
                          <strong>Kayıtlı Notunuz:</strong> {dec.comment}
                        </div>
                      ) : null}

                      <input
                        type="text"
                        placeholder="Onay veya red/revize notunuz (ör. yüz ifadesini düzelt, parlaklığı artır…)"
                        value={draftComments[item.id] ?? ''}
                        onChange={(e) => setDraftComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        style={{ width: '100%', marginTop: 'auto' }}
                      />

                      <div className="row" style={{ margin: 0, gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`btn${dec.status === 'approved' ? ' primary' : ''}`}
                          disabled={savingId === item.id}
                          onClick={() => void recordDecision(item, 'approved')}
                        >
                          ✅ Onayla
                        </button>
                        <button
                          type="button"
                          className={`btn${dec.status === 'rejected' ? ' primary' : ''}`}
                          disabled={savingId === item.id}
                          onClick={() => void recordDecision(item, 'rejected')}
                        >
                          ❌ Reddet / Revize İste
                        </button>
                        {item.sceneJump ? (
                          <button type="button" className="btn" onClick={() => onJumpPreview(item.sceneJump!)}>
                            🎮 Oyunda Gör
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}

      {/* Bottom Step-by-Step Group Navigation Bar */}
      <section className="card" style={{ marginTop: 18, background: '#120d1d', border: '1.5px solid #d4a857' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: 0, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <strong>{currentGroupMeta.shortLabel}</strong> sonuna geldiniz ({subGroups.length} Alt-Grup · {filtered.length} Eser).
          </div>
          <div className="row" style={{ margin: 0, gap: 8, flexWrap: 'wrap' }}>
            {prevGroupId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setActiveGroup(prevGroupId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                ← Önceki Gruba Dön ({prevGroupId})
              </button>
            ) : null}
            {me.role !== 'viewer' && filtered.length > 0 ? (
              <button
                type="button"
                className="btn primary"
                disabled={savingId !== null}
                onClick={() => void approveBatch(filtered, currentGroupMeta.shortLabel)}
              >
                ✅ Bu Grubun Tamamını Onayla ({filtered.length})
              </button>
            ) : null}
            {me.role !== 'viewer' && nextGroupId && filtered.length > 0 ? (
              <button
                type="button"
                className="btn primary"
                disabled={savingId !== null}
                onClick={async () => {
                  await approveBatch(filtered, currentGroupMeta.shortLabel);
                  setActiveGroup(nextGroupId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                ✅ Bu Grubu Onayla &amp; Sonraki Gruba Geç ({nextGroupId}) →
              </button>
            ) : null}
            {nextGroupId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setActiveGroup(nextGroupId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Sonraki Gruba Geç ({nextGroupId}) →
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Full-Screen Lightbox Modal for Deep Inspection & Direct Approval/Rejection */}
      {lightboxItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxItem.title}
          onClick={() => setLightboxItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(6, 4, 12, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            padding: 20,
            overflow: 'auto'
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 1320,
              width: '100%',
              margin: 'auto',
              border: '2px solid #d4a857',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', margin: 0, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span className="badge info" style={{ marginRight: 8 }}>{lightboxItem.badge}</span>
                <strong>{lightboxItem.title}</strong>
                <span className="mono" style={{ marginLeft: 10, color: '#f3d287' }}>
                  {loadedDims[lightboxItem.id] || lightboxItem.dims || ''}
                </span>
              </div>
              <div className="row" style={{ margin: 0, gap: 6 }}>
                <button type="button" className="btn" onClick={() => stepLightbox(-1)}>
                  ← Önceki Görsel
                </button>
                <button type="button" className="btn" onClick={() => stepLightbox(1)}>
                  Sonraki Görsel →
                </button>
                <button type="button" className="btn" onClick={() => setCheckerBg(!checkerBg)}>
                  {checkerBg ? '⬛ Koyu Zemin' : '🏁 Şeffaf Damalı Zemin'}
                </button>
                {lightboxItem.imageUrl ? (
                  <a className="btn" href={lightboxItem.imageUrl} target="_blank" rel="noreferrer">
                    ↗ Ham Dosyayı Aç
                  </a>
                ) : null}
                <button type="button" className="btn primary" onClick={() => setLightboxItem(null)}>
                  ✕ Kapat
                </button>
              </div>
            </div>

            {lightboxItem.imageUrl ? (
              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid #382a4a',
                  padding: 12,
                  maxHeight: '68vh',
                  overflow: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: checkerBg
                    ? 'repeating-conic-gradient(#1b1429 0% 25%, #0e0a17 0% 50%) 50% / 24px 24px'
                    : '#07050c'
                }}
              >
                <img
                  src={lightboxItem.imageUrl}
                  alt={lightboxItem.title}
                  style={{ maxWidth: '100%', maxHeight: '64vh', objectFit: 'contain' }}
                />
              </div>
            ) : null}

            <div className="mono" style={{ fontSize: 12, color: 'var(--dim)' }}>
              {lightboxItem.subtitle} · <strong>Dosya:</strong> {lightboxItem.targetPath}
            </div>
            <p style={{ margin: 0 }}>{lightboxItem.description}</p>

            <div className="row" style={{ margin: 0, gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Bu görsel için onay veya revize notunuzu yazın…"
                value={draftComments[lightboxItem.id] ?? ''}
                onChange={(e) => setDraftComments((prev) => ({ ...prev, [lightboxItem.id]: e.target.value }))}
                style={{ flex: 1, minWidth: 260 }}
              />
              <button
                type="button"
                className={`btn${decisions[lightboxItem.id]?.status === 'approved' ? ' primary' : ''}`}
                disabled={savingId === lightboxItem.id}
                onClick={() => void recordDecision(lightboxItem, 'approved')}
              >
                ✅ Onayla
              </button>
              <button
                type="button"
                className={`btn${decisions[lightboxItem.id]?.status === 'rejected' ? ' primary' : ''}`}
                disabled={savingId === lightboxItem.id}
                onClick={() => void recordDecision(lightboxItem, 'rejected')}
              >
                ❌ Reddet / Revize İste
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function packageSummary(p: Progress): string {
  const caps = p.capabilities ?? [];
  if (!caps.length) return `${p.summary.done} done · ${p.summary.partial} partial · ${p.summary.missing} missing`;
  const n = (s: string): number => caps.filter((c) => c.implementationStatus === s).length;
  const accepted = caps.filter((c) => c.implementationStatus === 'COMPLETE' && c.blockerIds.length === 0).length;
  return `R00–R18 · code ${n('COMPLETE')} complete, ${n('PARTIAL')} partial · ${accepted} with no open acceptance gate`;
}

const List = ({ title, items }: { title: string; items: Item[] }): ReactNode => (
  <section className="card"><h3>{title}</h3><ul>{items.map((i) => <li key={i.title}><strong>{i.title}</strong>{i.detail ? ` — ${i.detail}` : ''}</li>)}</ul></section>
);

function Overview({ p, onOpenReview }: { p: Progress; onOpenReview: () => void }): ReactNode {
  return (
    <>
      <p className="mono">Generated {p.generatedAt} from the repository (docs/DEV_TRACKER.json reviewed {p.reviewedAt ?? '—'} at {p.sourceCommit ?? '—'}, roadmap, decisions, git history, base release manifest).</p>
      {p.currentAssignment ? (
        <section className="card" style={{ marginBottom: 14, border: '1px solid #d4af37' }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <h3 style={{ margin: 0 }}>Current assignment {p.currentAssignment.id}</h3>
              <span className="badge ok">{p.currentAssignment.status}</span>
            </div>
            <button type="button" className="btn primary" onClick={onOpenReview}>
              📋 Kapsamlı Onay Merkezine Git (707 Eser &amp; Adımı Onayla / Reddet)
            </button>
          </div>
          <p style={{ margin: '8px 0 0' }}>{p.currentAssignment.workflow}</p>
          <p style={{ margin: '6px 0 0', color: 'var(--dim)' }}><strong>Proposed next:</strong> {p.currentAssignment.nextProposed}</p>
        </section>
      ) : null}
      {p.baseRelease ? (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Base release (initial AAB content)</h3>
            <span className="badge ok">{p.baseRelease.id} · gen {p.baseRelease.generation}</span>
            <span className="badge ok">client ≥ {p.baseRelease.minClient}</span>
            <span className="badge ok">{p.baseRelease.fileCount} base files ({(p.baseRelease.totalBytes / (1024 * 1024)).toFixed(2)} MB)</span>
            <span className="badge ok">{p.baseRelease.approvedArtCount} approved art entries</span>
          </div>
          {p.flow ? <p style={{ margin: '8px 0 0', color: 'var(--dim)' }}><strong>Flow:</strong> {p.flow}</p> : null}
        </section>
      ) : null}
      {p.checks ? (
        <>
          <h3>Latest checks ({p.checks.date}, {p.checks.commit})</h3>
          <table>
            <tbody>{p.checks.items.map((c) => <tr key={c.name}><td>{c.name}</td><td><span className={`badge ${checkBadge(c.result)}`}>{c.result}</span></td><td>{c.detail}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <div className="grid">
        <List title="Working on now" items={p.now} />
        <List title="Next" items={p.next} />
        <List title="Waiting for you" items={p.blockedOnOwner} />
      </div>
      {p.phases?.length ? (
        <>
          <h3>Phases (README section 0)</h3>
          <div className="grid">
            {p.phases.map((ph) => (
              <section key={ph.n} className="card">
                <div className="row"><h3 style={{ margin: 0 }}>Phase {ph.n} — {ph.title}</h3><span className={`badge ${ph.status === 'active' ? 'ok' : 'warn'}`}>{ph.status}</span></div>
                <p style={{ margin: '8px 0 2px' }}><strong>Done</strong></p>
                <ul>{ph.done.map((x) => <li key={x}>{x}</li>)}</ul>
                <p style={{ margin: '8px 0 2px' }}><strong>Remaining</strong></p>
                <ul>{ph.remaining.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            ))}
          </div>
        </>
      ) : null}
      {p.capabilities?.length ? (
        <>
          <h3>Work packages R00–R18</h3>
          <p style={{ color: 'var(--dim)' }}>Code is the local source state. Acceptance stays open while a gate is listed (device, live accounts, art, owner decisions). The latest evidence shows who verified what and when.</p>
          <table>
            <thead><tr><th>ID</th><th>Package</th><th>Code</th><th>Open acceptance gates</th><th>Latest evidence</th></tr></thead>
            <tbody>{p.capabilities.map((c) => {
              const ev = (p.evidence ?? []).filter((e) => c.evidenceIds.includes(e.id) && e.verifiedAt).sort((x, y) => String(y.verifiedAt).localeCompare(String(x.verifiedAt)))[0];
              return (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.id}</td>
                  <td style={{ minWidth: 280 }}>{c.title}<div className="mono" style={{ whiteSpace: 'normal' }}>{c.implemented}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className={`badge ${codeBadge(c.implementationStatus)}`}>{c.implementationStatus}</span></td>
                  <td style={{ minWidth: 180 }}><div className="row" style={{ gap: 4, margin: 0 }}>{c.blockerIds.length ? c.blockerIds.map((b) => <span key={b} className="badge warn" style={{ whiteSpace: 'nowrap' }} title={(p.blockers ?? []).find((x) => x.id === b)?.title}>{b}</span>) : <span className="badge ok">none</span>}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{ev ? <><div>{ev.level}</div><div className="mono">{String(ev.verifiedAt).slice(0, 10)} · <span title={ev.id}>{ev.id.length > 22 ? `${ev.id.slice(0, 21)}…` : ev.id}</span></div></> : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </>
      ) : null}
      {p.media?.length ? (
        <>
          <h3>Art integration (Argon workbench to game)</h3>
          <table>
            <thead><tr><th>Kind</th><th>Drawn</th><th>In the game</th><th>Missing</th></tr></thead>
            <tbody>{p.media.map((m) => <tr key={m.kind}><td>{m.kind}</td><td>{m.drawn}</td><td>{m.inGame}</td><td>{m.missing}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      {p.blockers?.length ? (
        <>
          <h3>Acceptance gates</h3>
          <table>
            <thead><tr><th>ID</th><th>State</th><th>Gate</th></tr></thead>
            <tbody>{p.blockers.map((b) => <tr key={b.id}><td>{b.id}</td><td><span className={`badge ${b.level === 'OWNER_BLOCKED' ? 'bad' : 'warn'}`}>{b.level}</span></td><td><strong>{b.title}</strong><div className="mono">{b.detail}</div></td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <h3>Infrastructure matrix (docs/INFRA_ROADMAP.md)</h3>
      <table>
        <thead><tr><th>#</th><th>Area</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>{p.roadmap.map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.area}</td><td>{r.status}</td><td>{r.detail}</td></tr>)}</tbody>
      </table>
      <h3>Your ideas and how they were handled</h3>
      <table>
        <thead><tr><th>Date</th><th>Idea</th><th>State</th></tr></thead>
        <tbody>{p.ideas.map((i) => <tr key={i.text}><td>{i.date}</td><td>{i.text}</td><td>{i.status}</td></tr>)}</tbody>
      </table>
      <h3>Decisions</h3>
      <table>
        <thead><tr><th>ID</th><th>When / who</th><th>Decision</th></tr></thead>
        <tbody>{p.decisions.slice().reverse().map((d) => <tr key={d.id}><td>{d.id}</td><td>{d.when}</td><td>{d.what}</td></tr>)}</tbody>
      </table>
      <h3>Recent commits (GitHub main → Cloudflare Workers Builds, D-28)</h3>
      <table>
        <tbody>{p.commits.map((c) => <tr key={c.sha}><td><code>{c.sha}</code></td><td>{c.at.slice(0, 16).replace('T', ' ')}</td><td>{c.subject}</td></tr>)}</tbody>
      </table>
    </>
  );
}

const FRAMES: { label: string; w: number; h: number }[] = [
  { label: 'Desktop 16:9', w: 1280, h: 720 },
  { label: 'Phone 20:9', w: 1200, h: 540 }
];

const SCENE_PRESETS: { id: string; label: string }[] = [
  { id: 'fresh_flow', label: '1. Full Flow (Splash → Prologue → Tutorials)' },
  { id: 'studio', label: '2. SovTaym Studios' },
  { id: 'title_fresh', label: '3. Title (Tap to Start → Prologue)' },
  { id: 'prologue', label: '4. 120s Prologue' },
  { id: 'story_t1', label: '5. LN T-1 Before' },
  { id: 'battle_t1', label: '6. Battle T-1 (Whispering Ash)' },
  { id: 'story_t1_after', label: '7. LN T-1 After' },
  { id: 'story_t2_before', label: '8. LN T-2 Before' },
  { id: 'battle_t2', label: '9. Battle T-2 (Stone Crossing)' },
  { id: 'story_t2_after', label: '10. LN T-2 After' },
  { id: 'story_t3_before', label: '11. LN T-3 Before' },
  { id: 'battle_t3', label: '12. Battle T-3 (Shelter Courtyard)' },
  { id: 'story_t3_after', label: '13. LN T-3 Finale' },
  { id: 'finish_wait', label: '14. Patch Wait (Quotes)' },
  { id: 'hub', label: '15. Company Hub' },
  { id: 'chapters', label: '16. World Map (Chapters)' },
  { id: 'roster', label: '17. Companion Roster (25 Heroes)' },
  { id: 'character', label: '18. Character Sheet (Fadyme)' },
  { id: 'summon', label: '19. Hall of Ancestors (Summon)' },
  { id: 'trials', label: '20. Trials (Arena & Endless)' }
];

function Preview({ initialScene = 'fresh_flow' }: { initialScene?: string }): ReactNode {
  const [f, setF] = useState(0);
  const [scene, setScene] = useState(initialScene);
  useEffect(() => {
    setScene(initialScene);
  }, [initialScene]);
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
  const [target, setTarget] = useState<'worker' | 'vite'>(isLocal ? 'vite' : 'worker');
  const [nonce, setNonce] = useState(0);
  const frame = FRAMES[f] as (typeof FRAMES)[number];
  const url = gameUrl(scene, target);
  return (
    <>
      <p>The game as deployed on Cloudflare (or the dev server when local). Jump to any scene of the initial AAB flow below, or play the full entry sequence from the splash.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {FRAMES.map((x, i) => <button key={x.label} className={`btn${i === f ? ' primary' : ''}`} onClick={() => setF(i)}>{x.label}</button>)}
        {isLocal ? (
          <>
            <button className={`btn${target === 'vite' ? ' primary' : ''}`} onClick={() => setTarget('vite')}>Vite Dev (:5173)</button>
            <button className={`btn${target === 'worker' ? ' primary' : ''}`} onClick={() => setTarget('worker')}>Game Worker (:8787)</button>
          </>
        ) : (
          <span className="badge ok">Cloudflare Live Worker</span>
        )}
        <button className="btn" onClick={() => setNonce(nonce + 1)}>Reload</button>
        <a className="btn" href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {SCENE_PRESETS.map((s) => (
          <button key={s.id || 'full'} className={`btn${scene === s.id ? ' primary' : ''}`} onClick={() => { setScene(s.id); setNonce(nonce + 1); }}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: '100%', overflow: 'auto', marginTop: 12 }}>
        <iframe key={`${f}-${scene}-${target}-${nonce}`} title="Game preview" src={url} width={frame.w} height={frame.h} style={{ border: '1px solid var(--edge, #444)', borderRadius: 8, background: '#0a0610', maxWidth: '100%' }} allow="autoplay; fullscreen" />
      </div>
    </>
  );
}

function StoreKit({ p }: { p: Progress }): ReactNode {
  const list = p.storeAssets ?? [];
  const brand = list.filter((x) => x.kind === 'brand');
  const shots = list.filter((x) => x.kind === 'screenshot');
  const v = encodeURIComponent(p.generatedAt);
  return (
    <>
      <p>Canonical Google Play Store &amp; Brand Identity Kit built from 100% approved runtime assets (silver-haired veil-hooded Fadyme, dark-brown-haired armored Mahmut, 32 clean alpha-keyed character portraits, and 54 animated chibi sheets).</p>
      <h3>Brand Logos, App Icon &amp; Feature Graphic</h3>
      <div className="grid">
        {brand.map((b) => (
          <figure key={b.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/store/${b.file}?v=${v}`} target="_blank" rel="noreferrer">
              <img src={`/dev/store/${b.file}?v=${v}`} alt={b.label} loading="lazy" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6, background: '#0c0814' }} />
            </a>
            <figcaption className="mono">{b.label} (<code>docs/store/assets/{b.file}</code>)</figcaption>
          </figure>
        ))}
      </div>
      <h3>8× 1920×1080 Google Play Landscape Store Showcase Screenshots</h3>
      <div className="grid">
        {shots.map((s) => (
          <figure key={s.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/store/${s.file}?v=${v}`} target="_blank" rel="noreferrer">
              <img src={`/dev/store/${s.file}?v=${v}`} alt={s.label} loading="lazy" style={{ width: '100%', borderRadius: 6 }} />
            </a>
            <figcaption className="mono">{s.label} (<code>docs/store/assets/{s.file}</code>)</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

function Screens({ p, onNote }: { p: Progress; onNote: (area: string) => void }): ReactNode {
  return (
    <>
      <p>Curated screenshots from the automated browser tests (updated whenever a screen changes). Pick a screen and leave a note.</p>
      <div className="grid">
        {p.screens.map((s) => (
          <figure key={s.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/evidence/${s.file}`} target="_blank" rel="noreferrer"><img src={`/dev/evidence/${s.file}`} alt={s.caption} loading="lazy" style={{ width: '100%', borderRadius: 6 }} /></a>
            <figcaption className="mono">{s.caption}</figcaption>
            <button className="btn" onClick={() => onNote(AREAS.find((a) => s.caption.toLowerCase().includes(a.toLowerCase().split(' ')[0] ?? '')) ?? 'General')}>Leave a note</button>
          </figure>
        ))}
        {p.screens.length === 0 ? <p>No screenshots yet.</p> : null}
      </div>
    </>
  );
}

function Feedback({ me, say, area, setArea }: { me: Me; say: (m: string) => void; area: string; setArea: (a: string) => void }): ReactNode {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => { api<{ notes: Note[] }>('/dev/notes').then((r) => setNotes(r.notes)).catch(setErr); };
  useEffect(load, []);
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api('/dev/notes', { method: 'POST', body: JSON.stringify({ area, kind: String(f.get('kind')), body: String(f.get('body')) }) });
      form.reset(); say('Note saved. I read open notes at the start of every working session.'); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  const move = async (n: Note, status: string): Promise<void> => {
    const resolution = status === 'done' || status === 'wontfix' ? (window.prompt('Resolution (what was done / why not):', n.resolution) ?? '') : n.resolution;
    try { await api(`/dev/notes/${n.id}`, { method: 'PATCH', body: JSON.stringify({ status, resolution }) }); load(); } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  if (err) return <ErrorNotice error={err} />;
  return (
    <>
      <form className="row" onSubmit={submit} aria-label="New note">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select name="kind" aria-label="Kind"><option value="feedback">feedback</option><option value="change_request">change request</option><option value="approved">approved</option><option value="question">question</option><option value="idea">idea</option></select>
        <input name="body" placeholder="What should change, or what do you like?" required maxLength={4000} style={{ flex: 1, minWidth: 320 }} />
        <button className="btn primary" type="submit">Save note</button>
      </form>
      <table>
        <thead><tr><th>#</th><th>Area</th><th>Kind</th><th>Note</th><th>State</th><th>Resolution</th><th /></tr></thead>
        <tbody>{(notes ?? []).map((n) => (
          <tr key={n.id}>
            <td>{n.id}</td><td>{n.area}</td><td>{n.kind}</td><td>{n.body}<div className="mono">{n.created_by} · {n.created_at.slice(0, 16).replace('T', ' ')}</div></td>
            <td><span className={`badge ${n.status === 'done' ? 'ok' : 'warn'}`}>{n.status}</span></td><td>{n.resolution}</td>
            <td>{me.role !== 'viewer' ? <select aria-label={`State of note ${n.id}`} value={n.status} onChange={(e) => void move(n, e.target.value)}><option>open</option><option>in_progress</option><option>done</option><option>wontfix</option></select> : null}</td>
          </tr>
        ))}</tbody>
      </table>
      {notes && notes.length === 0 ? <p>No notes yet.</p> : null}
    </>
  );
}
