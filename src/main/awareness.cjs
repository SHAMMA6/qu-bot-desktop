// Watches which window is in the foreground, so the mascot can react to what you
// are actually doing and perch beside it.
//
// Privacy: everything here stays in this process. The window title is used only
// to notice that something changed and is never written to disk, never shown in
// a speech bubble, and never leaves the machine — only the coarse app kind
// ("your editor", "the browser") is ever surfaced. The whole watcher is off
// unless `watchActivity` is enabled, and killing it stops all of it.
//
// Implementation note: this is one long-lived PowerShell reading the foreground
// window on a timer. The script is written in the clear to the app's userData
// folder and run with -File, so anyone who wants to audit what is being read can
// just open it. It deliberately avoids -EncodedCommand, which hides the payload
// from both the user and endpoint security for no benefit here.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app, screen } = require('electron');

const SCRIPT = String.raw`
param([int]$parent = 0)
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class QuFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
# PER_MONITOR_AWARE_V2, so GetWindowRect reports true physical pixels rather than
# values virtualised for the primary monitor's scaling.
try { [void][QuFg]::SetProcessDpiAwarenessContext([IntPtr](-4)) } catch {}

$names = @{}
$last = ''
while ($true) {
  # Never outlive the app. A normal quit kills this process directly, but if
  # QU Bot is force-terminated nothing would clean it up, and an orphaned polling
  # loop is exactly the kind of thing that should not be left running.
  if ($parent -ne 0) {
    try { [void][System.Diagnostics.Process]::GetProcessById($parent) } catch { exit }
  }
  try {
    $h = [QuFg]::GetForegroundWindow()
    if ($h -ne [IntPtr]::Zero -and -not [QuFg]::IsIconic($h)) {
      $sb = New-Object System.Text.StringBuilder 512
      [void][QuFg]::GetWindowTextW($h, $sb, 512)
      $title = $sb.ToString()
      $procId = 0
      [void][QuFg]::GetWindowThreadProcessId($h, [ref]$procId)
      if (-not $names.ContainsKey($procId)) {
        try { $names[$procId] = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { $names[$procId] = '' }
        if ($names.Count -gt 200) { $names.Clear() }
      }
      $r = New-Object QuFg+RECT
      [void][QuFg]::GetWindowRect($h, [ref]$r)
      # The desktop shell itself is not a window you are "working in".
      if ($title -eq '' -or $title -eq 'Program Manager') { Start-Sleep -Milliseconds 700; continue }
      $key = "$procId|$title|$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
      if ($key -ne $last) {
        $last = $key
        $o = [ordered]@{ p = $names[$procId]; t = $title; r = @($r.Left, $r.Top, $r.Right, $r.Bottom) }
        [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
        [Console]::Out.Flush()
      }
    }
  } catch {}
  Start-Sleep -Milliseconds 700
}
`;

class Awareness {
  constructor(onChange) {
    this.onChange = onChange;
    this.child = null;
    this.buffer = '';
    this.stopped = true;
    this.retries = 0;
    this.lastKey = '';
  }

  scriptPath() {
    const file = path.join(app.getPath('userData'), 'activity-watch.ps1');
    // Rewrite every launch so an edited or stale copy can never be executed.
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, SCRIPT, 'utf8');
    return file;
  }

  start() {
    if (this.child || process.platform !== 'win32') return;
    this.stopped = false;
    let file;
    try {
      file = this.scriptPath();
      this.child = spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file,
          '-parent', String(process.pid)],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (err) {
      console.error('[qubot] activity watcher could not start:', err.message);
      this.child = null;
      return;
    }

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.consume(chunk));
    this.child.on('exit', () => {
      this.child = null;
      if (this.stopped) return;
      // Back off on repeated failures rather than spinning up processes forever.
      this.retries += 1;
      if (this.retries > 5) return;
      setTimeout(() => { if (!this.stopped) this.start(); }, 2000 * this.retries);
    });
    this.child.on('error', () => { this.child = null; });
  }

  stop() {
    this.stopped = true;
    this.lastKey = '';
    if (this.child) {
      try { this.child.kill(); } catch { /* already gone */ }
      this.child = null;
    }
  }

  get running() { return !!this.child; }

  consume(chunk) {
    this.buffer += chunk;
    let nl;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line) this.emit(line);
    }
    if (this.buffer.length > 8192) this.buffer = '';
  }

  emit(line) {
    let raw;
    try { raw = JSON.parse(line); } catch { return; }
    if (!raw || typeof raw.p !== 'string') return;

    // Ignore ourselves: the mascot reacting to its own settings window is noise.
    if (/^electron$/i.test(raw.p) && /qu bot/i.test(raw.t || '')) return;

    const [l, t, r, b] = raw.r || [0, 0, 0, 0];
    let rect = null;
    if (r > l && b > t) {
      try {
        // Physical pixels from a DPI-aware process -> the DIP space everything
        // else in the app works in.
        const dip = screen.screenToDipRect(null, { x: l, y: t, width: r - l, height: b - t });
        rect = { x: dip.x, y: dip.y, w: dip.width, h: dip.height };
      } catch { rect = null; }
    }

    const key = `${raw.p}|${raw.t}|${rect ? `${rect.x},${rect.y},${rect.w},${rect.h}` : ''}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.onChange({ process: raw.p, title: raw.t || '', rect });
  }
}

module.exports = { Awareness };
