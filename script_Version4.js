// 智能八字解释器（简化自动判定版）
// 依赖：moment-timezone + sxtwl-js（已在 index.html 引入）

const TIANGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DIZHI   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 天干 -> 五行
const GAN_ELEMENT = {
  '甲':'木','乙':'木',
  '丙':'火','丁':'火',
  '戊':'土','己':'土',
  '庚':'金','辛':'金',
  '壬':'水','癸':'水'
};
// 地支藏干（按常用顺序）
const ZHI_CANGGAN = {
  '子':['癸'],
  '丑':['己','癸','辛'],
  '寅':['甲','丙','戊'],
  '卯':['乙'],
  '辰':['戊','乙','癸'],
  '巳':['丙','庚','戊'],
  '午':['丁','己'],
  '未':['己','丁','乙'],
  '申':['庚','壬','戊'],
  '酉':['辛'],
  '戌':['戊','辛','丁'],
  '亥':['壬','甲']
};

const GENERATE = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
const OVERCOME = {'木':'土','火':'金','土':'水','金':'木','水':'火'};

// 常用神煞（占位示例）
const SHENSHA_RULES = [
  { name:'天乙贵人', desc:'化解小人、遇事得助（示例）' },
  { name:'驿马', desc:'主迁移、变动、旅行（示例）' },
  { name:'将星', desc:'职权、将帅之气（示例）' }
];

function $(s){ return document.querySelector(s) }

function populateTimezones(){
  const sel = $('#tz');
  const zones = [
    'Asia/Taipei','Asia/Shanghai','Asia/Hong_Kong','Asia/Tokyo','Asia/Seoul',
    'Asia/Singapore','Asia/Kuala_Lumpur','Asia/Bangkok',
    'Europe/London','Europe/Paris','America/New_York','America/Los_Angeles'
  ];
  zones.forEach(z=>{ const opt=document.createElement('option'); opt.value=z; opt.textContent=z; sel.appendChild(opt); });
  const local = moment.tz.guess();
  if (![...sel.options].some(o=>o.value===local)){
    const o=document.createElement('option'); o.value=local; o.textContent=local+'（本地）'; sel.insertBefore(o, sel.firstChild);
  }
  sel.value = local;
}

function countWuxing(stems, branches){
  const counts = {'木':0,'火':0,'土':0,'金':0,'水':0};
  stems.forEach(s=>{
    if(!s) return;
    const e = GAN_ELEMENT[s];
    if(e) counts[e] += 1;
  });
  branches.forEach(z=>{
    if(!z) return;
    const arr = ZHI_CANGGAN[z] || [];
    arr.forEach(g=>{
      const e = GAN_ELEMENT[g];
      if(e) counts[e] += 1;
    });
  });
  return counts;
}

function analyzeYongshen(counts, dayStem){
  const dayEl = GAN_ELEMENT[dayStem];
  if(!dayEl) return { dayEl:'', strengthDesc:'无法判定', yongshen:[], details:{} };

  const same = counts[dayEl] || 0;
  const producer = Object.keys(GENERATE).find(k=>GENERATE[k]===dayEl); // 生我
  const producerCnt = producer ? (counts[producer]||0) : 0;
  const child = GENERATE[dayEl]; // 我生
  const childCnt = child ? (counts[child]||0) : 0;
  const control = Object.keys(OVERCOME).find(k=>OVERCOME[k]===dayEl);
  const controlCnt = control ? (counts[control]||0) : 0;

  const score = same + 0.8*producerCnt - 0.8*(controlCnt + childCnt);

  let strengthDesc = '';
  if(score >= 3.5) strengthDesc = '日主偏强（建议喜用克制或耗泄之神）';
  else if(score >= 1.5) strengthDesc = '日主平衡（喜用以调和为主）';
  else strengthDesc = '日主偏弱（建议喜用生扶、印比之神）';

  let yongshen = [];
  if(score >= 3.5){
    if(control) yongshen.push({ element: control, reason:'克我（可制约日主，平衡八字）' });
    if(child) yongshen.push({ element: child, reason:'我所生（耗我，泄我之用）' });
  } else if(score < 1.5){
    if(producer) yongshen.push({ element: producer, reason:'生我（补助日主）' });
    yongshen.push({ element: dayEl, reason:'比肩/劫（同类助力）' });
  } else {
    if(producer) yongshen.push({ element: producer, reason:'生我（增强）' });
    if(control) yongshen.push({ element: control, reason:'克我（制衡）' });
  }

  const details = {
    dayElement: dayEl,
    counts,
    same, producer, producerCnt, child, childCnt, control, controlCnt, score
  };

  return { dayEl, strengthDesc, yongshen, details };
}

