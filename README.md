# Cyno

Design notes for an agentic astronomy assistant — a companion that answers
space questions, plans stargazing around your location and the weather, and
tells you when something worth looking at is about to happen.

> **There is no implementation in this repository.** It holds two planning
> documents and this README. Nothing has been built, and the earlier version of
> this file described features and a launch timeline as though they existed.
> Treat this as a design sketch that has not been started.

## What is here

| File | What it is |
| --- | --- |
| `GPTPlan.md` | An architecture plan drafted with GPT |
| `GeminiPlan.md` | The same problem planned with Gemini, kept for comparison |

Keeping both is the point of the repo as it stands: two models were given the
same brief, and the plans differ in how they split the agent loop from the data
layer. That comparison is the only real content here.

## The idea

An assistant that is useful specifically because it knows *where and when* you
are:

- Answer astronomy questions conversationally rather than as search results.
- Given a location and a date, say what is actually observable — accounting for
  moon phase, cloud cover and light pollution, not just what is above the
  horizon.
- Notify ahead of eclipses, meteor showers, oppositions and ISS passes.
- Explain what you are looking at once you have found it.

The parts that would need real work are the observability calculation and the
notification scheduling. The conversational layer is the easy half, which is
roughly the opposite of how the previous README presented it.

## If this gets picked up

The first milestone worth building is narrow: take a latitude, longitude and
date, and return a ranked list of observable objects with the reasoning shown.
That is testable without any model in the loop, and everything conversational
can sit on top of it later.

No dates are promised here. The previous roadmap committed to a beta that never
happened, which is worse than committing to nothing.

## License

MIT.
