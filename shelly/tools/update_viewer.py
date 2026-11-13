from pathlib import Path
root=Path(__file__).resolve().parents[2]
for f in ['index.html','studio.js']:
 p=root/f
 backup=root/('spike-'+f)
 if not backup.exists():backup.write_bytes(p.read_bytes())
 s=p.read_text(encoding='utf-8')
 if f=='index.html':
  s=s.replace('Спайка','Шелли').replace('Спайк','Шелли').replace('СПАЙК','ШЕЛЛИ').replace('SPIKE','SHELLY').replace('ЛЕГЕНДАРНЫЙ БОЕЦ','СТАРТОВЫЙ БОЕЦ').replace('Маленький кактус.<br>Большие неприятности.','Характер. Дробовик.<br>Никаких компромиссов.').replace('Ожидание / атака','Ожидание / пауза').replace('<button data-animation="Attack">Атака</button>','').replace('>Поза</button>','>Пауза</button>').replace('Персонаж Brawl Stars · неофициальная модель','Основа: игровые ассеты Supercell · адаптация и 3D-лицо').replace('#80cd28','#9a3ad2').replace('#e7353e','#ffd135').replace('ИССЛЕДОВАНИЕ ПЕРСОНАЖА · 02','ИССЛЕДОВАНИЕ ПЕРСОНАЖА · 03')
 else:
  s=s.replace('./model/spike.glb','./shelly/model/shelly.glb').replace('./model/spike.blend','./shelly/model/shelly.blend').replace('./model/model-info.json','./shelly/model/model-info.json').replace('Спайка','Шелли').replace("model.name='Spike'","model.name='Shelly'")
  s=s.replace('mat.userData.originalColor=mat.color.clone();','mat.userData.originalColor=mat.color.clone();mat.userData.originalMap=mat.map;')
  s=s.replace("mat.metalness=enabled?0:mat.userData.originalMetalness;","mat.metalness=enabled?0:mat.userData.originalMetalness;mat.map=enabled?null:mat.userData.originalMap;mat.needsUpdate=true;")
 p.write_text(s,encoding='utf-8')
