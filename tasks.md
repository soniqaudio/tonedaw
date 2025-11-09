# Tasks - Tone DAW

Prioritized task list extracted from Linear. Tasks are categorized by priority and type.

---

## High Priority

### Critical Fixes
- **SON-35**: Potential recording race condition
  - Review recording state management
  - Ensure thread-safe state updates
  - Test concurrent recording scenarios

- **SON-36**: Canvas memory release
  - Verify canvas cleanup on component unmount
  - Check for memory leaks in canvas layers
  - Ensure proper disposal of canvas contexts

- **SON-26**: Fix active notes map cleanup in audioEngine
  - Verify edge cases in noteOff()
  - Ensure all note cleanup paths are covered
  - Test note stacking scenarios

- **SON-27**: Add ResizeObserver cleanup
  - Audit all ResizeObserver instances
  - Verify cleanup in useCanvasSize.ts and usePianoRollScrollSync.ts
  - Ensure no observer leaks

- **SON-24**: Fix double usePianoRollDerivedState() call
  - PianoRoll.tsx calls it twice per render (lines 62 and 122)
  - Consolidate to single call
  - Optimize derived state computation

- **SON-25**: Split PianoRoll component (container/presenter)
  - Component is too large and complex
  - Extract logic to container component
  - Keep presentation in presenter component
  - Improve maintainability

- **SON-37**: No error boundaries
  - Add React error boundaries
  - Prevent full app crashes
  - Graceful error handling

- **SON-33**: Hardcoded magic numbers
  - Extract magic numbers to constants
  - Move to appropriate constant files
  - Improve code maintainability

### Architecture & System Design
- **SON-19**: Architecture review and planning
  - Deep dive into current architecture
  - Identify bottlenecks and issues
  - Plan improvements

- **SON-17**: Code state review
  - Comprehensive code review
  - Document current state
  - Identify technical debt

- **SON-18**: Performance analysis
  - Profile application performance
  - Identify bottlenecks
  - Optimize critical paths

---

## Mid Priority

### Development Features
- **SON-21**: Overhaul playlist view
  - Replace mock data with real store integration
  - Implement playlist clip system
  - Connect to pattern store

- **SON-20**: Overhaul mixer view
  - Replace mock data with real track store
  - Connect volume faders to track state
  - Implement mute/solo functionality
  - Add real-time level meters

- **SON-32**: Per track audio routing
  - Implement per-track instrument loading
  - Route MIDI to correct instruments
  - Connect to master bus
  - Support 15-20+ tracks

- **SON-22**: Multi pattern support
  - Create pattern store
  - Pattern creation UI
  - Pattern switching in piano roll
  - Ghost notes per pattern

- **SON-11**: Cut tool piano roll
  - Implement note splitting
  - Split notes at cursor position
  - Update clip system

- **SON-12**: Piano roll zoom
  - Horizontal zoom in/out
  - Add zoom state to UIStore
  - Zoom controls (mousewheel or UI)
  - Scale pixelsPerBeat by zoom level

- **SON-13**: Pianoroll fix per note velocity
  - Verify velocity editing works correctly
  - Ensure per-note velocity selection
  - Test velocity drag editing

- **SON-15**: Main window full size view
  - Hide topbar and sidebar
  - Full-screen editing mode
  - Toggle functionality

- **SON-14**: Resizable panels
  - Browser/AI panel resize
  - Main window resize
  - Drag handles
  - Smooth transitions

- **SON-23**: Customization options (color, etc.)
  - Theme customization
  - Color scheme options
  - User preferences store

- **SON-38**: Performance monitoring
  - Add performance metrics
  - Monitor frame rates
  - Track audio latency
  - Performance dashboard

### Code Quality
- **SON-34**: Test coverage
  - Add unit tests
  - Integration tests
  - E2E tests for critical flows
  - Test coverage reporting

---

## Low Priority

### Research & Exploration
- **SON-31**: Convex backend thoughts / system design
  - Research Convex integration
  - Design data models
  - Plan migration strategy
  - Document architecture

- **SON-39**: Web worker for MIDI processing and offloading
  - Research web worker architecture
  - Design MIDI processing pipeline
  - Offload heavy computations
  - Improve main thread performance

- **SON-40**: Offscreen canvas rendering
  - Research OffscreenCanvas API
  - Design rendering pipeline
  - Improve canvas performance
  - Reduce main thread load

- **SON-41**: SharedArrayBuffer for audio
  - Research SharedArrayBuffer usage
  - Design audio buffer sharing
  - Worker communication
  - Security considerations

- **SON-42**: WASM for DSP
  - Research WASM for audio processing
  - Evaluate DSP libraries
  - Design integration strategy
  - Performance benchmarks

- **SON-16**: Explore tembo, coderabbit, graphite
  - Research development tools
  - Evaluate code review tools
  - Consider integration

### General Tasks
- **SON-44**: Subscribe to cursor
- **SON-43**: Buy domains
  - soniqaudio / tonedaw domain

### Marketing Tasks (Not Development)
- **SON-48**: Piano video
- **SON-47**: Tonedaw website
- **SON-46**: Soniqaudio website
- **SON-45**: Work on (OSS) branding
- **SON-30**: Create discord
- **SON-29**: Higgsfield artworks
- **SON-28**: Twitter / posts
- **SON-9**: Convex OSS grant
- **SON-10**: Vercel OSS grant January
- **SON-8**: ElevenLabs OSS grant
- **SON-7**: soniqaudio / tonedaw domain
- **SON-5**: soniqaudio/tonedaw github repo

---

## Task Categories Summary

### Fixes (High Priority)
- Recording race conditions
- Memory leaks (canvas, ResizeObserver, active notes)
- Double hook calls
- Component complexity
- Error boundaries
- Magic numbers

### Development Features (Mid Priority)
- Playlist/Mixer overhaul
- Per-track audio routing
- Multi-pattern support
- Piano roll tools (cut, zoom)
- UI improvements (resizable panels, full-screen)
- Customization options
- Performance monitoring

### Architecture (High/Mid Priority)
- Architecture review
- Code state review
- Performance analysis
- System design decisions

### Research (Low Priority)
- Convex backend integration
- Web Workers
- OffscreenCanvas
- SharedArrayBuffer
- WASM for DSP
- Development tools exploration

---

## Notes

- Tasks extracted from Linear screenshots (SON-5 through SON-48)
- Priority based on:
  - **High**: Critical bugs, architecture issues, system stability
  - **Mid**: Feature development, improvements, code quality
  - **Low**: Research, exploration, future considerations
- Marketing/general tasks listed but not prioritized (not development work)
- Some tasks may overlap or be related (e.g., SON-19, SON-17, SON-18 all relate to architecture review)

