export function buildCodesPrompt(transcript: string) {
  return `
You are coding OASIS-E1 Section G (M1800–M1860) from a home health assessment transcript.

Return ONLY JSON with EXACT keys. If no explicit evidence, set "value":"unknown".
Schema:
{
  "M1800":{"value":"0|1|2|3|unknown","evidence":"..."},
  "M1810":{"value":"0|1|2|3|unknown","evidence":"..."},
  "M1820":{"value":"0|1|2|3|unknown","evidence":"..."},
  "M1830":{"value":"0|1|2|3|4|5|6|unknown","evidence":"..."},
  "M1840":{"value":"0|1|2|3|4|unknown","evidence":"..."},
  "M1850":{"value":"0|1|2|3|4|5|unknown","evidence":"..."},
  "M1860":{"value":"0|1|2|3|4|5|6|unknown","evidence":"..."},
  "confidence": 0.0-1.0
}

Coding reminders (condensed CMS intent):
- M1800 Grooming: 0 unaided; 1 after setup/within reach; 2 assist; 3 dependent.
- M1810 Upper dressing: 0 unaided (includes "requires supervision only" if no physical help); 1 unaided if laid out/handed; 2 needs help to put on; 3 dependent.
- M1820 Lower dressing: 0 unaided; 1 unaided if laid out/handed; 2 needs help to put on socks/shoes etc.; 3 dependent.
- M1830 Bathing: 0 independent in shower; 1 independent in shower with devices; 2 intermittent assist/contact guard/supervision for parts or in/out; 3 presence throughout; 4 independent at sink/chair; 5 assist at sink/chair; 6 bathed by another.
- M1840 Toilet transferring: 0 independent (devices allowed, e.g., grab bars); 1 reminded/assisted/**requires supervision**; 2 bedside commode; 3 bedpan/urinal independently; 4 totally dependent.
- M1850 Transfers bed↔chair: 0 independent; 1 minimal assist or device; 2 bears weight & pivots but cannot transfer self; 3 cannot transfer & cannot bear weight; 4 bedfast can turn; 5 bedfast cannot turn.
- M1860 Ambulation: 0 independent no device; 1 one-handed device (cane/hemi-walker); 2 two-handed device (walker/crutches) OR human supervision/cues for stairs/uneven; 3 supervision at all times; 4 wheelchair independent; 5 wheelchair dependent; 6 bedfast.

Constraints:
- Evidence is a short verbatim quote if available; if not present in the transcript, keep "unknown".
- Output JSON ONLY. No prose.

Transcript:
"""${transcript}"""
`;
}
