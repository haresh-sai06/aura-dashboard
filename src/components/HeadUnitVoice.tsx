/**
 * Head-unit voice — intentionally SILENT.
 *
 * The scripted escalation/takeover lines (browser TTS, e.g. "I'm noticing early signs of
 * fatigue…") were firing repeatedly and talking over the natural conversational voice. Per the
 * demo requirement we now let ONLY the natural voice (the Gemini Live buddy) speak, so this
 * mounts as a no-op. Kept so Layout's <HeadUnitVoice /> reference stays valid — to re-enable the
 * scripted co-pilot voice, restore the countermeasure/alert speak() effects from git history.
 */
export default function HeadUnitVoice() {
  return null;
}
