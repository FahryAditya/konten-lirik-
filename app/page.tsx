"use client"

import { useState, useRef, useCallback, useEffect } from "react"

type Line = {
  id: number
  text: string
  singer: "A" | "B"
  timestamp: number | null
}

type AnimMode = "textype" | "splittext"

const notes = ["♪", "♫", "♬", "♪", "♫"]

const moods: Record<string, { emoji: string; label: string; from: string; via: string; to: string }> = {
  sad: { emoji: "😢", label: "Sedih", from: "#1E3A8A", via: "#6B7280", to: "#111827" },
  happy: { emoji: "😊", label: "Bahagia", from: "#FACC15", via: "#FB923C", to: "#84CC16" },
  love: { emoji: "❤️", label: "Romantis", from: "#EC4899", via: "#EF4444", to: "#C084FC" },
  angry: { emoji: "🔥", label: "Marah", from: "#DC2626", via: "#7F1D1D", to: "#111827" },
  calm: { emoji: "😌", label: "Tenang", from: "#60A5FA", via: "#6EE7B7", to: "#FFFFFF" },
  peaceful: { emoji: "🌿", label: "Damai", from: "#22C55E", via: "#A3B18A", to: "#F5F5DC" },
  energetic: { emoji: "⚡", label: "Enerjik", from: "#F97316", via: "#FACC15", to: "#EF4444" },
  powerful: { emoji: "🚀", label: "Berani", from: "#991B1B", via: "#F59E0B", to: "#111827" },
  mystery: { emoji: "🌌", label: "Misterius", from: "#6D28D9", via: "#4338CA", to: "#111827" },
  fantasy: { emoji: "✨", label: "Magis", from: "#8B5CF6", via: "#3B82F6", to: "#06B6D4" },
  nostalgic: { emoji: "🌅", label: "Nostalgia", from: "#A16207", via: "#F59E0B", to: "#E5D3B3" },
  melancholy: { emoji: "🌧️", label: "Melankolis", from: "#1E293B", via: "#64748B", to: "#334155" },
  hopeful: { emoji: "🌄", label: "Harapan", from: "#06B6D4", via: "#4ADE80", to: "#FFFFFF" },
  fear: { emoji: "😨", label: "Takut", from: "#374151", via: "#581C87", to: "#111827" },
  awe: { emoji: "😲", label: "Kagum", from: "#EAB308", via: "#38BDF8", to: "#FFFFFF" },
  lonely: { emoji: "🥺", label: "Kesepian", from: "#64748B", via: "#9CA3AF", to: "#1E293B" },
  dreamy: { emoji: "🌙", label: "Mimpi", from: "#C4B5FD", via: "#F9A8D4", to: "#93C5FD" },
  excited: { emoji: "😍", label: "Gembira", from: "#FDE047", via: "#FB923C", to: "#F472B6" },
  meditative: { emoji: "🧘", label: "Meditasi", from: "#A3B18A", via: "#93C5FD", to: "#FFFFFF" },
}

const singerColors: Record<string, string> = { A: "#60a5fa", B: "#f472b6" }

function splitWords(text: string) {
  return text.match(/\S+|\s+/g) || []
}

