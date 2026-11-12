import test from 'node:test';
import assert from 'node:assert/strict';
import {createMission} from '../dist/mission.js';

test('six-step expedition requires real ordered objectives and return registration',()=>{
  const m=createMission();
  for(const id of ['earth','mars','jupiter','saturn'])m.event('scan',id);
  assert.equal(m.state.step,0,'out-of-order scans cannot skip calibration');
  m.event('console');assert.equal(m.state.step,1);
  m.event('scan','earth');assert.equal(m.state.step,2);
  m.event('archive','mars');assert.equal(m.state.step,2);
  m.event('scan','mars');assert.equal(m.state.step,2);
  m.event('landmark','mars');assert.equal(m.state.step,3);
  m.event('scan','jupiter');assert.equal(m.state.step,3);
  for(let i=0;i<39;i++)m.event('flight','jupiter',.1);
  assert.equal(m.state.step,3,'less than four seconds does not complete flight');
  m.event('flight','jupiter',.1);assert.equal(m.state.step,4);
  m.event('scan','saturn');m.event('archive','saturn');assert.equal(m.state.step,4);
  m.event('photo','saturn');assert.equal(m.state.step,5);
  m.event('console');assert.equal(m.state.step,5,'delivery requires return journey');
  m.event('arrive','earth');m.event('console');assert.equal(m.state.step,5);
  m.event('arrive','station');m.event('console');assert.equal(m.state.step,5);
  m.event('dock');m.event('console');assert.equal(m.state.step,6);
  assert.ok(m.state.completedAt);assert.equal(m.event('console'),false);
});

test('resume preserves partial objectives and ignores malformed storage',()=>{
  const m=createMission({step:2,flags:{mars:true,delivered:true}});
  assert.deepEqual(m.state.flags,{mars:true,marsArchive:false});
  const resumed=createMission(JSON.parse(JSON.stringify(m.state)));
  resumed.event('landmark','mars');assert.equal(resumed.state.step,3);
  assert.equal(createMission({step:'bad',flags:null}).state.step,0);
  assert.equal(createMission({step:-99}).state.step,0);
});

test('flight progress is bounded per frame and only Jupiter counts',()=>{
  const m=createMission({step:3});m.event('flight','mars',.1);
  assert.equal(m.state.flightSeconds,0);
  m.event('flight','jupiter',500);assert.equal(m.state.flightSeconds,.1);
  m.event('flight','jupiter',-5);assert.equal(m.state.flightSeconds,.1);
  const resumed=createMission(JSON.parse(JSON.stringify(m.state)));
  assert.equal(resumed.state.flightSeconds,.1);
});
