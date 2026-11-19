# AGENTS.md

## Project

Maintain the local Node.js 26 RPM and image release pipeline for Eliware.

## Scope and boundaries

Keep release rules in `docs/RELEASE-CONTRACT.md`. Keep package and image updates in the local conductor.

## Layout

Keep implementation modules in `src/`, launchers in `bin/`, tests in `tests/`, and fixtures in `test-fixtures/`.

## Development

Use Node.js 26 or later and native ESM for maintained JavaScript modules.

## Validation

Run `npm run lint`, `npm run audit`, `npm run format`, and `npm run format:check` when needed.

## Security

Keep signing keys, webhook URLs, private data, and runtime state out of Git.

## Changes

Update focused tests, release notes, and user documentation when behavior changes.

## Application

Keep implementation modules in `src/`, launchers in `bin/`, tests in `tests/`, and fixtures in `test-fixtures/`.

Run focused tests first during development. Pass test paths to `npm test` for focused testing.
Run one test file with `npm test -- tests/path/to/example.test.mjs`.
Run multiple test files with `npm test -- tests/path/to/first.test.mjs tests/path/to/second.test.mjs`.
Prevent repeated full-suite runs during development.
Run the full `npm test` suite for final validation before a commit, milestone, or release.
