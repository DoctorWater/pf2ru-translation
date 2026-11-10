// slug модификаторов и кубиков урона в правилах переведённого предмета — как в английской игре.
//
// pf2e выводит slug правила без своего `slug` так (pf2e 8.7):
//   FlatModifier — sluggify(подпись); подпись по умолчанию — имя предмета, ключ локализуется, `{item|name}`
//                  подставляется; подпись, равная имени предмета, сокращается reduceItemName («Effect: Cover» -> «Cover»);
//                  type "ability" — slug из характеристики;
//   DamageDice   — sluggify(имя предмета), подпись не участвует.
// С переводом имя и ключи русские, slug становится русским («атака-исподтишка»), и правила, которые ищут
// модификатор по английскому slug (AdjustModifier `rage`, `cover`, `double-shot`…), молча не срабатывают.
// Здесь slug проставляется явно тем значением, которое pf2e вывел бы в английской игре. Подпись своим текстом
// (не ключ, без `{item|name}`) не трогаем — её pf2e читает одинаково. Без Node-импортов: файл исполняет
// Foundry (scripts/init.js) и тесты.

/** reduceItemName pf2e: имя с двоеточием теряет «Префикс: » и хвостовое «(…)». */
export const reduceItemName = (name) => (name.includes(":") ? name.replace(/^[^:]+:\s*|\s*\([^)]+\)$/g, "") : name);

const KEY = /^[A-Z][\w-]*(\.[\w-]+)+$/;

/**
 * rules — правила предмета; englishName — английское имя переведённого предмета или null (предмет не переведён:
 * pf2e и так считает slug из имени верно); englishText(key) — английский текст ключа или undefined; sluggify — функция pf2e.
 * -> новый массив, если хоть одно правило получило slug; иначе null.
 */
export function englishRuleSlugs(rules, englishName, englishText, sluggify) {
  if (!Array.isArray(rules)) return null;
  let changed = false;
  const fixed = rules.map((rule) => {
    if (!rule || rule.slug) return rule;
    let english;
    if (rule.key === "DamageDice") english = englishName;
    else if (rule.key === "FlatModifier" && rule.type !== "ability") {
      const label = rule.label;
      if (label === undefined || label === null || label === "") english = englishName && reduceItemName(englishName);
      else if (typeof label === "string" && KEY.test(label)) english = englishText(label);
      else if (typeof label === "string" && label.includes("{item|name}") && englishName && !/\{(?!item\|name\})[^}]*\}/.test(label)) {
        const text = label.replaceAll("{item|name}", englishName);
        english = text === englishName ? reduceItemName(text) : text;
      }
    }
    if (typeof english !== "string" || english.trim() === "") return rule;
    const slug = sluggify(english);
    if (!slug) return rule;
    changed = true;
    return { ...rule, slug };
  });
  return changed ? fixed : null;
}
