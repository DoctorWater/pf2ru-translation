// Модуль защищённых токенов Foundry-разметки: @Directive[...]{...}, [[...]], {{...}},
// {placeholder}, ${...}, %1$s, HTML-теги и сущности. Извлекаем их как непрозрачные подстроки,
// чтобы сравнивать НАБОР токенов между английским оригиналом и переводом, не трогая сам текст.
// Несовпадение множеств — не ошибка сборки, а повод для предупреждения в отчёте
// (лицензированный текст мы не правим).

/** Находит индекс символа close, закрывающего open, начиная с str[start] === open (с учётом вложенности). */
function findBalanced(str, start, open, close) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === open) depth++;
    else if (str[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const DIRECTIVE_NAME_RE = /^@[A-Za-z][A-Za-z0-9]*/;
const SIMPLE_PLACEHOLDER_RE = /^\{[A-Za-z0-9_]+\}/;
const PRINTF_RE = /^%(?:\d+\$)?[a-zA-Z]/;
const HTML_TAG_RE = /^<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*)?\/?>/;
const HTML_ENTITY_RE = /^&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/;

/**
 * Извлекает список защищённых токенов из текста в порядке появления.
 * @param {string} text
 * @returns {string[]}
 */
export function extractProtectedTokens(text) {
  const tokens = [];
  if (typeof text !== "string" || text.length === 0) return tokens;

  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];

    // @UUID[...]{...} / @Check[...] и т.п.
    if (ch === "@") {
      const m = DIRECTIVE_NAME_RE.exec(text.slice(i));
      if (m && text[i + m[0].length] === "[") {
        const bracketStart = i + m[0].length;
        const bracketEnd = findBalanced(text, bracketStart, "[", "]");
        if (bracketEnd !== -1) {
          let end = bracketEnd + 1;
          if (text[end] === "{") {
            const braceEnd = findBalanced(text, end, "{", "}");
            if (braceEnd !== -1) end = braceEnd + 1;
          }
          tokens.push(text.slice(i, end));
          i = end;
          continue;
        }
      }
    }

    // [[...]] — инлайн-роллы Foundry (внутри могут быть вложенные одиночные скобки, напр. [[/r 1d6[fire]]])
    if (ch === "[" && text[i + 1] === "[") {
      const end = findBalanced(text, i, "[", "]");
      if (end !== -1) {
        let closeEnd = end + 1;
        if (text[closeEnd] === "{") {
          const braceEnd = findBalanced(text, closeEnd, "{", "}");
          if (braceEnd !== -1) closeEnd = braceEnd + 1;
        }
        tokens.push(text.slice(i, closeEnd));
        i = closeEnd;
        continue;
      }
    }

    // ${...} — шаблонная строка
    if (ch === "$" && text[i + 1] === "{") {
      const end = findBalanced(text, i + 1, "{", "}");
      if (end !== -1) {
        tokens.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // {{...}} — handlebars-шаблон
    if (ch === "{" && text[i + 1] === "{") {
      const end = findBalanced(text, i, "{", "}");
      if (end !== -1) {
        tokens.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // {placeholder} — простая подстановка
    if (ch === "{") {
      const m = SIMPLE_PLACEHOLDER_RE.exec(text.slice(i));
      if (m) {
        tokens.push(m[0]);
        i += m[0].length;
        continue;
      }
    }

    // %1$s, %s и т.п.
    if (ch === "%") {
      const m = PRINTF_RE.exec(text.slice(i));
      if (m) {
        tokens.push(m[0]);
        i += m[0].length;
        continue;
      }
    }

    // HTML-тег
    if (ch === "<") {
      const m = HTML_TAG_RE.exec(text.slice(i));
      if (m) {
        tokens.push(m[0]);
        i += m[0].length;
        continue;
      }
    }

    // HTML-сущность
    if (ch === "&") {
      const m = HTML_ENTITY_RE.exec(text.slice(i));
      if (m) {
        tokens.push(m[0]);
        i += m[0].length;
        continue;
      }
    }

    i++;
  }

  return tokens;
}

/** Сравнивает мультимножества защищённых токенов двух текстов (порядок не важен). */
export function tokensEquivalent(originalText, translatedText) {
  const a = extractProtectedTokens(originalText).sort();
  const b = extractProtectedTokens(translatedText).sort();
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// --- Плейсхолдеры интерфейса -------------------------------------------------------------
// Для строк lang/*.json критичны не все токены, а подстановки Foundry вида {name} /
// {condition-list} / %1$s: их потеря или переименование в переводе ломает рендер
// (в интерфейсе появляется буквальное «{name}»). Подписи внутри директив
// (@UUID[...]{Label}, [[/act trip]]{Label}) переводить можно, поэтому они исключаются.

const INTERFACE_PLACEHOLDER_RE = /\{[^{}\s]+\}|%(?:\d+\$)?[a-zA-Z]/g;

/**
 * Извлекает мультимножество плейсхолдеров интерфейсной строки (без подписей директив).
 * @param {string} text
 * @returns {string[]} отсортированный список
 */
export function extractPlaceholders(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  let stripped = text;
  for (const token of extractProtectedTokens(text)) {
    if (token.startsWith("@") || token.startsWith("[[")) stripped = stripped.split(token).join(" ");
  }
  return (stripped.match(INTERFACE_PLACEHOLDER_RE) ?? []).sort();
}

/** Совпадают ли мультимножества плейсхолдеров оригинала и перевода. */
export function placeholdersEquivalent(originalText, translatedText) {
  const a = extractPlaceholders(originalText);
  const b = extractPlaceholders(translatedText);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
