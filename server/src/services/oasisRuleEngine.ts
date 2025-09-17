export type Code = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'unknown';
export type Item = { value: Code; evidence?: string };
export type OasisCodes = {
  M1800: Item; M1810: Item; M1820: Item; M1830: Item; M1840: Item; M1850: Item; M1860: Item;
  confidence?: number;
};

function findFirst(t: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) { const m = t.match(re); if (m) return m[0]; }
  return undefined;
}

function m1800(t: string): Item {
  const dep = findFirst(t, [
    /(depends entirely|totally dependent)[^.]*\b(groom|shaving|hair|make ?up|nail|teeth|denture)\b/i,
    /\b(groom|shaving|hair|make ?up|nail|teeth|denture)\b[^.]*\b(depends entirely|totally dependent)\b/i
  ]); if (dep) return { value:'3', evidence:dep };

  const assist = findFirst(t, [
    /(assist|help)[^.]*\b(groom|shaving|hair|make ?up|nail|teeth|denture)\b/i
  ]); if (assist) return { value:'2', evidence:assist };

  const setup = findFirst(t, [
    /\b(groom|grooming)[^.]*\b(after setup|within reach)\b/i,
    /\b(after setup|within reach)\b[^.]*\b(groom|grooming)\b/i
  ]); if (setup) return { value:'1', evidence:setup };

  const unaided = findFirst(t, [
    /\b(groom|grooming)[^.]*\b(no physical help|independent(ly)?|without assistance)\b/i
  ]); if (unaided) return { value:'0', evidence:unaided };

  return { value:'unknown' };
}

function dressUpper(t: string): Item {
  const dep = findFirst(t, [
    /upper[^.]*\b(totally dependent|depends entirely)\b/i
  ]); if (dep) return { value:'3', evidence:dep };

  const needs = findFirst(t, [
    /upper[^.]*\b(needs|need)\b[^.]*\b(help|assistance)\b[^.]*\b(put on|don)\b/i
  ]); if (needs) return { value:'2', evidence:needs };

  const laid = findFirst(t, [
    /upper[^.]*\b(laid out|handed)\b/i
  ]); if (laid) return { value:'1', evidence:laid };

  const unaided = findFirst(t, [
    /(can get clothes and dress without assistance)/i,
    /upper[^.]*\b(without assistance|independent(ly)?)\b[^.]*\b(get|retrieve).*(closet|drawer|clothes)/i
  ]); if (unaided) return { value:'0', evidence:unaided };

  return { value:'unknown' };
}

function dressLower(t: string): Item {
  const dep = findFirst(t, [
    /lower[^.]*\b(totally dependent|depends entirely)\b/i
  ]); if (dep) return { value:'3', evidence:dep };

  const needs = findFirst(t, [
    /lower[^.]*\b(needs|need)\b[^.]*\b(help|assistance)\b[^.]*\b(put on|don)\b/i,
    /(partial assistance|needs help)[^.]*\b(socks?|shoes?)\b/i
  ]); if (needs) return { value:'2', evidence:needs };

  const laid = findFirst(t, [
    /lower[^.]*\b(laid out|handed)\b/i
  ]); if (laid) return { value:'1', evidence:laid };

  const unaided = findFirst(t, [
    /lower[^.]*\b(without assistance|independent(ly)?)\b/i
  ]); if (unaided) return { value:'0', evidence:unaided };

  return { value:'unknown' };
}

function bathing(t: string): Item {
  const byAnother = findFirst(t, [/bathed entirely by another person/i]);
  if (byAnother) return { value:'6', evidence:byAnother };

  const assistSink = findFirst(t, [
    /(bathe|bathes)[^.]*\b(sink)\b[^.]*\b(chair|seated)\b/i
  ]) && findFirst(t, [/needs (help|assistance)[^.]*\b(back|lower (leg|legs))\b/i]);
  if (assistSink) return { value:'5', evidence:assistSink };

  const indepSink = findFirst(t, [
    /(bathe|bathes)[^.]*\b(sink)\b[^.]*\b(chair|seated)\b/i
  ]); if (indepSink) return { value:'4', evidence:indepSink };

  const presence = findFirst(t, [/presence throughout/i]);
  if (presence) return { value:'3', evidence:presence };

  const intermittent = findFirst(t, [
    /intermittent (assistance|assist|supervision)/i,
    /contact guard[^.]*\b(step in|step out|in and out)\b/i,
    /(supervision|reminders)[^.]*\b(hard[- ]?to[- ]?reach|back|lower (leg|legs))\b/i
  ]); if (intermittent) return { value:'2', evidence:intermittent };

  const indepWithDevices = findFirst(t, [
    /(bathes|bath) independently in (the )?shower[^.]*\b(grab bars?|non[- ]?slip mat|shower chair)\b/i
  ]); if (indepWithDevices) return { value:'1', evidence:indepWithDevices };

  const indepShower = findFirst(t, [
    /(bathes|bath) independently in (the )?shower/i
  ]); if (indepShower) return { value:'0', evidence:indepShower };

  return { value:'unknown' };
}