function suggestionsFromWuxing(counts){
  const entries = Object.entries(counts);
  entries.sort((a,b)=>b[1]-a[1]);
  const max = entries[0], min = entries[entries.length-1];
  const sug = [];
  if(max[1] === 0) {
    sug.push('五行缺乏明显旺项，需结合大运流年与用神再判断。');
  } else {
    const meld = {
      '木':'适合与创造、教育、设计、绿化、农业等有关的领域；性格偏有生气、外向、好动。',
      '火':'适合与能量、餐饮、表演、IT（热情、领导）等行业；性格外放、热情、有冲劲。',
      '土':'适合地产、建筑、农业、管理、保险等；性格踏实、稳重、耐心。',
      '金':'适合金融、法律、制造、金属相关行业；性格果断、刚毅、讲原则。',
      '水':'适合媒体、咨询、物流、贸易、研究等；性格灵活、适应强、头脑敏捷。'
    };
    sug.push(`五行最旺：${max[0]}（${max[1]}） — 推荐：${meld[max[0]]}`);
    sug.push(`五行最弱：${min[0]}（${min[1]}） — 可作为调候与宜避方向参考。`);
  }
  return sug;
}

function calculateAndExplain(dateObj, timezone){
  if(typeof sxtwl === 'undefined'){
    throw new Error('未检测到 sxtwl 库，请确认已在 index.html 中正确引入 sxtwl-js。');
  }
  const m = moment.tz(dateObj, timezone);
  const year = m.year(), month = m.month()+1, day = m.date(), hour = m.hour(), minute = m.minute();

  let solar, lunar;
  try{
    if(sxtwl.Solar && typeof sxtwl.Solar.fromYmdHms === 'function'){
      solar = sxtwl.Solar.fromYmdHms(year, month, day, hour, minute, 0);
      lunar = solar.getLunar();
    } else if(sxtwl.Solar && typeof sxtwl.Solar.fromYmd === 'function'){
      solar = sxtwl.Solar.fromYmd(year, month, day);
      lunar = solar.getLunar ? solar.getLunar() : sxtwl.Lunar.fromSolar(solar);
    } else {
      solar = new sxtwl.Solar(year, month, day);
      lunar = solar.getLunar ? solar.getLunar() : new sxtwl.Lunar(solar);
    }
  }catch(e){
    try{ solar = new sxtwl.solar(year, month, day, hour); lunar = new sxtwl.lunar(solar); }catch(err){
      throw new Error('sxtwl 构造 solar/lunar 失败：' + err.message);
    }
  }

  const out = { ganzhi: { year:'', month:'', day:'', hour:'' }, stems:[], branches:[], lunarObj:lunar, solarObj:solar };

  try{
    if(lunar.gzYear) out.ganzhi.year = (lunar.gzYear[0]||'') + (lunar.gzYear[1]||'');
    else if(lunar.getYearInGanZhi) out.ganzhi.year = lunar.getYearInGanZhi();
    if(lunar.gzMonth) out.ganzhi.month = (lunar.gzMonth[0]||'') + (lunar.gzMonth[1]||'');
    else if(lunar.getMonthInGanZhi) out.ganzhi.month = lunar.getMonthInGanZhi();
    if(lunar.gzDay) out.ganzhi.day = (lunar.gzDay[0]||'') + (lunar.gzDay[1]||'');
    else if(lunar.getDayInGanZhi) out.ganzhi.day = lunar.getDayInGanZhi();
    if(lunar.gzShi) out.ganzhi.hour = (lunar.gzShi[0]||'') + (lunar.gzShi[1]||'');
    else if(lunar.getHourInGanZhi) out.ganzhi.hour = lunar.getHourInGanZhi(hour);
    else {
      const zhiIndex = Math.floor(((hour + 1) % 24) / 2);
      const zhi = DIZHI[zhiIndex];
      const dayG = out.ganzhi.day ? out.ganzhi.day[0] : null;
      let hourGan = '?';
      if(dayG){
        const dayIdx = TIANGAN.indexOf(dayG);
        hourGan = TIANGAN[(dayIdx*2 + zhiIndex) % 10];
      }
      out.ganzhi.hour = (hourGan || '?') + (zhi || '?');
    }
  }catch(e){
    try{
      if(typeof sxtwl.getGz === 'function'){
        const gz = sxtwl.getGz(year, month, day, hour);
        out.ganzhi.year = gz.yearGz; out.ganzhi.month = gz.monthGz; out.ganzhi.day = gz.dayGz; out.ganzhi.hour = gz.hourGz;
      }
    }catch(err){}
  }

  const keys = ['year','month','day','hour'];
  keys.forEach(k=>{
    const s = out.ganzhi[k] || '';
    if(s.length >= 2){
      const tg = s[0], dz = s[1];
      out.stems.push(tg); out.branches.push(dz);
    } else {
      out.stems.push(''); out.branches.push('');
    }
  });

  const counts = countWuxing(out.stems, out.branches);
  const dayStem = out.stems[2] || '';
  const analysis = analyzeYongshen(counts, dayStem);
  const suggestion = suggestionsFromWuxing(counts);
  const shensha = SHENSHA_RULES.map(s=>({ name:s.name, desc:s.desc }));

  return {
    momentLocal: m.format(),
    timezone,
    solar: { year, month, day, hour, minute },
    ganzhi: out.ganzhi,
    stems: out.stems,
    branches: out.branches,
    counts,
    analysis,
    suggestion,
    shensha,
    raw: { lunar, solar }
  };
}

