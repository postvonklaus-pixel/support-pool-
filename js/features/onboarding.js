/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Onboarding Flow (Part J)
   3-slide full-screen overlay for first-time users
   ═══════════════════════════════════════════════════════ */

import { storage } from '../storage.js';
import { writeDB } from '../firebase.js';
import { state }   from '../state.js';

const STORAGE_KEY = 'onboarded';

const _OB = {
  de: [
    { icon:'👋', title:'Willkommen im NOVA Support Pool!',
      f1:'Kommentiere auf Videos deiner Mitglieder', f2:'Sammle Guthaben für eigene Videos', f3:'Steige in Rang und Ansehen auf',
      g1:'Du gibst einen Support', g2:'+1 Guthaben', g3:'Dein Video wird supportet', g4:'−1 Guthaben',
      note1:'💡 Erst supporten, dann posten — so bleibt der Pool gesund!',
      r1:'Tippe im Feed auf ein Video und hinterlasse einen Kommentar',
      r2:'Bestätige den Support — dein Guthaben steigt',
      r3:'Sobald du genug Guthaben hast, poste dein eigenes Video',
      note2:'🎉 Viel Erfolg — und danke, dass du Teil von NOVA bist!',
      t2:'Das Guthaben-System', t3:'Bereit loszulegen?', btn:'Los geht\'s!',
      desc:'Der Pool ist eine <strong>gegenseitige TikTok-Community</strong> — du hilfst anderen, andere helfen dir.' },
  ],
  en: [
    { icon:'👋', title:'Welcome to NOVA Support Pool!',
      f1:'Comment on your members\' videos', f2:'Earn credits for your own videos', f3:'Level up your rank and reputation',
      g1:'You give a support', g2:'+1 Credit', g3:'Your video gets supported', g4:'−1 Credit',
      note1:'💡 Support first, then post — that keeps the pool healthy!',
      r1:'Tap a video in the feed and leave a comment',
      r2:'Confirm the support — your credits go up',
      r3:'Once you have enough credits, post your own video',
      note2:'🎉 Good luck — and thanks for being part of NOVA!',
      t2:'The Credit System', t3:'Ready to go?', btn:'Let\'s go!',
      desc:'The pool is a <strong>mutual TikTok community</strong> — you help others, others help you.' },
  ],
  id: [
    { icon:'👋', title:'Selamat datang di NOVA Support Pool!',
      f1:'Komentari video anggota lainnya', f2:'Kumpulkan kredit untuk video kamu', f3:'Naik peringkat dan reputasi',
      g1:'Kamu memberi support', g2:'+1 Kredit', g3:'Video kamu di-support', g4:'−1 Kredit',
      note1:'💡 Support dulu, baru posting — agar pool tetap sehat!',
      r1:'Ketuk video di feed dan tinggalkan komentar',
      r2:'Konfirmasi support — kredit kamu naik',
      r3:'Setelah punya cukup kredit, posting video kamu',
      note2:'🎉 Semangat — dan terima kasih sudah bergabung di NOVA!',
      t2:'Sistem Kredit', t3:'Siap memulai?', btn:'Ayo mulai!',
      desc:'Pool adalah <strong>komunitas TikTok saling dukung</strong> — kamu bantu orang lain, mereka bantu kamu.' },
  ],
  it: [
    { icon:'👋', title:'Benvenuto nel NOVA Support Pool!',
      f1:'Commenta i video dei tuoi membri', f2:'Accumula crediti per i tuoi video', f3:'Sali di rango e reputazione',
      g1:'Dai un support', g2:'+1 Credito', g3:'Il tuo video viene supportato', g4:'−1 Credito',
      note1:'💡 Prima supporta, poi posta — così il pool resta sano!',
      r1:'Tocca un video nel feed e lascia un commento',
      r2:'Conferma il support — i tuoi crediti salgono',
      r3:'Quando hai abbastanza crediti, posta il tuo video',
      note2:'🎉 In bocca al lupo — grazie per far parte di NOVA!',
      t2:'Il Sistema Crediti', t3:'Pronto a partire?', btn:'Iniziamo!',
      desc:'Il pool è una <strong>community TikTok reciproca</strong> — aiuti gli altri, gli altri aiutano te.' },
  ],
  es: [
    { icon:'👋', title:'¡Bienvenido al NOVA Support Pool!',
      f1:'Comenta en los videos de tus miembros', f2:'Acumula créditos para tus videos', f3:'Sube de rango y reputación',
      g1:'Das un support', g2:'+1 Crédito', g3:'Tu video es apoyado', g4:'−1 Crédito',
      note1:'💡 Primero apoya, luego publica — ¡así el pool se mantiene sano!',
      r1:'Toca un video en el feed y deja un comentario',
      r2:'Confirma el support — tus créditos suben',
      r3:'Cuando tengas suficientes créditos, publica tu video',
      note2:'🎉 ¡Mucha suerte — y gracias por ser parte de NOVA!',
      t2:'El Sistema de Créditos', t3:'¿Listo para empezar?', btn:'¡Vamos!',
      desc:'El pool es una <strong>comunidad TikTok mutua</strong> — tú ayudas a otros, otros te ayudan.' },
  ],
  tr: [
    { icon:'👋', title:'NOVA Support Pool\'a hoş geldin!',
      f1:'Üyelerinin videolarına yorum yap', f2:'Kendi videoların için kredi kazan', f3:'Rütbe ve itibarını artır',
      g1:'Bir destek veriyorsun', g2:'+1 Kredi', g3:'Videon destekleniyor', g4:'−1 Kredi',
      note1:'💡 Önce destekle, sonra paylaş — pool böyle sağlıklı kalır!',
      r1:'Feedde bir videoya dokun ve yorum bırak',
      r2:'Desteği onayla — kredin artar',
      r3:'Yeterli kredin olunca kendi videonu paylaş',
      note2:'🎉 Başarılar — NOVA\'nın parçası olduğun için teşekkürler!',
      t2:'Kredi Sistemi', t3:'Başlamaya hazır mısın?', btn:'Hadi gidelim!',
      desc:'Pool, <strong>karşılıklı bir TikTok topluluğu</strong> — sen başkalarına yardım et, onlar da sana.' },
  ],
  ar: [
    { icon:'👋', title:'!مرحباً بك في NOVA Support Pool',
      f1:'علّق على فيديوهات الأعضاء', f2:'اجمع نقوداً لفيديوهاتك', f3:'ارتقِ في الرتبة والسمعة',
      g1:'تعطي دعماً', g2:'+1 نقطة', g3:'فيديوك يتلقى الدعم', g4:'−1 نقطة',
      note1:'!💡 ادعم أولاً ثم انشر — هكذا يبقى المجتمع صحياً',
      r1:'اضغط على فيديو في الخلاصة واترك تعليقاً',
      r2:'أكّد الدعم — نقاطك ترتفع',
      r3:'حين يكون لديك نقاط كافية، انشر فيديوك',
      note2:'!🎉 حظاً موفقاً — وشكراً لانضمامك إلى NOVA',
      t2:'نظام النقاط', t3:'مستعد للبدء؟', btn:'!هيا نبدأ',
      desc:'المجتمع هو <strong>شبكة TikTok تبادلية</strong> — تساعد الآخرين ويساعدونك.' },
  ],
  zh: [
    { icon:'👋', title:'欢迎加入 NOVA Support Pool！',
      f1:'评论其他成员的视频', f2:'赚取积分发布自己的视频', f3:'提升等级和声望',
      g1:'你给予支持', g2:'+1 积分', g3:'你的视频获得支持', g4:'−1 积分',
      note1:'💡 先支持，再发布——这样社区才能保持健康！',
      r1:'在动态中点击视频并留下评论',
      r2:'确认支持——你的积分上涨',
      r3:'积分足够后，发布你自己的视频',
      note2:'🎉 祝你好运——感谢加入 NOVA！',
      t2:'积分系统', t3:'准备好了吗？', btn:'出发！',
      desc:'社区是一个<strong>互助 TikTok 网络</strong>——你帮助他人，他人帮助你。' },
  ],
  ja: [
    { icon:'👋', title:'NOVA Support Pool へようこそ！',
      f1:'メンバーの動画にコメントする', f2:'自分の動画のためにクレジットを貯める', f3:'ランクと評判を上げる',
      g1:'サポートを提供する', g2:'+1 クレジット', g3:'あなたの動画がサポートされる', g4:'−1 クレジット',
      note1:'💡 まずサポートしてから投稿——それがプールを健全に保つコツ！',
      r1:'フィードの動画をタップしてコメントを残す',
      r2:'サポートを確認——クレジットが増える',
      r3:'クレジットが十分たまったら自分の動画を投稿',
      note2:'🎉 頑張って——NOVA の一員になってくれてありがとう！',
      t2:'クレジットシステム', t3:'準備はできた？', btn:'さあ始めよう！',
      desc:'プールは<strong>相互 TikTok コミュニティ</strong>——あなたが人を助け、人があなたを助けます。' },
  ],
  pl: [
    { icon:'👋', title:'Witaj w NOVA Support Pool!',
      f1:'Komentuj filmy innych członków', f2:'Zbieraj kredyty na własne filmy', f3:'Zdobywaj wyższe rangi i reputację',
      g1:'Dajesz wsparcie', g2:'+1 Kredyt', g3:'Twój film dostaje wsparcie', g4:'−1 Kredyt',
      note1:'💡 Najpierw wspieraj, potem publikuj — tak pool pozostaje zdrowy!',
      r1:'Dotknij filmiku w feedzie i zostaw komentarz',
      r2:'Potwierdź wsparcie — kredyty rosną',
      r3:'Gdy masz dość kredytów, opublikuj swój film',
      note2:'🎉 Powodzenia — i dziękujemy, że jesteś częścią NOVA!',
      t2:'System Kredytów', t3:'Gotowy do startu?', btn:'Zaczynamy!',
      desc:'Pool to <strong>wzajemna społeczność TikTok</strong> — pomagasz innym, inni pomagają tobie.' },
  ],
};

