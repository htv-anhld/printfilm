import { tr } from '../../../i18n'
import { useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
export function useVoiceInput(onText: (value: string) => void, onError: (value: string) => void) {
  const [recording, setRecording] = useState(false)
  const ref = useRef<Recognition | null>(null)
  const callbacks = useRef({ onText, onError }); callbacks.current = { onText, onError }
  const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition
  useEffect(() => () => { if (ref.current) { ref.current.onend = null; ref.current.onerror = null; ref.current.onresult = null; ref.current.abort() } }, [])
  const toggle = () => {
    if (ref.current) { ref.current.stop(); return }
    if (!Constructor) return
    const recognition = new Constructor(); ref.current = recognition
    recognition.lang = tr('studioCanvas.useVoiceInput.lang'); recognition.interimResults = false; recognition.continuous = true
    recognition.onresult = (event) => { for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) callbacks.current.onText(event.results[i][0].transcript) }
    recognition.onerror = (event) => callbacks.current.onError(event.error === 'not-allowed' ? tr('studioCanvas.useVoiceInput.denied') : tr('studioCanvas.useVoiceInput.unavailable'))
    recognition.onend = () => { ref.current = null; setRecording(false) }
    try { recognition.start(); setRecording(true) } catch { ref.current = null; callbacks.current.onError(tr('studioCanvas.useVoiceInput.startFailed')) }
  }
  return { recording, supported: !!Constructor, toggle }
}