function renderResult(res){
  $('#resultCard').style.display = 'block';
  $('#basicInfo').innerHTML = `
    <strong>当地时间（用于换算）：</strong> ${res.momentLocal}（${res.timezone}）<br/>
    <strong>公历：</strong> ${res.solar.year}年${res.solar.month}月${res.solar.day}日 ${res.solar.hour}时${res.solar.minute}分
  `;

  const tbody = $('#baziTable tbody');
  tbody.innerHTML = '';
  const cols = ['年','月','日','时'];
  for(let i=0;i<4;i++){
    const tr = document.createElement('tr');
    const td0 = document.createElement('td'); td0.textContent = cols[i];
    const td1 = document.createElement('td'); td1.textContent = res.stems[i] || '-';
    const td2 = document.createElement('td'); td2.textContent = res.branches[i] || '-';
    const z = res.branches[i] || '';
    const cg = ZHI_CANGGAN[z] ? ZHI_CANGGAN[z].join(',') : '-';
    const td3 = document.createElement('td'); td3.textContent = cg;
    tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    tbody.appendChild(tr);
  }

  const cnt = res.counts;
  $('#wuxingSummary').innerHTML = `
    五行分布：木 ${cnt['木']}，火 ${cnt['火']}，土 ${cnt['土']}，金 ${cnt['金']}，水 ${cnt['水']}。<br/>
    日主（日干）：${res.analysis.dayEl || '未知'} 。${res.analysis.strengthDesc || ''}
  `;

  const ysdiv = $('#yongshen');
  ysdiv.innerHTML = '';
  res.analysis.yongshen.forEach(y=>{
    const d = document.createElement('div'); d.className='item';
    d.innerHTML = `<strong>${y.element}</strong> — ${y.reason}`;
    ysdiv.appendChild(d);
  });
  if(res.analysis.yongshen.length === 0) ysdiv.textContent = '未能自动判定喜用神（请检查输入或进一步指定判法）';

  $('#suggestions').innerHTML = res.suggestion.map(s=>`<div class="item">${s}</div>`).join('');

  const ss = $('#shenshaList');
  ss.innerHTML = '';
  res.shensha.forEach(s=>{
    const el = document.createElement('div'); el.className='item';
    el.innerHTML = `<strong>${s.name}</strong> — ${s.desc}`;
    ss.appendChild(el);
  });

  $('#debug').textContent = JSON.stringify(res, null, 2);
}

document.addEventListener('DOMContentLoaded', ()=>{
  populateTimezones();
  const now = moment();
  $('#date').value = now.format('YYYY-MM-DD');
  $('#time').value = now.format('HH:00');

  $('#calcBtn').addEventListener('click', ()=>{
    const dateVal = $('#date').value;
    const timeVal = $('#time').value || '00:00';
    const tz = $('#tz').value || moment.tz.guess();
    if(!dateVal){ alert('请填写出生日期'); return; }
    try{
      const dtStr = `${dateVal}T${timeVal}:00`;
      const m = moment.tz(dtStr, tz);
      const dt = m.toDate();
      const res = calculateAndExplain(dt, tz);
      renderResult(res);
    }catch(e){
      alert('计算错误：' + e.message);
      console.error(e);
    }
  });

  $('#copyBtn').addEventListener('click', ()=>{
    const dbg = $('#debug').textContent;
    if(!dbg){ alert('请先计算八字'); return; }
    navigator.clipboard.writeText(dbg).then(()=>alert('已复制解释结果 JSON 到剪贴板')).catch(err=>alert('复制失败：'+err));
  });

  $('#exportBtn').addEventListener('click', ()=>{
    const txt = $('#debug').textContent;
    if(!txt){ alert('请先计算八字'); return; }
    const blob = new Blob([txt], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bazi_explain.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
});