function _getSlides() {
  const s = (_OB[state.lang] || _OB.de)[0];
  return [
    {
      icon: s.icon,
      title: s.title,
      body: `
        <p>${s.desc}</p>
        <div class="ob-feature-list">
          <div class="ob-feature"><span>🎯</span><span>${s.f1}</span></div>
          <div class="ob-feature"><span>💰</span><span>${s.f2}</span></div>
          <div class="ob-feature"><span>🏆</span><span>${s.f3}</span></div>
        </div>
      `,
    },
    {
      icon: '💰',
      title: s.t2,
      body: `
        <div class="ob-balance-demo">
          <div class="ob-bal-row ob-bal-row--give">
            <div class="ob-bal-icon">💬</div>
            <div class="ob-bal-text">
              <div class="ob-bal-label">${s.g1}</div>
              <div class="ob-bal-val ob-bal-val--plus">${s.g2}</div>
            </div>
          </div>
          <div class="ob-bal-row ob-bal-row--recv">
            <div class="ob-bal-icon">🎬</div>
            <div class="ob-bal-text">
              <div class="ob-bal-label">${s.g3}</div>
              <div class="ob-bal-val ob-bal-val--minus">${s.g4}</div>
            </div>
          </div>
        </div>
        <p class="ob-note">${s.note1}</p>
      `,
    },
    {
      icon: '🚀',
      title: s.t3,
      body: `
        <div class="ob-ready-list">
          <div class="ob-ready-item"><div class="ob-ready-check">✓</div><span>${s.r1}</span></div>
          <div class="ob-ready-item"><div class="ob-ready-check">✓</div><span>${s.r2}</span></div>
          <div class="ob-ready-item"><div class="ob-ready-check">✓</div><span>${s.r3}</span></div>
        </div>
        <p class="ob-note">${s.note2}</p>
      `,
      btn: s.btn,
    },
  ];
}

