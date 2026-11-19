# AGENTS.md

## Project

Read README.md for repository purpose, ownership, and scope.

## Scope and boundaries

Keep release rules in docs/RELEASE-CONTRACT.md. Keep package and image updates in the local conductor.

## Layout

Read README.md and specs/README.md to find maintained files.

## Development

Use Node.js 26 or later and native ESM for maintained JavaScript modules.

## Validation

Run npm test for aggregate validation.
Run npm run lint for lint checks.
Run npm run audit for dependency checks.
Run npm run format to format files.
Run npm run format:check to check formatting.

## Security

Keep signing keys, webhook URLs, private data, and runtime state out of Git.

## Changes

Update focused tests, release notes, and user documentation when behavior changes.

## Application

Run focused tests first during development.
Run one test file with `npm test -- tests/path/to/example.test.mjs`.
Run multiple test files with `npm test -- tests/path/to/first.test.mjs tests/path/to/second.test.mjs`.
Prevent repeated full-suite runs during development.
Run the full `npm test` suite for final validation before a commit, milestone, or release.
