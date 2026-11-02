import type { CaptionWord, Range } from './edit';
import { analyzeScenes, type Scene } from './scenes';
import { keptWords } from './suggest';

/** Source-time boundaries; output-time positions are derived from the same cuts as the video. */
export function studioSequences(words: CaptionWord[], ranges: Range[], keyword?: string | null): Scene[] {
 if (!ranges.length) return [];
 const scenes=analyzeScenes(keptWords(words,ranges),{keyword});
 if (!scenes.length) return ranges.map((range,index)=>({index,startMs:range.fromMs,endMs:range.toMs,text:'',intent:'EXPLAIN',intensity:'medium',pivotWords:[]}));
 return scenes.map((scene,index)=>({...scene,startMs:index===0?ranges[0].fromMs:scene.startMs,endMs:scenes[index+1]?.startMs??ranges[ranges.length-1].toMs}));
}