export default function Home() {
  const [inputText, setInputText] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [audioFile, setAudioFile] = useState<string | null>(null)
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)
  const [isInputMode, setIsInputMode] = useState(true)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [animMode, setAnimMode] = useState<AnimMode>("textype")
  const [splitKey, setSplitKey] = useState(0)
  const [autoScroll, setAutoScroll] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(3000)
  const [duetMode, setDuetMode] = useState(false)
  const [mood, setMood] = useState("sad")
  const [volume, setVolume] = useState(1)
  const [syncMode, setSyncMode] = useState(false)
  const [pitchData, setPitchData] = useState<Uint8Array | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [wordIdx, setWordIdx] = useState(0)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const typingRef = useRef<number | null>(null)
  const autoRef = useRef<number | null>(null)
  const wordTimerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const recTimerRef = useRef<number | null>(null)
  const audioSrcRef = useRef<MediaElementAudioSourceNode | null>(null)

  const currentMood = moods[mood]

  const clearAllTimers = useCallback(() => {
    if (typingRef.current) clearTimeout(typingRef.current)
    if (autoRef.current) clearInterval(autoRef.current)
    if (wordTimerRef.current) clearTimeout(wordTimerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (recTimerRef.current) clearInterval(recTimerRef.current)
  }, [])

  useEffect(() => {
    return () => { clearAllTimers() }
  }, [clearAllTimers])

  const startWordHighlight = useCallback((text: string, cb?: () => void) => {
    const words = splitWords(text)
    setWordIdx(0)
    let i = 0
    const speed = Math.max(100, Math.min(400, 3000 / words.length))

    const tick = () => {
      if (i < words.length) {
        setWordIdx(i + 1)
        i++
        wordTimerRef.current = window.setTimeout(tick, speed)
      } else {
        if (cb) cb()
      }
    }
    tick()
  }, [])

  const typeLine = useCallback((text: string, cb?: () => void) => {
    setIsTyping(true)
    setDisplayedText("")
    let i = 0
    const speed = 50

    const type = () => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1))
        i++
        typingRef.current = window.setTimeout(type, speed)
      } else {
        setIsTyping(false)
        if (cb) cb()
      }
    }
    type()
  }, [])

  const advanceLine = useCallback(() => {
    setVisible(false)
    window.setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev < lines.length - 1 ? prev + 1 : prev
        return next
      })
      setVisible(true)
      setSplitKey((k) => k + 1)
    }, 300)
  }, [lines.length])

  const startAutoScroll = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    autoRef.current = window.setInterval(() => {
      advanceLine()
    }, scrollSpeed)
  }, [advanceLine, scrollSpeed])

  const stopAutoScroll = useCallback(() => {
    if (autoRef.current) {
      clearInterval(autoRef.current)
      autoRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!autoScroll) { stopAutoScroll(); return }
    startAutoScroll()
    return stopAutoScroll
  }, [autoScroll, startAutoScroll, stopAutoScroll])

  useEffect(() => {
    if (!visible || lines.length === 0) return
    const line = lines[currentIndex]
    if (!line) return

    if (animMode === "textype") {
      if (autoScroll) {
        typeLine(line.text, () => {
          setTimeout(advanceLine, scrollSpeed)
        })
      } else {
        typeLine(line.text)
      }
    }

    if (autoScroll) {
      startWordHighlight(line.text, () => {
        setTimeout(advanceLine, 500)
      })
    } else {
      startWordHighlight(line.text)
    }
  }, [currentIndex, visible, lines, animMode, autoScroll]) // eslint-disable-line react-hooks/exhaustive-deps

  const initAudioGraph = useCallback(() => {
    if (!audioRef.current || audioCtx) return
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = volume
    const src = ctx.createMediaElementSource(audioRef.current)
    src.connect(gain)
    gain.connect(ctx.destination)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    gain.connect(analyser)
    analyserRef.current = analyser

    setAudioCtx(ctx)
    setGainNode(gain)

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      setPitchData(data)

      const canvas = canvasRef.current
      const c = canvas.getContext("2d")
      if (!c) return
      canvas.width = canvas.clientWidth * 2
      canvas.height = canvas.clientHeight * 2
      c.scale(2, 2)

      c.clearRect(0, 0, canvas.width, canvas.height)
      const barW = (canvas.clientWidth / data.length) * 2
      data.forEach((val, i) => {
        const h = (val / 255) * (canvas.clientHeight * 0.8)
        const x = i * barW
        const y = canvas.clientHeight * 0.9 - h
        const grad = c.createLinearGradient(x, y, x, y + h)
        grad.addColorStop(0, currentMood.from)
        grad.addColorStop(1, currentMood.via)
        c.fillStyle = grad
        c.fillRect(x, y, barW - 1, h)
      })
      animFrameRef.current = requestAnimationFrame(draw)
    }
    draw()
  }, [audioCtx, volume, currentMood])

  useEffect(() => {
    if (gainNode) gainNode.gain.value = volume
  }, [volume, gainNode])

  const handleStart = () => {
    const parsed = inputText
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((text, i) => ({ text, id: i, singer: "A" as const, timestamp: null }))
    setLines(parsed)
    setCurrentIndex(0)
    setVisible(true)
    setSplitKey((k) => k + 1)
    setIsInputMode(parsed.length === 0)
    if (parsed.length > 0) {
      setIsInputMode(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAudioFile(url)
    }
  }

  const handleAudioPlay = () => {
    initAudioGraph()
  }

  const handleNext = () => {
    if (typingRef.current) clearTimeout(typingRef.current)
    if (wordTimerRef.current) clearTimeout(wordTimerRef.current)
    advanceLine()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        setRecordedBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)

      let sec = 0
      recTimerRef.current = window.setInterval(() => {
        sec++
        setRecordingDuration(sec)
      }, 1000) as unknown as number
    } catch {
      alert("Microphone access denied")
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (recTimerRef.current) clearInterval(recTimerRef.current)
  }

  const moveLine = (from: number, to: number) => {
    setLines((prev) => {
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return arr.map((l, i) => ({ ...l, id: i }))
    })
  }

  const handleDragStart = (idx: number) => setDraggedIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return
    moveLine(draggedIdx, idx)
    setDraggedIdx(idx)
  }
  const handleDragEnd = () => setDraggedIdx(null)

  const handleLineClick = (idx: number) => {
    if (!syncMode || !audioRef.current) return
    const t = audioRef.current.currentTime
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, timestamp: Math.round(t * 10) / 10 } : l))
    )
  }

  const handleJumpToTimestamp = (t: number | null) => {
    if (!audioRef.current || t === null) return
    audioRef.current.currentTime = t
  }

  const toggleSinger = (idx: number) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, singer: l.singer === "A" ? "B" : "A" } : l))
    )
  }

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  const words = lines[currentIndex] ? splitWords(lines[currentIndex].text) : []

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-zinc-950 text-white p-4">
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse at top, ${currentMood.from}22, transparent 70%),
                      radial-gradient(ellipse at bottom left, ${currentMood.via}18, transparent 60%),
                      radial-gradient(ellipse at bottom right, ${currentMood.to}18, transparent 60%)`,
        }}
      />

      {notes.map((note, i) => (
        <div
          key={i}
          className="absolute text-zinc-700/20 text-4xl animate-float"
          style={{
            left: `${15 + i * 18}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 2}s`,
            animationDuration: `${6 + i * 1.5}s`,
          }}
        >
          {note}
        </div>
      ))}

      <div className="relative w-full max-w-lg flex flex-col items-center gap-8">
        {isInputMode ? (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl" style={{ color: currentMood.from }}>♪</span>
              <h1
                className="text-3xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${currentMood.from}, ${currentMood.via}, ${currentMood.to})`,
                }}
              >
                Lyrics Karaoke
              </h1>
              <span className="text-3xl" style={{ color: currentMood.to }}>♫</span>
            </div>

            <p className="text-zinc-500 text-sm text-center">
              Ketik lirik — satu baris per baris
            </p>

            <div className="flex items-center gap-2 bg-zinc-900 rounded-full p-1 border border-zinc-700">
              <button
                onClick={() => setAnimMode("textype")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                  animMode === "textype"
                    ? "text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
                style={animMode === "textype" ? { background: `linear-gradient(to right, ${currentMood.from}, ${currentMood.via})` } : {}}
              >
                TextType
              </button>
              <button
                onClick={() => setAnimMode("splittext")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                  animMode === "splittext"
                    ? "text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
                style={animMode === "splittext" ? { background: `linear-gradient(to right, ${currentMood.from}, ${currentMood.via})` } : {}}
              >
                SplitText
              </button>
            </div>

            <div className="w-full max-h-32 overflow-y-auto flex flex-wrap items-center justify-center gap-1.5 px-1 scrollbar-thin">
              {Object.entries(moods).map(([k, m]) => (
                <button
                  key={k}
                  onClick={() => setMood(k)}
                  className={`px-3 py-1 rounded-full text-xs border transition whitespace-nowrap ${
                    mood === k
                      ? "border-white/60 bg-white/10 text-white"
                      : "border-zinc-700 text-zinc-400 hover:text-white"
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>

            <div className="relative w-full group">
              <div
                className="absolute -inset-1 rounded-2xl opacity-30 group-focus-within:opacity-60 blur-lg transition duration-500"
                style={{
                  background: `linear-gradient(to right, ${currentMood.from}, ${currentMood.via}, ${currentMood.to})`,
                }}
              />
              <textarea
                className="relative w-full h-64 rounded-xl border border-zinc-700 bg-zinc-900/90 p-5 text-lg text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-transparent transition"
                placeholder="Ketik lirik lagu di sini&#10;setiap baris adalah satu baris lirik&#10;..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <button
              onClick={handleStart}
              className="group relative px-10 py-3 rounded-full font-semibold text-lg transition active:scale-95"
            >
              <div
                className="absolute inset-0 rounded-full opacity-80 group-hover:opacity-100 transition"
                style={{
                  background: `linear-gradient(to right, ${currentMood.from}, ${currentMood.via}, ${currentMood.to})`,
                }}
              />
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]" />
              <span className="relative">Mulai</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="cursor-pointer px-5 py-2 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50 transition text-sm">
                + Pilih MP3
                <input
                  type="file"
                  accept="audio/mp3,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setDuetMode(!duetMode)}
                className={`px-4 py-2 rounded-full border text-sm transition ${
                  duetMode
                    ? "border-purple-500 text-purple-300 bg-purple-500/10"
                    : "border-zinc-700 text-zinc-400 hover:text-white"
                }`}
              >
                {duetMode ? "Duet ON" : "Duet OFF"}
              </button>

              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-4 py-2 rounded-full border text-sm transition ${
                  autoScroll
                    ? "border-green-500 text-green-300 bg-green-500/10"
                    : "border-zinc-700 text-zinc-400 hover:text-white"
                }`}
              >
                Auto {autoScroll ? "ON" : "OFF"}
              </button>

              <button
                onClick={() => setSyncMode(!syncMode)}
                className={`px-4 py-2 rounded-full border text-sm transition ${
                  syncMode
                    ? "border-amber-500 text-amber-300 bg-amber-500/10"
                    : "border-zinc-700 text-zinc-400 hover:text-white"
                }`}
              >
                {syncMode ? "Sync ON" : "Sync"}
              </button>
            </div>

            {audioFile && (
              <div className="w-full flex flex-col items-center gap-3">
                <audio
                  ref={audioRef}
                  controls
                  className="w-full max-w-sm"
                  onPlay={handleAudioPlay}
                />

                <div className="flex items-center gap-4 w-full max-w-sm">
                  <span className="text-xs text-zinc-500 w-8 text-right">Vol</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-xs text-zinc-500 w-8">{Math.round(volume * 100)}%</span>
                </div>

                {autoScroll && (
                  <div className="flex items-center gap-4 w-full max-w-sm">
                    <span className="text-xs text-zinc-500 w-20">Speed</span>
                    <input
                      type="range"
                      min="1000"
                      max="8000"
                      step="500"
                      value={scrollSpeed}
                      onChange={(e) => setScrollSpeed(parseInt(e.target.value))}
                      className="flex-1 accent-purple-500"
                    />
                    <span className="text-xs text-zinc-500 w-12">{(scrollSpeed / 1000).toFixed(1)}s</span>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  className="w-full max-w-sm h-16 rounded-lg bg-zinc-900/60"
                />

                <div className="flex items-center gap-3">
                  {!recording ? (
                    <button
                      onClick={startRecording}
                      className="px-5 py-2 rounded-full bg-red-600/80 hover:bg-red-600 text-sm font-medium transition"
                    >
                      ● Record
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-5 py-2 rounded-full bg-red-800 text-red-300 text-sm font-medium transition animate-pulse"
                    >
                      ■ Stop {formatDuration(recordingDuration)}
                    </button>
                  )}
                  {recordedBlob && (
                    <audio controls src={URL.createObjectURL(recordedBlob)} className="h-10" />
                  )}
                </div>
              </div>
            )}

            <div className="relative w-full">
              <div
                className={`absolute -inset-1 rounded-2xl blur-lg transition-opacity duration-500`}
                style={{
                  background: `linear-gradient(to right, ${currentMood.from}66, ${currentMood.via}66, ${currentMood.to}66)`,
                  opacity: visible ? 1 : 0,
                }}
              />
              <div
                className={`relative w-full min-h-[220px] rounded-2xl border border-zinc-700/80 bg-zinc-900/60 p-8 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300 ${
                  visible ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="flex items-center gap-2 text-zinc-600">
                    {lines.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (syncMode) handleLineClick(i)
                          handleJumpToTimestamp(lines[i].timestamp)
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentIndex
                            ? "w-8"
                            : i < currentIndex
                              ? "w-2 bg-zinc-600"
                              : "w-2 bg-zinc-800"
                        }`}
                        style={i === currentIndex ? { background: currentMood.from } : {}}
                        title={
                          lines[i].timestamp !== null
                            ? `${formatDuration(lines[i].timestamp)}`
                            : syncMode
                              ? "Click to set timestamp"
                              : ""
                        }
                      />
                    ))}
                  </div>

                  {duetMode && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: `${singerColors[lines[currentIndex]?.singer || "A"]}33`,
                          color: singerColors[lines[currentIndex]?.singer || "A"],
                        }}
                      >
                        {lines[currentIndex]?.singer === "A" ? "Singer A" : "Singer B"}
                      </span>
                      {lines[currentIndex]?.timestamp !== null && (
                        <span className="text-xs text-zinc-500">
                          {formatDuration(lines[currentIndex]?.timestamp || 0)}
                        </span>
                      )}
                    </div>
                  )}

                  {animMode === "splittext" && lines[currentIndex] ? (
                    <p
                      className="flex flex-wrap justify-center text-2xl leading-relaxed font-medium min-h-[2em]"
                      style={{ color: duetMode ? singerColors[lines[currentIndex]?.singer || "A"] : "inherit" }}
                    >
                      {lines[currentIndex].text.split("").map((char, i) => (
                        <span
                          key={`${splitKey}-${i}`}
                          className="inline-block animate-split-in"
                          style={{
                            animationDelay: `${i * 0.08}s`,
                          }}
                        >
                          {char === " " ? "\u00A0" : char}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p
                      className="text-2xl text-center leading-relaxed font-medium min-h-[2em]"
                      style={{ color: duetMode ? singerColors[lines[currentIndex]?.singer || "A"] : "inherit" }}
                    >
                      {displayedText || (
                        <span className="text-zinc-600 text-lg italic">—</span>
                      )}
                      {isTyping && (
                        <span
                          className="inline-block w-[2px] h-[1.2em] ml-0.5 animate-pulse"
                          style={{ background: currentMood.from }}
                        />
                      )}
                    </p>
                  )}

                  <div className="text-xs text-zinc-600">
                    {currentIndex + 1} / {lines.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              {!autoScroll && (
                <button
                  onClick={handleNext}
                  disabled={currentIndex >= lines.length - 1}
                  className="group relative px-10 py-3 rounded-full font-semibold text-lg transition active:scale-95 disabled:cursor-not-allowed"
                >
                  <div
                    className={`absolute inset-0 rounded-full transition ${
                      currentIndex >= lines.length - 1
                        ? "bg-zinc-800"
                        : "opacity-80 group-hover:opacity-100"
                    }`}
                    style={
                      currentIndex < lines.length - 1
                        ? {
                            background: `linear-gradient(to right, ${currentMood.from}, ${currentMood.via}, ${currentMood.to})`,
                          }
                        : {}
                    }
                  />
                  <div
                    className={`absolute inset-0 rounded-full transition ${
                      currentIndex >= lines.length - 1
                        ? ""
                        : "bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_60%)]"
                    }`}
                  />
                  <span
                    className={`relative ${
                      currentIndex >= lines.length - 1 ? "text-zinc-500" : "text-white"
                    }`}
                  >
                    Next →
                  </span>
                </button>
              )}

              <button
                onClick={() => setIsInputMode(true)}
                className="px-5 py-3 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800/50 text-sm transition"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>

      {!isInputMode && (
        <div className="fixed bottom-4 left-4">
          <button
            onClick={() => {
              setLines([])
              setAudioFile(null)
              setIsInputMode(true)
              clearAllTimers()
              setAutoScroll(false)
              setRecordedBlob(null)
            }}
            className="px-4 py-2 rounded-full border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 text-xs transition"
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}
