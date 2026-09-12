/**
 * Рантайм-регистрация модуля в Babele. Выполняется только внутри Foundry VTT —
 * Node этот файл не запускает (глобалы Hooks/game определяет сам Foundry).
 */

const MODULE_ID = "pf2ru-translation";
const TRANSLATED_LANG = "ru";
const PACKS_DIR = "generated/data/community/pf2e/packs";

Hooks.once("babele.init", () => {
  if (game.system.id !== "pf2e") return;

  const babele = game.babele;
  if (!babele) {
    console.error(`${MODULE_ID} | Babele не найден — модуль требует зависимость babele`);
    return;
  }

  // Babele 2.9.1 принимает один объект слоёв отображений; строковые пути
  // обрабатывает его встроенный конвертер с проверкой совместимости типов.
  babele.registerMapping({
    Item: {
      name: "name",
      description: "system.description.value",
      prerequisites: "system.prerequisites.value",
    },
    Actor: {
      name: "name",
      description: "system.details.publicNotes",
    },
  });

  babele.register({
    module: MODULE_ID,
    lang: TRANSLATED_LANG,
    dir: PACKS_DIR,
  });

  console.log(`${MODULE_ID} | Babele-переводы зарегистрированы (${PACKS_DIR})`);
});
