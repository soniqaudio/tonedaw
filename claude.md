# Claude.md - Tone DAW Project Context

## Project Overview

**Tone** (also referred to as "tonedaw") is an open-source web-based Digital Audio Workstation (DAW) inspired by FL Studio, Ableton Live, and similar professional music production software. The project is being developed for the **soniqaudio** brand.

### Key Characteristics
- **Next.js 16** with TypeScript
- **React 19** for UI
- **Zustand** for state management
- **Tone.js** and **soundfont-player** for audio playback
- **TypeScript** 
- **Biome for Linting/Formatting** 
- **Canvas-based** piano roll editor (ported from earlier work)
- Focus on MIDI recording, editing, and audio playback

### Current State
The project is in a **good foundational state** with:
- Functional piano roll editor with note editing, velocity editing, ghost notes
- MIDI recording and playback
- Transport controls (play, pause, stop, loop)
- Metronome
- Basic track system
- View switching (Piano Roll, Playlist, Mixer - latter two are mockups)

**Important Note**: Every line of code has been AI-written, so nothing should be assumed perfect. Always verify and review.

---

## Architecture Decisions

### Pattern System
- **FL Studio-style pattern-based architecture**
- Reusable patterns that can be referenced multiple times in playlist
- Ghost notes infrastructure already supports this
- Better for MIDI sequence reuse

### Per-Track Audio Routing
- **Yes, confirmed** - Needed when multiple tracks exist
- Currently: Single global soundfont piano
- Future: Each track can have independent instruments/sounds
- Will need per-track audio routing to master bus
- Supports 15-20+ tracks with different sounds that live independently but share master

### Backend & Persistence
- **Convex** for all backend needs:
  - Project saving/loading
  - User authentication
  - Data persistence
  - When it becomes relevant (not yet implemented)

### Audio Export
- **mediabunny** (ffmpeg in TypeScript)
  - Open source
  - TypeScript-based audio processing
  - For exporting projects to audio files

### Hosting & Infrastructure
- **Vercel** for hosting, DX, and infrastructure
  - Excellent ecosystem
  - Developer-friendly
  - Good integration with Next.js

---

## Technology Stack

### Core
- **Next.js 16.0.1** - Framework
- **React 19.2.0** - UI library
- **TypeScript 5** - Type safety

### State Management
- **Zustand 5.0.8** - State management
- **Zundo 2.3.0** - Temporal undo/redo (currently only on MIDI store)

### Audio
- **Tone.js 15.1.22** - Audio framework
- **soundfont-player 0.12.0** - Soundfont playback
- **@tonejs/midi 2.0.28** - MIDI file handling

### Styling
- **Tailwind CSS 4** - Utility-first CSS
- **PostCSS** - CSS processing

### Code Quality
- **Biome 2.2.0** - Linting and formatting

### Future Integrations
- **Convex** - Backend (when needed)
- **mediabunny** - Audio export (when needed)

---

## Project Structure

```
src/
├── components/
│   ├── app/              # App shell, sidebar
│   ├── Mixer/            # Mixer view (mockup)
│   ├── Playlist/         # Playlist view (mockup)
│   └── ...
├── core/
│   ├── audio/            # Audio engine (soundfont-based)
│   ├── constants/        # Music theory, piano roll constants
│   ├── hooks/            # Shared hooks (metronome, recording)
│   ├── midi/             # MIDI types, derivation, utilities
│   ├── music/            # Music theory (scales)
│   ├── playback/         # Playback controller, clip preparation
│   ├── stores/           # Zustand stores
│   └── utils/            # Utilities (ID generation, track utils)
├── features/
│   └── pianoroll/        # Piano roll feature
│       ├── components/   # Piano roll UI components
│       └── hooks/        # MIDI access, recording, typing piano
└── styles/               # Design system CSS
```

---

## Key Architecture Patterns

### State Management
- **Zustand stores** for different domains:
  - `useMidiStore` - MIDI clips, events, recording (with undo/redo)
  - `useTransportStore` - Playback state, playhead position
  - `useTrackStore` - Track management
  - `useUIStore` - UI state (scroll, toggles, grid resolution)
  - `useSoundStore` - Sound/instrument management
  - `useViewStore` - Active view (piano-roll, playlist, mixer)
  - `useMetronomeStore` - Metronome state
  - `useMusicTheoryStore` - Tempo, scales

### Audio Engine
- **Singleton pattern** (`audioEngine` instance)
- **Look-ahead scheduler** (26ms ticks, 180ms horizon, 20ms catch-up)
- Currently: Global soundfont piano
- Future: Per-track instrument routing

### Piano Roll Rendering
- **Layered canvas approach**:
  - `StaticGrid` - Background grid
  - `NotesLayer` - MIDI notes
  - `GhostNotesLayer` - Reference notes from other patterns
  - `DynamicOverlay` - Playhead, selection, active notes
- **Viewport-based rendering** - Only renders visible area

