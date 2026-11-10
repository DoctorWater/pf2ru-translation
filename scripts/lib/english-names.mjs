// Английские имена переведённого предмета для модулей, которые ищут по имени.
//
// Automated Animations сопоставляет предмет со своими записями по `item.name` (английские
// метки: «Fireball», «Longsword»), и после перевода анимации молча не играют. AA даёт штатную
// точку расширения: хук `aa.getRequiredData` получает данные до поиска, а поиск перебирает
// `[...overrideNames, item.name, ...extraNames]`. Мост дописывает в `extraNames` английские
// имена: имя оригинала из флага Babele и, если его нет (вложенные предметы существ), slug,
// который модуль строит из английского имени (pf2ruSlug), — «acid-arrow» -> «acid arrow».
// Без Node-импортов: файл исполняет и Foundry (scripts/init.js), и тесты.

/** Ключ сравнения AA (rinseName): без пробелов, нижний регистр. */
const rinse = (name) => name.replace(/\s+/g, "").toLowerCase();

/** Английские имена предмета, отличные от его текущего имени; [] — искать нечего. */
export function englishNames(item) {
  if (!item) return [];
  const names = [item.flags?.babele?.originalName];
  const slug = item.slug ?? item.system?.slug;
  if (typeof slug === "string" && /^[a-z0-9-]+$/.test(slug)) names.push(slug.replace(/-+/g, " "));
  const seen = new Set([typeof item.name === "string" ? rinse(item.name) : ""]);
  return names.filter((name) => {
    if (typeof name !== "string" || name.trim() === "" || seen.has(rinse(name))) return false;
    seen.add(rinse(name));
    return true;
  });
}
