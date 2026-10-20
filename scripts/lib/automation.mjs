// Автоматизация Foundry внутри описаний: какие директивы считаются «автоматизацией», как
// сверить оригинал с итогом и как оформить то, что не удалось поставить в текст.
//
// Лицензированный русский текст PF2.ru директив Foundry не содержит, поэтому подмена
// английского описания теряет кнопки шаблонов, проверок и бросков. Здесь — общая для
// сборки и рантайма (scripts/init.js) логика: без Node-импортов, только строки.
//
// Единица сравнения — ключ: директива без подписи (`@Check[reflex|dc:20|basic]`). Подпись
// переводима и в ключ не входит. Сравнение по присутствию: ключ оригинала обязан быть в
// итоге хотя бы раз (потеря) и не чаще, чем в оригинале (дубль). Повторы одного ключа в
// хвосте не нужны — кнопка та же, — поэтому счёт «ровно столько же» не требуется.

import { extractProtectedTokens } from "./tokens.mjs";

const ROLL_ALIASES = {
  r: "r", roll: "r", pr: "r", publicroll: "r", sr: "r", selfroll: "r",
  gmr: "gmr", gmroll: "gmr", br: "br", blindroll: "br", act: "act",
};
const ROLL_RE = /^\[\[\/(r|roll|pr|publicroll|sr|selfroll|gmr|gmroll|br|blindroll|act)(?=[\s\]])/;
// Автоматизацией считаются только ссылки на документы с правилами: состояния, эффекты
// (`*-effects`), действия приключений и макросы действий. Остальные ссылки (заклинания,
// умения, снаряжение, журналы, актёры) — навигация: в хвост и gate не входят, а потеря
// считается в lostNavigation.
const UUID_AUTOMATION_RE =
  /^@UUID\[Compendium\.pf2e\.(?:conditionitems\.Item|[^.\]]+-effects\.Item|adventure-specific-actions\.Item|action-macros\.Macro)\./;
const SIMPLE_DICE_RE = /^\(?\d+d\d+(?:[+-]\d+)?\)?$/;

/** Индекс закрывающей скобки, парной открывающей str[start]. */
function closing(str, start, open, close) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === open) depth++;
    else if (str[i] === close && --depth === 0) return i;
  }
  return -1;
}

/**
 * Разбор токена директивы: {head, label, kind} либо null, если токен — не директива
 * автоматизации. head — токен без подписи `{...}`.
 */