### MIDI Event System
- **Event-driven architecture**:
  - `MidiDomainEvent` - Source of truth (noteOn, noteOff, CC)
  - `MidiNoteClip` - Derived from events (for display/editing)
  - Derivation handles sustain pedal, note stacking
- **Recording previews** - Live note stretching during recording

---

## Coding Rules & Conventions

### General
- **TypeScript strict mode** - Always use proper types
- **Functional components** - Use React hooks, avoid class components
- **Zustand selectors** - Use shallow selectors when needed to prevent unnecessary re-renders
- **Canvas rendering** - Separate concerns into layers
- **Error handling** - Always handle errors gracefully (but error boundaries missing - see tasks)

### State Management
- **Single source of truth** - Events are source, clips are derived
- **Immutable updates** - Always create new objects/arrays
- **Action composition** - Actions are composed from smaller modules (see `midi/actions/`)

### Performance
- **Memoization** - Use `useMemo` for expensive computations
- **Canvas optimization** - Only redraw what's necessary
- **RAF loops** - Use `requestAnimationFrame` for smooth updates
- **Cleanup** - Always clean up event listeners, observers, timers

### Audio
- **AudioContext management** - Single context, resume on user interaction
- **Scheduling** - Use look-ahead scheduler pattern
- **Note cleanup** - Always clean up active notes map

### Naming Conventions
- **Stores**: `use[Domain]Store` (e.g., `useMidiStore`)
- **Hooks**: `use[Feature]` (e.g., `useMetronome`)
- **Components**: PascalCase (e.g., `PianoRoll`)
- **Actions**: Descriptive verbs (e.g., `addClip`, `updateClipDuration`)

---

## Known Issues & Technical Debt

### Critical Issues
1. **Double `usePianoRollDerivedState()` call** - Called twice per render in PianoRoll.tsx (lines 62 and 122)
2. **Recording race conditions** - Potential race conditions in recording state management (SON-35)
3. **Canvas memory** - Need to verify canvas cleanup on unmount (SON-36)
4. **Error boundaries** - No error boundaries implemented (SON-37)

### Performance Concerns
- **ResizeObserver cleanup** - Verify no leaks (currently handled but should audit)
- **Active notes cleanup** - Verify edge cases (currently handled in audioEngine.noteOff)
- **Event array limits** - No limits on event arrays for very long recording sessions

### Code Quality
- **Hardcoded magic numbers** - Extract to constants (SON-33)
- **Component complexity** - PianoRoll component is large, consider splitting (SON-25)
- **Documentation** - Missing comments explaining scheduler design, interaction flows

### Missing Features
- **Per-track audio routing** - Currently global soundfont only
- **Pattern system** - Infrastructure exists (ghost notes) but not fully implemented
- **Playlist/Mixer** - Currently mockups, need real store integration
- **Cut tool** - Note splitting not implemented
- **Piano roll zoom** - Horizontal zoom not implemented

---

## Development Workflow

### Project Owner
- **Ramon** - Mainly a music producer, not primarily a developer
- **AI Pair Programming** - All code has been AI-written so far
- **Expertise**: Music production, DAW workflows

### AI Assistant Context
- **Expert developer** with experience at Cloudflare, Vercel, Convex, ElevenLabs, Next.js
- **Role**: Technical implementation, architecture decisions, code quality
- **Approach**: Never assume code is perfect, always verify and review

### Collaboration Style
- **Questions welcome** - Always ask why X was done instead of Y
- **Thoughts and opinions** - Share thoughts on features, architecture, etc.
- **Iterative refinement** - Find sweet spots together as we go

---

## Future Considerations

### Backend Integration (Convex)
- Project persistence
- User authentication
- Real-time collaboration (future)
- Cloud storage for audio samples

### Audio Export (mediabunny)
- Export MIDI to audio files
- Render full project to WAV/MP3
- Offline rendering support

### Performance Optimization
- Web Workers for MIDI processing (SON-39)
- SharedArrayBuffer for audio (SON-41)
- OffscreenCanvas for rendering (SON-40)
- WASM for DSP (SON-42)

### AI Features (Future)
- Sound generation
- Chord progression generation
- Left panel "AI" tab (placeholder exists)

---

## Resources & References

### Documentation
- `docs/roadmap0811.md` - Development roadmap with phases
- This file (`claude.md`) - Project context and conventions
- `tasks.md` - Prioritized task list

### External Resources
- [Tone.js Documentation](https://tonejs.github.io/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)
- [Convex Documentation](https://docs.convex.dev/)
- [mediabunny](https://github.com/mediabunny) - Audio processing library
- [Next.js Documentation](https://nextjs.org/docs)

---

## Notes

- **First AI chat session** - This is the initial deep dive and planning session
- **Code review mindset** - Everything should be reviewed with fresh eyes
- **Architecture decisions** - Document decisions as they're made
- **Coding rules** - Will evolve as we discover patterns and preferences

