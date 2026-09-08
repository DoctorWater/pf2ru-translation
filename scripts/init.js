/**
 * Рантайм-регистрация модуля в Babele. Выполняется только внутри Foundry VTT —
 * Node этот файл не запускает (глобалы Hooks/game определяет сам Foundry).
 */

const MODULE_ID = "pf2ru-translation";
const TRANSLATED_LANG = "ru";
const PACKS_DIR = "generated/data/community/pf2e/packs";

/**
 * Аккуратное слияние перевода в исходные данные документа: не ломает массивы/объекты,
 * если типы перевода и оригинала несовместимы — в этом случае просто оставляет оригинал.
 * Используется как конвертер для полей, где Babele сам не умеет мержить безопасно.
 */
function safeMergeConverter(translatedValue, originalValue) {
  if (translatedValue === undefined || translatedValue === null) return originalValue;

  // Массив можно заменить только массивом — иначе не трогаем оригинал.
  if (Array.isArray(originalValue)) {
    return Array.isArray(translatedValue) ? translatedValue : originalValue;
  }

  // Простой текст (строка) — самый частый случай (description/prerequisites/publicNotes).
  if (typeof originalValue === "string") {
    return typeof translatedValue === "string" ? translatedValue : originalValue;
  }

  // Объект вида {value: "..."} — точечно заменяем value, остальное сохраняем.
  if (originalValue && typeof originalValue === "object") {
    if (typeof translatedValue === "string") {
      return { ...originalValue, value: translatedValue };
    }
    if (translatedValue && typeof translatedValue === "object" && !Array.isArray(translatedValue)) {
      return { ...originalValue, ...translatedValue };
    }
    return originalValue;
  }

  return translatedValue;
}

Hooks.once("babele.init", () => {
  if (game.system.id !== "pf2e") return;

  const babele = game.babele;
  if (!babele) {
    console.error(`${MODULE_ID} | Babele не найден — модуль требует зависимость babele`);
    return;
  }

  babele.registerConverters({
    pf2ruSafeMerge: (value, translations, context) =>
      safeMergeConverter(value, context?.original ?? context?.originalValue ?? value),
  });

  // Item: описание, требования, а также прочие переводимые текстовые поля.
  babele.registerMapping("Item", {
    name: "name",
    description: {
      path: "system.description.value",
      converter: "pf2ruSafeMerge",
    },
    prerequisites: {
      path: "system.prerequisites.value",
      converter: "pf2ruSafeMerge",
    },
  });

  // Actor: у существ основной переводимый текст лежит в system.details.publicNotes.
  babele.registerMapping("Actor", {
    name: "name",
    description: {
      path: "system.details.publicNotes",
      converter: "pf2ruSafeMerge",
    },
  });

  babele.register({
    module: MODULE_ID,
    lang: TRANSLATED_LANG,
    dir: PACKS_DIR,
  });

  console.log(`${MODULE_ID} | Babele-переводы зарегистрированы (${PACKS_DIR})`);
});
