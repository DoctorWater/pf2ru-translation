// Ключи навыков в путях правил `ActiveEffectLike`: латиница вместо кириллицы.
//
// PF2e Dailies добавляет навык Lore правилом `ActiveEffectLike` с путём
// `system.skills.<sluggify(подпись)>-lore`. Подпись русская, значит и ключ кириллический
// (`system.skills.знание-лес-lore`). pf2e такое правило отбрасывает: пути ещё нет, а проверка
// «есть ли данные рядом» отрезает последний сегмент регуляркой `/\.[-\w]+$/`, а `\w` в JS —
// только латиница, цифры и `_`: кириллический сегмент не отрезается (AELikeRuleElement, pf2e 8).
//
// Ключ — технический: подпись (`value.label`) остаётся русской, на листе ключа не видно,
// сопоставления переводов он не касается. Поэтому ключ записывается латиницей по таблице ниже.
// Без Node-импортов: файл исполняет и Foundry (scripts/init.js), и тесты.

const RU_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const SKILL_PATH = /^system\.skills\.([^.]+)$/;
// Сегмент, который pf2e умеет отрезать (тот же класс символов, что в его проверке).
const ASCII_SEGMENT = /^[-\w]+$/;

/** `знание-лес-lore` -> `znanie-les-lore`; прочие не-ASCII символы выпадают. */
export function asciiSkillKey(key) {
  const latin = [...key.toLowerCase()].map((ch) => RU_TO_LATIN[ch] ?? ch).join("");
  const slug = latin.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug === "" || slug === "lore" ? null : slug;
}

/**
 * Правила предмета -> исправленная копия, если хоть один путь навыка был не ASCII; иначе null.
 * Правило без перевода ключа (из символов не осталось ничего) не трогается.
 */
export function asciiSkillRules(rules) {
  if (!Array.isArray(rules)) return null;
  let changed = false;
  const fixed = rules.map((rule) => {
    if (rule?.key !== "ActiveEffectLike" || typeof rule.path !== "string") return rule;
    const m = SKILL_PATH.exec(rule.path);
    if (!m || ASCII_SEGMENT.test(m[1])) return rule;
    const key = asciiSkillKey(m[1]);
    if (!key) return rule;
    changed = true;
    return { ...rule, path: `system.skills.${key}` };
  });
  return changed ? fixed : null;
}
