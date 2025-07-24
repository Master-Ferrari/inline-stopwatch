# Inline Stopwatch Obsidian Plugin

This plugin replaces inline code snippets with an interactive stopwatch.

Use the following syntax inside code spans:

```
`stopwatch passed: 00:00:03`
```

Optional parameters `name`, `limit`, and `passed` can be added in any order. `passed` defaults to `00:00:00` and is automatically inserted after the stopwatch is started:


```
`stopwatch name: Pomodoro passed: 00:00:00 limit: 00:25:00`
```

When rendered, the code snippet is replaced with a play/pause button, the name
(if provided), the elapsed time and, if a limit is set, a progress bar. The
elapsed time is stored internally in seconds but displayed in the familiar
`HH:MM:SS` format.

## Building

Run `npm install` and then `npm run build` to generate `main.js` in the plugin
folder. Copy the entire folder into your vault's `plugins` directory to use the
plugin.