export function parseDirective(token) {
  let kind;
  let headEnd;
  if (token.startsWith("@")) {
    const name = /^@(Template|Check|Damage|UUID)\[/.exec(token)?.[1];
    if (!name) return null;
    if (name === "UUID" && !UUID_AUTOMATION_RE.test(token)) return null;
    kind = name;
    headEnd = closing(token, token.indexOf("["), "[", "]");
  } else {
    const cmd = ROLL_RE.exec(token)?.[1];
    if (!cmd) return null;
    kind = ROLL_ALIASES[cmd];
    headEnd = closing(token, 0, "[", "]");
  }
  if (headEnd === -1) return null;
  const head = token.slice(0, headEnd + 1);
  const rest = token.slice(headEnd + 1);
  const label = rest.startsWith("{") && rest.endsWith("}") ? rest.slice(1, -1) : null;
  return { head, label, kind };
}

/** Директивы автоматизации текста в порядке появления: [{token, head, label, kind}]. */
export function automationDirectives(text) {
  const out = [];
  for (const token of extractProtectedTokens(typeof text === "string" ? text : "")) {
    const parsed = parseDirective(token);
    if (parsed) out.push({ token, ...parsed });
  }
  return out;
}

/** Вид записи в хвосте: подписи снимаются (pf2e подставит русские), у бросков остаётся формула. */
export function tailForm({ head, kind }) {
  if (kind !== "r" && kind !== "gmr" && kind !== "br") return head;
  const formula = /^\[\[\/\w+\s+(\S+)/.exec(head)?.[1];
  return formula && SIMPLE_DICE_RE.test(formula) ? `${head}{${formula}}` : head;
}

function countKeys(directives) {
  const counts = new Map();
  for (const { head } of directives) counts.set(head, (counts.get(head) ?? 0) + 1);
  return counts;
}

/**
 * Директивы оригинала, которых нет в переводе, в форме хвоста. Без повторов; порядок —
 * порядок оригинала. Работает по присутствию, поэтому текст, уже несущий хвост, даёт
 * пустой список: функция идемпотентна.
 */
export function missingDirectives(original, current) {
  const have = countKeys(automationDirectives(current));
  const out = [];
  const seen = new Set();
  for (const d of automationDirectives(original)) {
    if (have.has(d.head) || seen.has(d.head)) continue;
    seen.add(d.head);
    out.push(tailForm(d));
  }
  return out;
}

/**
 * Ключи, встречающиеся в итоге чаще, чем в оригинале, — дубли, внесённые конвейером. Что
 * стояло в русском тексте до него (ссылки viewbox, которых нет в оригинале), не считается.
 */
export function surplusDirectives(original, current, input = "") {
  const want = countKeys(automationDirectives(original));
  const had = countKeys(automationDirectives(input));
  const out = [];
  for (const [head, count] of countKeys(automationDirectives(current))) {
    if (count > Math.max(want.get(head) ?? 0, had.get(head) ?? 0)) out.push(head);
  }
  return out;
}

/** Хвост описания: пустая строка, если восстанавливать нечего. */
export function fallbackBlock(list) {
  if (!list || list.length === 0) return "";
  return `<hr><p class="pf2ru-automation"><strong>Автоматизация:</strong> ${list.join(" ")}</p>`;
}

/**
 * Проверка итога против оригинала: [{reason: "lost"|"duplicate", token}]. Пустой список —
 * автоматизация сохранена.
 */
export function automationViolations(original, final, input = "") {
  return [
    ...missingDirectives(original, final).map((token) => ({ reason: "lost", token })),
    ...surplusDirectives(original, final, input).map((token) => ({ reason: "duplicate", token })),
  ];
}

/** Текст с директивами, замененными своими подписями: то, что видит читатель. */
export function unwrapDirectives(text) {
  let out = text;
  for (const token of extractProtectedTokens(text)) {
    if (!token.startsWith("@") && !token.startsWith("[[")) continue;
    const label = /\{([^{}]*)\}$/.exec(token)?.[1];
    if (label !== undefined) out = out.replace(token, () => label);
  }
  return out;
}

const NAVIGATION_RE = /^@(?:UUID|Localize)\[/;

/** Ключи навигации оригинала (журналы, актёры, глоссарий), которых нет в итоге. Не гейт — счётчик отчёта. */
export function lostNavigation(original, final) {
  const have = new Set(extractProtectedTokens(final).filter((t) => NAVIGATION_RE.test(t)).map(stripLabel));
  const out = new Set();
  for (const token of extractProtectedTokens(original)) {
    if (!NAVIGATION_RE.test(token) || parseDirective(token)) continue;
    const key = stripLabel(token);
    if (!have.has(key)) out.add(key);
  }
  return [...out];
}

function stripLabel(token) {
  const end = closing(token, token.indexOf("["), "[", "]");
  return end === -1 ? token : token.slice(0, end + 1);
}

/** Описание, целиком состоящее из `@Localize[...]` (глоссарная способность): книжный текст его только затирает. */
export function isLocalizeOnly(text) {
  return typeof text === "string" && /^\s*(?:<p>\s*)?@Localize\[[^\]]+\]\s*(?:<\/p>)?\s*$/.test(text);
}

/**
 * Раскрывает `@Localize[KEY]` в текст ключа: директивы глоссария (`PF2E.NPC.Abilities.Glossary.*`)
 * живут в языковом файле, а не в описании, и книжный текст их не несёт. lookup(key) -> строка
 * либо undefined; нераскрытая ссылка остаётся как есть.
 */
export function expandLocalize(text, lookup) {
  if (typeof text !== "string" || !text.includes("@Localize[")) return text;
  return text.replace(/@Localize\[([^\]|]+)(?:\|[^\]]*)?\](?:\{[^}]*\})?/g, (whole, key) => {
    const value = lookup(key.trim());
    return typeof value === "string" ? value : whole;
  });
}

/** Различаются ли наборы директив у оригинала и хотя бы одного из одноимённых предметов. */
export function directiveSetsDiffer(original, others) {
  const headsOf = (text) => new Set(automationDirectives(text).map((d) => d.head));
  const own = headsOf(original);
  return others.some((text) => {
    const other = headsOf(text);
    return other.size !== own.size || [...own].some((head) => !other.has(head));
  });
}
