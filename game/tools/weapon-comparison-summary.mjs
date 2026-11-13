import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {STEVE_WEAPONS} from '../steve-weapons.js';
const artifact=name=>new URL('../artifacts/'+name,import.meta.url);
const read=async name=>JSON.parse(await readFile(artifact(name),'utf8'));
const [before,beforeLate,after,afterLate]=await Promise.all(['baseline','baseline-late','after','after-late'].map(label=>read(`weapon-comparison-${label}.json`)));
const hashes={};
for(const file of ['survival-core.js','steve-weapons.js','extra-weapons.js','endless-director.js','economy.js'])hashes[file]=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
for(const [name,report]of [['after',after],['after-late',afterLate]]){
 if(report.rows.length!==17||report.seeds.length!==3)throw new Error(name+' must cover seventeen weapons and three seeds');
 for(const [file,hash]of Object.entries(hashes))if(report.fingerprints[file]!==hash)throw new Error(name+'/'+file+' does not match current source');
 for(const row of report.rows){
  const current=STEVE_WEAPONS.find(w=>w.id===row.weapon.id);if(!current)throw new Error('Missing weapon '+row.weapon.id);
  for(const field of ['price','damage','interval','range','arc','knockback','pierce','burn','penetrationFalloff','slowDuration','slowStrength'])if(current[field]!==row.weapon[field])throw new Error(name+'/'+row.weapon.id+'/'+field+' changed');
 }
}
const byId=report=>new Map(report.rows.map(r=>[r.weapon.id,r]));
const old=byId(before),oldLate=byId(beforeLate),newEarly=byId(after),newLate=byId(afterLate);
const c=(r,name,upgraded=false)=>r.controls.find(c=>c.scenario===name&&c.upgraded===upgraded).dps;
const n=value=>String(value).replace('.',',');
const row=r=>{const late=newLate.get(r.weapon.id);return `| ${r.weapon.name} | ${r.weapon.price} | ${n(c(r,'single'))} | ${n(c(r,'crowd'))} | ${n(r.summary.averageKills)} | ${n(late.summary.averageKills)} | ${late.summary.survived}/3 | ${n(late.summary.averageDamageTaken)} |`;};
const changed=['stone-axe','golden-sword','iron-axe','diamond-axe','netherite-axe','crossbow','ember-staff'];
const delta=changed.map(id=>{const a=oldLate.get(id),b=newLate.get(id);return `| ${b.weapon.name} | ${n(a.summary.averageKills)} → ${n(b.summary.averageKills)} | ${a.summary.survived}/3 → ${b.summary.survived}/3 | ${n(a.summary.averageDamageTaken)} → ${n(b.summary.averageDamageTaken)} |`;});
const coreHash=hashes['survival-core.js'];
const md=`# Итоговое сравнение оружия — 5 ноября 2026

**Все пять хешей обоих итоговых отчётов совпадают с текущими исходниками.** Проверены ядро, каталог, дополнительные предметы, директор и экономика. В after покрыты 17 предметов × 3 seed × два срока (180/360 с): **102 естественных забега**. Это уже финальный пропорциональный навык лука, без прежнего универсального ограничения 0,6 с.

## Как измерено

Seed: ${after.seeds.join(', ')}. Естественные забеги исполняют настоящую симуляцию с обычным здоровьем, реальными врагами, добычей, навыками и заработанными улучшениями. Используется общий тактический бот с решениями раз в 0,1 с и доступом к состоянию; здоровье, опыт, спавны и сроки боссов не подменяются. Выбор предмета — сценарий снаряжения, а не моделирование его покупки с нуля.

Отдельные 12-секундные тесты Single/Crowd/Closing lane используют бессмертные неподвижные мишени. Позиции мишеней закреплены: это изолирует фактические попадания/секторы/пробитие/поджог от отпихивания. Crowd — компактная группа двенадцати целей; такой постоянной плотности в настоящем бою не обещается. Проверены базовые параметры и один одинаковый восьмиранговый билд. Навыки в этих отдельных тестах не включаются.

Три seed — небольшая разведочная выборка. Изменившийся момент убийства также меняет потребление общего RNG, доступные улучшения и траекторию добычи; поэтому отдельный более плохой outcome после усиления не доказывает причинную связь. Рейтинг по числу убийств не универсален: в первых трёх минутах сильные предметы упираются в число доступных спавнов. Эти результаты не являются человеческой проверкой и не доказывают окончательного идеального баланса.

## Текущие результаты

| Оружие | Цена | Single DPS | Compact crowd DPS | Убийства 180 с, среднее | Убийства 360 с, среднее | Выжили 360 с | Полученный урон 360 с, среднее |
|---|---:|---:|---:|---:|---:|---:|---:|
${[...after.rows].sort((a,b)=>a.weapon.price-b.weapon.price).map(row).join('\n')}

Бумажный и измеренный DPS могут немного различаться из-за первого готового выстрела, времени полёта и конечного 12-секундного окна. Crowd DPS суммирует фактический урон всем мишеням, а не предполагает попадание по одной цели.

## Что изменилось относительно прежних 15 предметов

| Предмет | Убийства 360 с: до → после | Выживание: до → после | Полученный урон: до → после |
|---|---:|---:|---:|
${delta.join('\n')}

- **Арбалет:** его базовый урон по линии в фиксированной расстановке уменьшился с ${n(c(old.get('crossbow'),'closing-lane'))} до ${n(c(newEarly.get('crossbow'),'closing-lane'))} DPS. С одинаковым восьмиранговым билдом crowd DPS снизился с ${n(c(old.get('crossbow'),'crowd',true))} до ${n(c(newEarly.get('crossbow'),'crowd',true))}. Теперь 48 урона, интервал 1,8 с, две цели, 10,8 м; вторичная цель получает 72% предыдущего урона. Это сохраняет направленное пробитие без старого тройного полного попадания.
- **Навык лука:** старый код давал медленному арбалету/метательному трезубцу непропорциональный скачок темпа до 0,6 с. Теперь ranged-режим ускоряет текущий темп на 30%, сохраняя полный урон, с безопасными нижними пределами. Он не стирает различия между лёгким и тяжёлым оружием и не ослабляет уже ускоренный билд.
- **Топоры:** у каменного/железного/алмазного/незеритового повышены урон и полезный сектор; отбрасывание уменьшено до уровня, который реже выбрасывает цель из следующего взмаха. Поздние топоры приблизились к дистанционным по естественной зачистке и улучшили выживание в этой выборке. У каменного варианта статистика позднего выживания остаётся слабой — раннее снаряжение не объявляется подходящим для любого срока.
- **Золотой меч:** 32 вместо 28 урона улучшает реальные пороги попаданий при сохранённом быстром лёгком темпе. Данные позднего выживания шумные; универсальное превосходство над железным не заявляется.
- **Мечи, булава и обычный трезубец:** их сильные стороны не обнулялись ради равного бумажного DPS. Они сохраняют многократный урон близкой группе, разовый удар или длинный узкий выпад.

## Два новых предмета

- **Морозные снежки:** их прямой single/crowd DPS около ${n(c(newEarly.get('snow-caster'),'single'))}, ниже большого числа мечей/топоров. Их роль — контроль. В отдельном опыте один бессмертный зомби с 8 м достиг неподвижного героя через ${n(newEarly.get('snow-caster').pursuit.firstContact)} с, против ${n(newEarly.get('hunting-bow').pursuit.firstContact)} с с обычным луком: примерно на 36% позже. Замедление действительно действовало ${n(newEarly.get('snow-caster').pursuit.slowedSeconds)} с, а не было только визуальным. По естественному боту они успешны: контроль и дистанция остаются сильным сочетанием.
- **Метательный трезубец:** ${n(c(newEarly.get('tide-trident'),'single'))} single DPS, ${n(c(newEarly.get('tide-trident'),'closing-lane'))} по двум целям в линии, вторичная цель получает 70% урона. Его поздний средний результат ${n(newLate.get('tide-trident').summary.averageKills)} убийств, ${newLate.get('tide-trident').summary.survived}/3 выживания. Он не лучше тяжёлых топоров по плотной группе и не заменяет снежки по замедлению.

Честного «до» для этих двух новых предметов нет: они попали в промежуточный late-baseline во время подключения специальных эффектов. Эти строки промежуточного отчёта не следует использовать как сравнение законченных версий.

## Остаточные ограничения и вывод

У одного предмета нет победы во всех измеренных задачах: поздние топоры сильнее по плотной ближней группе, арбалет/метательный трезубец — по линии и безопасному времени атаки, снежки — по замедлению, жезл — по поджогу группы. При этом **дистанционное оружие остаётся безопаснее в используемой политике кайтинга**. Три seed не доказывают отсутствие любой доминирующей стратегии; их задача — выявить конкретные старые провалы и проверить, что правки выполняются в настоящей симуляции. Последующая настройка требует человеческих забегов и оценки первой схватки с големом/времени до покупки.

## Воспроизведение

Из папки проекта в PowerShell:

~~~powershell
$env:WEAPON_BENCH_LABEL='after'
$env:WEAPON_BENCH_SECONDS='180'
node game/tools/weapon-comparison.mjs
$env:WEAPON_BENCH_LABEL='after-late'
$env:WEAPON_BENCH_SECONDS='360'
node game/tools/weapon-comparison.mjs
node game/tools/weapon-comparison-summary.mjs
~~~

При необходимости WEAPON_BENCH_IDS ограничивает список ID, а WEAPON_BENCH_SEEDS задаёт seed через запятую. Для окончательных отчётов использован полный список и ${after.seeds.join(', ')}.

| Входной файл | SHA256 |
|---|---|
${Object.entries(hashes).map(([file,hash])=>`| ${file} | ${hash} |`).join('\n')}

JSON с каждым забегом: weapon-comparison-after.json / weapon-comparison-after-late.json. Полное совпадение обоих с текущим core: ${coreHash}.
`;
await writeFile(artifact('weapon-comparison-final.md'),md);
await writeFile(artifact('weapon-comparison-final-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),hashMatch:true,fingerprints:hashes,reports:['weapon-comparison-after.json','weapon-comparison-after-late.json'],weapons:17,seeds:after.seeds,naturalRuns:102,seconds:[180,360]},null,2));
console.log(JSON.stringify({hashMatch:true,weapons:17,naturalRuns:102,coreSHA256:coreHash,finalReport:'game/artifacts/weapon-comparison-final.md'}));
