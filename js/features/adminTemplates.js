/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Template Library (B2.6)
   20 comment templates per language for the support flow
   ═══════════════════════════════════════════════════════ */

export const TEMPLATES = {
  de: [
    'Super Video! Weiter so! 🔥',
    'Tolles Content, macht weiter! 💪',
    'Sehr hilfreich, danke fürs Teilen! 👍',
    'Klasse Video, weiter so! ⭐',
    'Hammer Content! 💯',
    'Sehr gute Arbeit! 👏',
    'Das ist wirklich gut gemacht! 🎉',
    'Mega Beitrag, gefällt mir sehr! 😍',
    'Authentisch und inspirierend! 🌟',
    'Guter Rhythmus, schöne Schnitte! ✂️',
    'Toller Aufbau! Mach weiter 🚀',
    'Wow, sehr kreativ! 🎨',
    'Das hilft echt weiter, danke! 🙏',
    'Kurz und knackig — perfekt! ⚡',
    'Sehr professionell umgesetzt! 🏆',
    'Hat mir richtig gut gefallen! ❤️',
    'Immer wieder gerne! 👌',
    'Sauber produziert! 🎬',
    'Weiter so, du bist auf dem richtigen Weg! 💫',
    'Klasse Arbeit, bin beeindruckt! 🌈',
  ],
  en: [
    'Great video! Keep it up! 🔥',
    'Awesome content, keep going! 💪',
    'Very helpful, thanks for sharing! 👍',
    'Love this video! ⭐',
    'Incredible work! 💯',
    'Amazing content! 👏',
    'Really well done! 🎉',
    'Loved every second of it! 😍',
    'Authentic and inspiring! 🌟',
    'Great editing and flow! ✂️',
    'Awesome structure! Keep it up 🚀',
    'Wow, so creative! 🎨',
    'This is genuinely helpful, thanks! 🙏',
    'Short and punchy — perfect! ⚡',
    'Very professionally done! 🏆',
    'Really enjoyed this! ❤️',
    'Would watch again! 👌',
    'Clean production! 🎬',
    'Keep it up, you\'re on the right track! 💫',
    'Fantastic work, very impressed! 🌈',
  ],
  id: [
    'Video yang bagus! Teruskan! 🔥',
    'Konten keren banget! 💪',
    'Sangat membantu, terima kasih! 👍',
    'Suka banget videonya! ⭐',
    'Luar biasa! 💯',
    'Kerja yang bagus! 👏',
    'Benar-benar bagus! 🎉',
    'Suka setiap detiknya! 😍',
    'Otentik dan menginspirasi! 🌟',
    'Edit yang bagus! ✂️',
    'Struktur yang keren! 🚀',
    'Wow, sangat kreatif! 🎨',
    'Sungguh membantu, terima kasih! 🙏',
    'Singkat dan padat — sempurna! ⚡',
    'Sangat profesional! 🏆',
    'Sangat menikmatinya! ❤️',
    'Mau nonton lagi! 👌',
    'Produksi yang bersih! 🎬',
    'Tetap semangat! 💫',
    'Luar biasa, sangat terkesan! 🌈',
  ],
  tr: [
    'Harika video! Devam et! 🔥',
    'Müthiş içerik! 💪',
    'Çok faydalı, teşekkürler! 👍',
    'Bu videoyu sevdim! ⭐',
    'İnanılmaz! 💯',
    'Harika iş! 👏',
    'Gerçekten çok iyi! 🎉',
    'Her saniyesini sevdim! 😍',
    'Özgün ve ilham verici! 🌟',
    'Harika kurgu! ✂️',
    'Süper yapı! Devam 🚀',
    'Vay, çok yaratıcı! 🎨',
    'Gerçekten faydalı, teşekkürler! 🙏',
    'Kısa ve öz — mükemmel! ⚡',
    'Çok profesyonel! 🏆',
    'Gerçekten keyif aldım! ❤️',
    'Tekrar izlerim! 👌',
    'Temiz prodüksiyon! 🎬',
    'Devam et, doğru yoldasın! 💫',
    'Fantastik, çok etkilendim! 🌈',
  ],
  es: [
    '¡Buen video! ¡Sigue así! 🔥',
    '¡Contenido increíble! 💪',
    '¡Muy útil, gracias por compartir! 👍',
    '¡Me encantó este video! ⭐',
    '¡Increíble trabajo! 💯',
    '¡Contenido increíble! 👏',
    '¡Realmente bien hecho! 🎉',
    '¡Me encantó cada segundo! 😍',
    '¡Auténtico e inspirador! 🌟',
    '¡Excelente edición! ✂️',
    '¡Estructura genial! 🚀',
    '¡Vaya, tan creativo! 🎨',
    '¡Realmente útil, gracias! 🙏',
    '¡Breve y directo — perfecto! ⚡',
    '¡Muy profesional! 🏆',
    '¡Lo disfruté mucho! ❤️',
    '¡Lo vería de nuevo! 👌',
    '¡Producción limpia! 🎬',
    '¡Sigue así, vas por buen camino! 💫',
    '¡Trabajo fantástico, muy impresionado! 🌈',
  ],
};

/** Returns templates for given lang, falls back to de */
export function getTemplates(lang) {
  return TEMPLATES[lang] || TEMPLATES.de;
}

/** Render a 2-column template picker grid */
export function renderTemplatePicker(lang, onSelect) {
  const tmpl = getTemplates(lang);
  return `
    <div class="tmpl-grid" id="tmpl-grid">
      ${tmpl.map((text, i) => `
        <button class="tmpl-chip" data-action="tmpl:pick" data-idx="${i}"
          aria-label="${text.replace(/['"]/g, '')}">
          ${text}
        </button>
      `).join('')}
    </div>
  `;
}
