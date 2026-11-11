// Sequential expedition state. Independent of rendering so saves and event ordering can be verified.
export const expeditionSteps = [
  {title:'启程 · 导航校准',tag:'ODYSSEY / 01',description:'进入空间站，走到前方指挥台，校准探索者号的导航系统。',checks:[['calibrated','在指挥台完成导航校准']]},
  {title:'蓝色家园 · 地球',tag:'EARTH / 02',description:'跃迁至地球附近，扫描云层、海洋与大陆，留下远征的第一份记录。',checks:[['earth','完成地球扫描']]},
  {title:'红色前哨 · 火星',tag:'MARS / 03',description:'扫描火星，然后在行星档案中查看并记录这颗红色星球。',checks:[['mars','完成火星扫描'],['marsArchive','记录火星特写档案']]},
  {title:'巨行星航线 · 木星',tag:'JUPITER / 04',description:'在木星附近按 W 推进、A/D 转向，累计飞行 4 秒，再扫描巨行星云带。',checks:[['jupiterFlight','驾驶探索者号推进 4 秒'],['jupiter','完成木星扫描']]},
  {title:'光环回声 · 土星',tag:'SATURN / 05',description:'扫描土星，在档案展厅放大观察冰粒光环，并记录调查结果。',checks:[['saturn','完成土星扫描'],['saturnArchive','记录土星特写档案']]},
  {title:'归航 · 群星的回信',tag:'HOMEBOUND / 06',description:'跃迁返回奥德赛空间站，进入指挥区，把远征数据交付给指挥台。',checks:[['returned','跃迁返回奥德赛空间站'],['delivered','在指挥台交付远征数据']]}
];

export function createMission(saved={}) {
  const step=Number.isInteger(saved.step)?Math.max(0,Math.min(6,saved.step)):0;
  const flags={};
  for(const item of expeditionSteps[step]?.checks||[])flags[item[0]]=saved.flags?.[item[0]]===true;
  const state={step,flags,flightSeconds:step===3?Math.max(0,Math.min(4,Number(saved.flightSeconds)||0)):0,completedAt:typeof saved.completedAt==='string'?saved.completedAt:null};
  function event(type,id,dt=0){
    const before=state.step;
    if(before===6)return false;
    if(before===0&&type==='console')state.flags.calibrated=true;
    if(type==='scan'&&((before===1&&id==='earth')||(before===2&&id==='mars')||(before===3&&id==='jupiter')||(before===4&&id==='saturn')))state.flags[id]=true;
    if(type==='archive'&&((before===2&&id==='mars')||(before===4&&id==='saturn')))state.flags[id+'Archive']=true;
    if(before===3&&type==='flight'&&id==='jupiter'){
      state.flightSeconds=Math.min(4,state.flightSeconds+Math.max(0,Math.min(.1,dt)));
      if(state.flightSeconds>=4)state.flags.jupiterFlight=true;
    }
    if(before===5&&type==='arrive'&&id==='station')state.flags.returned=true;
    if(before===5&&type==='console'&&state.flags.returned)state.flags.delivered=true;
    if(expeditionSteps[before].checks.every(([key])=>state.flags[key])){
      state.step++;state.flags={};state.flightSeconds=0;
      if(state.step===6)state.completedAt=new Date().toISOString();
      return true;
    }
    return false;
  }
  return {state,event};
}
