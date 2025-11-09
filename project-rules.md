# Project Rules - Tone DAW

Nuanced, specific rules and guidelines for the Tone DAW project, derived from project discussions and architectural decisions.

---

## Project Context

**Project Type:** Open-source web DAW (Digital Audio Workstation)  
**Brand:** soniqaudio  
**Vision:** Part of a larger ecosystem including an open plugin format (CLAP/VST alternative for web)  
**Team Structure:** Open-source startup with technical cofounder (AI assistant) and general cofounder (Ramon - marketing, roadmap, brand, community)

---

## Code Quality & Style

### Component Architecture
- **Component Separation:** Piano roll, mixer, playlist are separate components with clear boundaries
- **Global State:** Time, audio, and other global concerns live in global stores, not component-local state
- **State Management:** Use Zustand for state management. Research if Zustand+Zundo is optimal for global undo/redo, or if better alternatives exist
- **Code Quality:** High-quality, maintainable code. Treat this as production code, not a prototype

### Comments & Documentation
- **Comments:** Only where necessary, ideally short explanations of what a section does/why it exists
- **Self-Documenting:** Prefer self-documenting code over verbose comments


### File Organization
- Components live in their own directories (`pianoroll/`, `mixer/`, `playlist/`)
- Global concerns (audio, time, MIDI) live in `core/`
- Clear separation of concerns

---

## Architecture Decisions

### Pattern System
- **Style:** FL Studio-style pattern system
- **Pattern-Sound Linking:** Patterns are linked to their corresponding sounds (piano, drums, etc.)
- **Playlist Integration:** Patterns can live in playlist view and be referenced multiple times
- **Modularity:** Everything must stay modular - patterns, clips, tracks are independent entities

### Undo/Redo System
- **Current State:** Only MIDI store has undo/redo (Zundo)
- **Target State:** Global undo/redo system covering:
  - MIDI edits (already implemented)
  - Playlist clip deletion/movement
  - Mixer volume changes
  - Track operations
  - All user actions should be undoable
- **Research Required:** Evaluate if Zustand+Zundo is best approach, or if alternatives exist

### Audio System
- **Current:** Single global soundfont piano
- **Target:** Per-track audio routing with independent instruments
- **Future:** Open plugin format for web (synths, reverb, EQ, etc.) - part of soniqaudio ecosystem vision
- **Local Sample Access:** Research how to allow users to reference local folders (like FL Studio's folder linking)
  - Challenge: Browser security, 15GB+ collections, storage/traffic implications
  - TBD: Technology feasibility for local folder access

### Project Persistence
- **File Format:** TBD - research best format (JSON, binary, Convex-native)
- **Offline Support:** DAW runs offline except for AI features
- **Saving:** TBD - too early to decide on save/load strategy

---

## Feature Priorities

### Priority Philosophy
- **Healthy Mixture:** Balance bugs, features, and performance improvements
- **No Performance Issues Yet:** No encountered performance problems, but fix bugs if found
- **User Context:** Ramon records classical piano pieces (few minutes long), not yet hitting limits

### Piano Roll Features
- **Zoom:** Trackpad pinch-to-zoom support
  - Zoom in = expand width (notes get longer visually)
  - Horizontal scroll adjustment for zoom level
  - Not peak priority, but desired
  - Complexity: Canvas is already complex, evaluate feasibility
- **Cut Tool:** When splitting notes, create 2 separate clips (modular approach)
  - Second clip begins at cut point
  - Everything stays modular

### Error Handling & Testing
- **Current:** TBD - not priority yet
- **Future:** Will need proper error handling and testing
- **Learning:** Ramon will learn testing concepts (unit/integration/E2E) later

---

## Development Workflow

### Code Review Mindset
- **AI-Generated Code:** Every line has been AI-written, so nothing should be assumed perfect
- **Fresh Eyes:** Always review with fresh perspective
- **Question Everything:** Ask why X was done instead of Y
- **Iterative Refinement:** Find sweet spots together as we go

### Research & Learning
- **Research-Driven:** Explore and research best approaches (e.g., undo/redo systems)
- **Educational:** Code should help Ramon learn development concepts
- **Open Source:** This is an open-source project, code should be accessible and well-documented

### Session Logging
- **Keep Logs:** Maintain session logs in this file (max 5 lines per session)
- **Track Progress:** Document key decisions and learnings per session

---

## Technical Constraints

### Browser Limitations
- **Audio:** Web Audio API limitations (32 AudioNodes per context)
- **MIDI:** Browser security policies for MIDI access
- **Storage:** Browser storage limits for local samples
- **Sandbox:** Browser sandbox prevents VST plugins (motivation for web plugin format)

### Performance Considerations
- **Current State:** No performance issues encountered
- **Future:** May need optimization as project scales
- **Monitoring:** Track performance as features are added

---

## Future Vision

### Plugin System
- **Goal:** Open plugin format (CLAP/VST alternative for web)
- **Ecosystem:** Part of soniqaudio brand ecosystem
- **Timeline:** Long-term vision, not immediate priority

### AI Features
- **Scope:** Sound generation, chord progression generation
- **Online Requirement:** AI features require online connection
- **Integration:** Left panel "AI" tab (placeholder exists)

---

## Session Log

### Session 1 - Initial Planning Deep Dive (0911)
- Created comprehensive planning documents (claude.md, tasks.md, architecture-review.md)
- Established project context and architecture decisions
- Documented current state and future vision
- Created visual architecture diagrams (architecture-diagrams.md, system-design.md)

### Session 2 - Clarification & Rules (0911)
- Clarified pattern system: FL Studio-style with sound linking
- Established global undo/redo requirement (research Zustand+Zundo vs alternatives)
- Confirmed modular approach for all features (cut tool, patterns, clips)
- Set priority philosophy: healthy mixture of bugs, features, performance
- Created project-rules.md with nuanced guidelines

---

## Notes

- **Flexibility:** Rules evolve as project matures
- **Learning Journey:** Ramon is learning development, so explanations and educational code are valuable
- **Open Source:** Code quality matters for open-source project
- **Startup Mindset:** Treat as startup, not hobby project

---

*Last Updated: Session 2 - Clarification & Rules*

