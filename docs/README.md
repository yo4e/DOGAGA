# DOGAGA Documentation Guide

For WebMCP Challenge evaluation and the current public `compact production v0`, start with the English documents below.

## Current / evaluation-facing

- [Architecture — compact production v0](ARCHITECTURE.md)
- [Human–agent collaboration / Teach by Example](AGENT_COLLABORATION.md)
- [Still-image support](STILL_IMAGE_SUPPORT.md)
- [WebMCP browser compatibility and final validation](WEBMCP_BROWSER_COMPATIBILITY.md)
- [Privacy and local-data boundary](PRIVACY_AND_DATA_BOUNDARY.md)
- [Devpost submission draft](DEVPOST_SUBMISSION_DRAFT.md)
- [Challenge demo video script](CHALLENGE_DEMO_VIDEO_SCRIPT.md)

The repository root [README](../README.md) is also English and describes the current public feature set, setup, limitations, 23-tool WebMCP surface, and the final Challenge collaboration story:

> **Human teaches → DOGAGA captures semantic meaning → Agent generalizes → Human approves**

## Historical / internal development material

DOGAGA began before the Challenge and the repository intentionally keeps earlier Japanese design notes, product plans, research, ADRs, implementation batches, terminology guides, and Issue history.

Those files are useful development history, but some describe planned features such as persistence, waveform editing, lyrics/captions, or earlier single-track / 20-tool WebMCP stages that are **not the current submitted build**.

In particular, older files such as `PRODUCT_VISION.md`, `DEVELOPMENT_ROADMAP.md`, `WEBMCP_MVP_IMPLEMENTATION_PLAN.md`, `JAPANESE_UI_GLOSSARY.md`, and early ADRs should be read as historical planning unless the current README or Architecture document explicitly says otherwise.

This preserves repository history while giving reviewers a clear English path through the current product.
