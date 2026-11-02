import { describe, expect, it } from 'vitest';
import { studioSequences } from '@/domain/social/montage/studio-sequences';
import { animationOutputRange } from '@/domain/social/montage/placement';

describe('sequences shown in the editing timeline', () => {
 it('covers the kept video and retains transcript boundaries after cuts', () => {
  const ranges=[{fromMs:0,toMs:4000},{fromMs:5000,toMs:10000}];
  const scenes=studioSequences([{text:'Bonjour.',startMs:1000,endMs:3000},{text:'Ensemble.',startMs:6000,endMs:8500}],ranges);
  expect(scenes.map(s=>[s.startMs,s.endMs])).toEqual([[0,6000],[6000,10000]]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
  expect(scenes.map(s=>animationOutputRange({fromMs:s.startMs,toMs:s.endMs} as any,ranges))).toEqual([{fromMs:0,toMs:5000},{fromMs:5000,toMs:9000}]);
  expect(scenes.map(s=>s.text)).toEqual(['Bonjour.','Ensemble.']);
 });
 it('keeps manual sequence placement possible without inventing a transcript', () => {
  const scenes=studioSequences([],[{fromMs:3000,toMs:8000},{fromMs:12000,toMs:20000}]);
  expect(scenes.map(s=>[s.startMs,s.endMs,s.text])).toEqual([[3000,8000,''],[12000,20000,'']]);
 });
 it('never creates a sequence from words removed by a cut',()=>{
  const scenes=studioSequences([{text:'Coupé.',startMs:0,endMs:2000},{text:'Conservé.',startMs:6000,endMs:8500}],[{fromMs:5000,toMs:10000}]);
  expect(scenes).toHaveLength(1);expect(scenes[0].text).toBe('Conservé.');
 });
});
