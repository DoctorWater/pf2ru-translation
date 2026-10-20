/**
 * Рантайм-регистрация модуля в Babele. Выполняется только внутри Foundry VTT —
 * Node этот файл не запускает (глобалы Hooks/game определяет сам Foundry).
 */

import { missingDirectives, fallbackBlock, expandLocalize } from "./lib/automation.mjs";

const MODULE_ID = "pf2ru-translation";
const TRANSLATED_LANG = "ru";
const PACKS_DIR = "generated/data/community/pf2e/packs";

/**
 * Описание: перевод плюс хвост автоматизации. Сборка уже вставила директивы по снимку 8.4.1;
 * здесь добираются те, что есть в установленной системе (другая редакция), но нет в переводе.
 * Идемпотентно: текст с хвостом даёт пустую разность. Любая ошибка — перевод как есть.
 */
function convertDescription(value, translation) {
  if (typeof translation !== "string") return undefined;
  try {
    // `@Localize[КЛЮЧ]` в оригинале несёт директивы глоссария: раскрываем их тем же языковым файлом.
    const lookup = (key) => {
      const text = game.i18n.localize(key);
      return text === key ? undefined : text;
    };
    return translation + fallbackBlock(missingDirectives(expandLocalize(value, lookup), expandLocalize(translation, lookup)));
  } catch (error) {
    console.error(`${MODULE_ID} | не удалось восстановить автоматизацию`, error);
    return translation;
  }
}

/**
 * Slug предмета. У встроенных предметов актёров `system.slug` равен null, и pf2e строит его из
 * имени; после перевода имени slug стал бы русским и правила с селектором вроде `glaive-damage`
 * перестали бы срабатывать. Babele пропускает поля с null-оригиналом, поэтому подмена — через `system`.
 */
function convertSlug(value, translation, source) {
  if (!value || Object.hasOwn(value, "slug") === false || value.slug) return undefined;
  try {
    return { slug: game.pf2e.system.sluggify(source.name) };
  } catch (error) {
    console.error(`${MODULE_ID} | не удалось построить slug`, error);
    return undefined;
  }
}

Hooks.once("babele.init", () => {
  if (game.system.id !== "pf2e") return;

  const babele = game.babele;
  if (!babele) {
    console.error(`${MODULE_ID} | Babele не найден — модуль требует зависимость babele`);
    return;
  }

  babele.registerConverters({
    pf2ruDescription: convertDescription,
    pf2ruSlug: convertSlug,
  });

  // Babele 2.9.1 принимает один объект слоёв отображений; строковые пути
  // обрабатывает его встроенный конвертер с проверкой совместимости типов.
  babele.registerMapping({
    Item: {
      name: "name",
      description: { path: "system.description.value", converter: "pf2ruDescription" },
      prerequisites: "system.prerequisites.value",
      slug: { path: "system", converter: "pf2ruSlug" },
    },
    Actor: {
      name: "name",
      description: { path: "system.details.publicNotes", converter: "pf2ruDescription" },
    },
  });

  babele.register({
    module: MODULE_ID,
    lang: TRANSLATED_LANG,
    dir: PACKS_DIR,
  });

  console.log(`${MODULE_ID} | Babele-переводы зарегистрированы (${PACKS_DIR})`);
});
