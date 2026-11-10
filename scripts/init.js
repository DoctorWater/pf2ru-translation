/**
 * Рантайм-регистрация модуля в Babele. Выполняется только внутри Foundry VTT —
 * Node этот файл не запускает (глобалы Hooks/game определяет сам Foundry).
 */

import { missingDirectives, fallbackBlock, expandLocalize } from "./lib/automation.mjs";
import { asciiSkillRules } from "./lib/skill-slug.mjs";
import { englishNames } from "./lib/english-names.mjs";
import { englishRuleSlugs } from "./lib/rule-slug.mjs";

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
 * Английское описание в `flags.babele.originalPayload.description`. Поле с конвертером Babele сохраняет в
 * оригинал, только если у конвертера есть `extract`; без него там одно имя. Оригинал читают модули, которые
 * разбирают английский текст как данные (pf2e-automato: шаблон активации, вывод правил из разметки).
 */
convertDescription.extract = (value) => (typeof value === "string" ? value : undefined);

/** Английский текст ключа локализации (резервный язык Foundry) или undefined. */
function englishText(key) {
  const text = foundry.utils.getProperty(game.i18n?._fallback ?? {}, key);
  return typeof text === "string" ? text : undefined;
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

/**
 * slug модификаторов и кубиков в правилах без своего slug (rule-slug.mjs). pf2e выводит его из подписи —
 * переведённого имени предмета или ключа, — и AdjustModifier по английскому slug (`rage`, `double-shot`)
 * молчит. Правила готовятся из подготовленных данных предмета (`system.rules`) в prepareRuleElements:
 * подставляем slug в эту копию до сборки правил. Данные мира не меняются, покрыты и предметы, уже
 * лежащие на листах. Английское имя — флаг Babele `originalName`, только если имя переведено (иначе pf2e
 * считает slug из имени сам и верно); ключи подписей — английским текстом резервного языка (в английской
 * игре он пуст, и ветка молчит).
 */
function patchRuleSlugs() {
  const wrapper = globalThis.libWrapper;
  const classes = globalThis.CONFIG?.PF2E?.Item?.documentClasses;
  if (!wrapper || !classes) return;
  const sluggify = (text) => game.pf2e.system.sluggify(text);
  const prepare = function (wrapped, ...args) {
    try {
      const original = this.flags?.babele?.originalName;
      const name = typeof original === "string" && original !== this.name ? original : null;
      const fixed = englishRuleSlugs(this.system?.rules, name, englishText, sluggify);
      if (fixed) this.system.rules = fixed;
    } catch (error) {
      console.error(`${MODULE_ID} | slug правил не подставлен`, error);
    }
    return wrapped(...args);
  };
  for (const type of Object.keys(classes)) safeRegister(wrapper, `CONFIG.PF2E.Item.documentClasses.${type}.prototype.prepareRuleElements`, prepare);
}

/** Регистрация обёртки без риска для остального babele.init: сбой одной не отменяет регистрацию переводов. */
function safeRegister(wrapper, target, fn) {
  try {
    wrapper.register(MODULE_ID, target, fn, "WRAPPER");
  } catch (error) {
    console.error(`${MODULE_ID} | обёртка ${target} не зарегистрирована`, error);
  }
}

/** «30 футов» -> 30; «30 футовый конус» и прочее — null, как «30-foot cone» у системы. */
const RUSSIAN_FEET = /^(\d+)\s*фут(?:ов|а)?(?![а-яё])/i;

/**
 * Дистанция заклинания переведена, а система читает её из текста: `isMelee` сверяет
 * `system.range.value` с "touch", `range` ищет «N feet». Обёртки понимают и русское значение;
 * английское по-прежнему разбирает сама система.
 */
function patchSpellRange() {
  const wrapper = globalThis.libWrapper;
  if (!wrapper) {
    console.error(`${MODULE_ID} | libWrapper не найден — дальность переведённых заклинаний не распознаётся`);
    return;
  }
  const spell = "CONFIG.PF2E.Item.documentClasses.spell.prototype";
  safeRegister(wrapper, `${spell}.isMelee`, function (wrapped) {
    return wrapped() || String(this.system.range?.value ?? "").trim().toLowerCase() === "касание";
  });
  safeRegister(wrapper, `${spell}.range`, function (wrapped) {
    const range = wrapped();
    if (range) return range;
    const feet = RUSSIAN_FEET.exec(String(this.system.range?.value ?? "").trim());
    return feet ? { increment: null, max: Number(feet[1]) } : null;
  });
}

/**
 * Навыки с русской подписью в правилах предметов (PF2e Dailies: Lore сущностей анимиста и
 * введённые игроком). Ключ навыка в пути `ActiveEffectLike` выводится из подписи и становится
 * кириллическим, а такой путь pf2e отбрасывает (skill-slug.mjs). Ключ переписывается латиницей
 * до записи, подпись остаётся русской. Без модуля перевода поведение прежнее.
 */
function registerSkillKeyBridge() {
  Hooks.on("preCreateItem", (item) => {
    const fixed = asciiSkillRules(item._source?.system?.rules);
    if (fixed) item.updateSource({ "system.rules": fixed });
  });
  Hooks.on("preUpdateItem", (_item, changes) => {
    const fixed = asciiSkillRules(changes?.system?.rules);
    if (fixed) changes.system.rules = fixed;
  });
}

/**
 * Automated Animations ищет анимацию по `item.name` среди английских меток. Его хук
 * `aa.getRequiredData` срабатывает до поиска: дописываем английские имена (english-names.mjs).
 * Обычно в `extraNames` (поиск перебирает их после имени предмета), но у оружия и ударов обработчик
 * pf2e в AA сбрасывает `extraNames` и кладёт туда локализованные базовый тип и группу, — им английские
 * имена и английские тип и группа идут в `overrideNames`, который AA не трогает. Без AA хук не вызывается.
 */
function registerAnimationNameBridge() {
  Hooks.on("aa.getRequiredData", (data) => {
    const item = data?.item;
    const names = englishNames(item);
    if (["weapon", "melee"].includes(item?.type)) {
      const base = globalThis.CONFIG?.PF2E?.baseWeaponTypes?.[item.baseType ?? item.system?.baseItem];
      const group = globalThis.CONFIG?.PF2E?.weaponGroups?.[item.group ?? item.system?.group];
      for (const key of [base, group]) {
        const text = typeof key === "string" ? englishText(key) : undefined;
        if (text && !names.includes(text)) names.push(text);
      }
      if (names.length) data.overrideNames = [...(data.overrideNames ?? []), ...names];
    } else if (names.length) data.extraNames = [...(data.extraNames ?? []), ...names];
  });
}

Hooks.once("babele.init", () => {
  if (game.system.id !== "pf2e") return;
  patchSpellRange();
  patchRuleSlugs();
  registerSkillKeyBridge();
  registerAnimationNameBridge();

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
      // Поля заклинания из шапки PF2.ru (spell-header.mjs).
      range: "system.range.value",
      target: "system.target.value",
      duration: "system.duration.value",
      time: "system.time.value",
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