let _slide  = 0;
let _el     = null;
let _touchX = 0;

export function shouldShowOnboarding(cu) {
  if (storage.get(STORAGE_KEY)) return false;
  const u = state.db.members?.[cu] || {};
  if (u.onboarded) return false;
  return true;
}

export function startOnboarding(cu) {
  _slide = 0;
  _el    = document.getElementById('onboarding-overlay');
  if (!_el) return;

  _render();
  _el.classList.add('ob--visible');

  // Swipe support
  _el.addEventListener('touchstart', _onTouchStart, { passive: true });
  _el.addEventListener('touchend',   _onTouchEnd,   { passive: true });
}

const _SKIP_LBL = { de:'Überspringen', en:'Skip', id:'Lewati', it:'Salta', es:'Saltar', tr:'Atla', ar:'تخطي', zh:'跳过', ja:'スキップ', pl:'Pomiń' };
const _NEXT_LBL = { de:'Weiter →', en:'Next →', id:'Lanjut →', it:'Avanti →', es:'Siguiente →', tr:'İleri →', ar:'→ التالي', zh:'下一步 →', ja:'次へ →', pl:'Dalej →' };

function _render() {
  if (!_el) return;
  const slides = _getSlides();
  const s      = slides[_slide];
  const last   = _slide === slides.length - 1;
  const lang   = state.lang || 'de';
  const skipLbl = _SKIP_LBL[lang] || _SKIP_LBL.de;
  const nextLbl = last ? `🚀 ${s.btn || _SKIP_LBL.de}` : (_NEXT_LBL[lang] || _NEXT_LBL.de);

  _el.innerHTML = `
    <div class="ob-card ob-slide-in">
      <button class="ob-skip" id="ob-skip">${skipLbl}</button>

      <div class="ob-icon">${s.icon}</div>
      <h2 class="ob-title">${s.title}</h2>
      <div class="ob-body">${s.body}</div>

      <div class="ob-dots">
        ${slides.map((_, i) =>
          `<div class="ob-dot ${i === _slide ? 'ob-dot--active' : ''}"></div>`
        ).join('')}
      </div>

      <button class="btn btn--primary btn--full ob-next" id="ob-next">
        ${nextLbl}
      </button>
    </div>
  `;

  document.getElementById('ob-next')?.addEventListener('click', _advance);
  document.getElementById('ob-skip')?.addEventListener('click', _finish);
}

function _advance() {
  const slides = _getSlides();
  if (_slide < slides.length - 1) {
    _slide++;
    _render();
  } else {
    _finish();
  }
}

function _finish() {
  if (!_el) return;
  _el.classList.remove('ob--visible');
  _el.removeEventListener('touchstart', _onTouchStart);
  _el.removeEventListener('touchend',   _onTouchEnd);

  // Mark as done
  storage.set(STORAGE_KEY, true);
  const cu = state.currentUser;
  if (cu) writeDB(`members/${cu}/onboarded`, true);
}

function _onTouchStart(e) { _touchX = e.touches[0].clientX; }
function _onTouchEnd(e) {
  const slides = _getSlides();
  const dx = e.changedTouches[0].clientX - _touchX;
  if (Math.abs(dx) < 40) return;
  if (dx < 0 && _slide < slides.length - 1) { _slide++; _render(); }
  else if (dx > 0 && _slide > 0)            { _slide--; _render(); }
}