function toiletXfer(t: string): Item {
  const dep = findFirst(t, [
    /totally dependent[^.]*toilet transfers?/i,
    /toilet transfers?[^.]*totally dependent/i
  ]); if (dep) return { value:'4', evidence:dep };

  const bedpan = findFirst(t, [
    /\b(bedpan|urinal)\b[^.]*\b(independent(ly)?)\b/i
  ]); if (bedpan) return { value:'3', evidence:bedpan };

  const commode = findFirst(t, [/bedside commode/i]);
  if (commode) return { value:'2', evidence:commode };

  const supervised = findFirst(t, [
    /(reminded|assisted|supervised)[^.]*toilet transfers?/i,
    /toilet transfers?[^.]*\b(reminded|assisted|supervised)\b/i
  ]); if (supervised) return { value:'1', evidence:supervised };

  const indep = findFirst(t, [
    /toilet transfers? (are )?independent/i,
    /independent[^.]*toilet transfers?/i,
    /independent with grab bars/i
  ]); if (indep) return { value:'0', evidence:indep };

  return { value:'unknown' };
}

function transferring(t: string): Item {
  const bedfastCannotTurn = findFirst(t, [
    /bedfast[^.]*unable to transfer[^.]*unable to turn/i,
    /unable to turn[^.]*bedfast/i
  ]); if (bedfastCannotTurn) return { value:'5', evidence:bedfastCannotTurn };

  const bedfastCanTurn = findFirst(t, [
    /bedfast[^.]*able to turn|bedfast[^.]*can turn/i
  ]); if (bedfastCanTurn) return { value:'4', evidence:bedfastCanTurn };

  const cannotTransferNoBear = findFirst(t, [
    /unable to transfer[^.]*unable to (bear weight|pivot)/i
  ]); if (cannotTransferNoBear) return { value:'3', evidence:cannotTransferNoBear };

  const bearWeightPivotCannot = findFirst(t, [
    /bear weight[^.]*pivot[^.]*cannot (complete )?transfer/i
  ]); if (bearWeightPivotCannot) return { value:'2', evidence:bearWeightPivotCannot };

  const minimal = findFirst(t, [
    /minimal assistance[^.]*\b(transfer|bed to chair|chair to bed)\b/i
  ]); if (minimal) return { value:'1', evidence:minimal };

  const indep = findFirst(t, [
    /\b(independent(ly)?)\b[^.]*\b(transfer|bed to chair|chair to bed)\b/i
  ]); if (indep) return { value:'0', evidence:indep };

  return { value:'unknown' };
}

function ambulation(t: string): Item {
  const bedfast = findFirst(t, [/bedfast/i]);
  if (bedfast) return { value:'6', evidence:bedfast };

  const wcDep = findFirst(t, [
    /chair[-\s]?fast[^.]*unable to wheel self/i
  ]); if (wcDep) return { value:'5', evidence:wcDep };

  const wcInd = findFirst(t, [
    /chair[-\s]?fast[^.]*wheel(s)? self independently/i,
    /able to wheel self independently/i
  ]); if (wcInd) return { value:'4', evidence:wcInd };

  const needsAllTimes = findFirst(t, [
    /walks? only with (supervision|assist) at all times/i
  ]); if (needsAllTimes) return { value:'3', evidence:needsAllTimes };

  const twoHandsOrStairs = findFirst(t, [
    /\b(rolling )?walker\b/i,
    /\bcrutches\b/i,
    /(cues|supervision).*(stairs|uneven)/i
  ]); if (twoHandsOrStairs) return { value:'2', evidence:twoHandsOrStairs };

  const oneHand = findFirst(t, [
    /\b(cane|one-handed device)\b/i
  ]); if (oneHand) return { value:'1', evidence:oneHand };

  const indepNoDevice = findFirst(t, [
    /\bindependent(ly)?\b[^.]*\b(walk|ambulat)/i
  ]); if (indepNoDevice) return { value:'0', evidence:indepNoDevice };

  return { value:'unknown' };
}

export function inferOasisFromTranscript(transcript: string): OasisCodes {
  const t = (transcript || '').toLowerCase();
  const res: OasisCodes = {
    M1800: m1800(t),
    M1810: dressUpper(t),
    M1820: dressLower(t),
    M1830: bathing(t),
    M1840: toiletXfer(t),
    M1850: transferring(t),
    M1860: ambulation(t),
    confidence: 0
  };
  const filled = ['M1800','M1810','M1820','M1830','M1840','M1850','M1860']
    .map(k => (res as any)[k].value !== 'unknown')
    .filter(Boolean).length;
  res.confidence = Math.round((filled/7)*100)/100;
  return res;
}
