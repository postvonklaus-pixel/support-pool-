/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Caption Generator Screen
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc }      from '../utils.js';
import { on }       from '../events.js';
import { callFn }   from '../firebase.js';
import { toast }    from '../components/toast.js';

/* Niche chips → function key (all lowercase) */
const NICHES = [
  'Lifestyle','Fitness','Food','Tech','Business',
  'Comedy','Beauty','Gaming','Music','Fashion',
];
const NICHE_MAP = {
  Lifestyle:'lifestyle', Fitness:'fitness', Food:'food',
  Tech:'tech',           Business:'business', Comedy:'comedy',
  Beauty:'beauty',       Gaming:'gaming',     Music:'music',
  Fashion:'fashion',
};

/* Hook display label → Cloud Function hookCategory value */
const HOOKS = [
  { label: 'Neugier',       val: 'Curiosity'   },
  { label: 'Story',         val: 'Story'        },
  { label: 'Liste',         val: 'List'         },
  { label: 'Autorität',     val: 'Authority'    },
  { label: 'Provokation',   val: 'Controversy'  },
  { label: 'Dringlichkeit', val: 'Urgency'      },
];

let _niche = '';
let _hook  = '';   // stores the .val (English) for the API call

export function render() {
  const el = document.getElementById('screen-caption');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">${t('capTileLabel') || 'Caption Generator'}</div>
      <div class="page-header__sub">${t('capTileSub') || 'Hashtags & Hook-Formeln'}</div>
    </div>
    <div class="caption-scroll">
      <div class="card card--glass" style="padding:20px;margin-bottom:16px">

        <!-- Niche -->
        <label class="input-label">${t('capNiche') || 'Nische wählen'}</label>
        <div class="chip-row" style="margin-bottom:16px">
          ${NICHES.map(n => `
            <button class="chip ${_niche===n?'chip--active':''}" data-action="cap:niche" data-val="${n}">${n}</button>
          `).join('')}
        </div>

        <!-- Hook -->
        <label class="input-label">${t('capHook') || 'Hook-Stil'}</label>
        <div class="chip-row" style="margin-bottom:16px">
          ${HOOKS.map(h => `
            <button class="chip ${_hook===h.val?'chip--active':''}" data-action="cap:hook" data-val="${h.val}" data-label="${h.label}">${h.label}</button>
          `).join('')}
        </div>

        <!-- Topic (required by Cloud Function) -->
        <label class="input-label">${t('capTopic') || 'Video-Thema'}</label>
        <input type="text" class="input" id="cap-topic"
          placeholder="${t('capTopicPlaceholder') || 'Z.B.: 5 Fehler beim Training'}"
          maxlength="300" style="margin-bottom:20px">

        <button class="btn btn--primary btn--full" data-action="caption:generate">
          ✨ ${t('capGenerate') || 'Caption generieren'}
        </button>
      </div>

      <!-- Results -->
      <div id="caption-results"></div>
    </div>
  `;

  _registerHandlers();
}

export async function generate() {
  const res     = document.getElementById('caption-results');
  const topicEl = document.getElementById('cap-topic');
  const topic   = topicEl?.value?.trim() || '';

  if (!res) return;

  if (!_niche || !_hook) {
    toast(t('capSelectHint') || 'Nische und Hook-Stil wählen', 'warning');
    return;
  }
  if (!topic) {
    toast(t('capTopicHint') || 'Bitte Thema eingeben', 'warning');
    topicEl?.focus();
    return;
  }

  res.innerHTML = `
    <div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:8px"></div>
    <div class="skeleton" style="height:80px;border-radius:12px"></div>`;

  try {
    const data = await callFn('generateCaption', {
      niche:        NICHE_MAP[_niche] || _niche.toLowerCase(),
      hookCategory: _hook,
      topic,
      memberKey:    state.currentUser || 'anon',
    });

    if (!data?.caption) {
      res.innerHTML = `<div class="empty-state"><div class="empty-state__sub">Keine Ergebnisse</div></div>`;
      return;
    }

    const hooks = (data.hooks || []).slice(0, 3);

    res.innerHTML = `
      <!-- Caption -->
      <div class="card card--glass" style="padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:8px">CAPTION</div>
        <div style="font-size:14px;line-height:1.65;color:var(--text-primary);white-space:pre-wrap">${esc(data.caption)}</div>
        <button class="btn btn--ghost btn--sm" data-action="cap:copy" data-text="${esc(data.caption)}" style="margin-top:10px">
          📋 ${t('capCopy') || 'Kopieren'}
        </button>
      </div>

      <!-- Hook-Formeln -->
      ${hooks.length ? `
      <div class="card card--glass" style="padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:10px">HOOK-FORMELN</div>
        ${hooks.map(h => `
          <div style="margin-bottom:10px;padding:10px;background:var(--bg-glass-hover);border-radius:10px">
            <div style="font-size:13px;line-height:1.5;color:var(--text-primary);margin-bottom:5px">${esc(h.formula)}</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">${esc(h.tip)}</div>
            <button class="btn btn--ghost btn--sm" data-action="cap:copy" data-text="${esc(h.formula)}">
              📋 ${t('capCopy') || 'Kopieren'}
            </button>
          </div>
        `).join('')}
      </div>` : ''}

      <!-- Hashtags -->
      ${data.hashtagString ? `
      <div class="card card--glass" style="padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:8px">HASHTAGS</div>
        <div style="font-size:13px;line-height:1.8;color:var(--accent-primary);word-break:break-word">${esc(data.hashtagString)}</div>
        <button class="btn btn--ghost btn--sm" data-action="cap:copy" data-text="${esc(data.hashtagString)}" style="margin-top:10px">
          📋 ${t('capCopy') || 'Kopieren'}
        </button>
      </div>` : ''}

      <!-- Tipps -->
      ${(data.tips || []).length ? `
      <div class="card card--glass" style="padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:10px">TIPPS</div>
        ${(data.tips || []).map(tip => `
          <div style="font-size:13px;color:var(--text-secondary);padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            💡 ${esc(tip)}
          </div>
        `).join('')}
      </div>` : ''}
    `;
  } catch (err) {
    console.error('[caption] generate error:', err);
    const msg = err?.message || t('capError') || 'Fehler beim Generieren';
    toast(msg, 'error');
    res.innerHTML = '';
  }
}

function _registerHandlers() {
  on('cap:niche', (el) => {
    _niche = el.dataset.val;
    render();
  });
  on('cap:hook', (el) => {
    _hook = el.dataset.val;
    render();
  });
  on('cap:copy', async (el) => {
    const text = el.dataset.text || '';
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopiert! 📋', 'success', 1800);
    } catch {
      toast(text, 'info', 6000);
    }
  });
}
