# Primary Monitor Launch

A small GNOME Shell 50 extension intended for Ubuntu 26.04 on Wayland.
Newly mapped **ordinary application windows** are requested to open on the
primary monitor selected in **Settings → Displays**. It does not change an
existing window, move it again, maximize it, or alter workspace selection.

## Install

Download `primary-monitor-launch@zedmanauk.github.io.zip`, then run:

```bash
gnome-extensions install "$PWD/primary-monitor-launch@zedmanauk.github.io.zip" --force
```

If you downloaded the ZIP elsewhere, replace `$PWD/...` with its full path.

**Log out and back in** to load a newly installed extension under Wayland.
Then enable it:

```bash
gnome-extensions enable primary-monitor-launch@zedmanauk.github.io
gnome-extensions info primary-monitor-launch@zedmanauk.github.io
```

You can also enable or disable it in Ubuntu's **Extensions** application.

## How it behaves

- New normal windows launched onto a secondary monitor are moved once to
  whichever monitor GNOME currently considers primary.
- Windows that were already open before enabling are left alone, even if
  they subsequently remap.
- Later manual moves are never undone by this extension.
- Dialogs, utility windows, popups, docks and other special windows remain
  under GNOME's usual placement so they stay attached to their parent.
- No settings, polling, timers, network calls or background processes.

GNOME applications may issue their own late placement/fullscreen requests.
Because this deliberately makes only one move at the map event, unusual apps
that reposition themselves afterward may still open on another monitor.
The extension has **automated simulated-signal tests**, but should be tested
in a real GNOME 50 desktop before relying on it.

## Disable or uninstall

```bash
gnome-extensions disable primary-monitor-launch@zedmanauk.github.io
gnome-extensions uninstall primary-monitor-launch@zedmanauk.github.io
```

To reinstall an updated package on Wayland, install it with `--force`, log
out and back in, and enable it again if necessary.

## Development test

From the source directory:

```bash
node --test tests/extension.test.mjs
```

This tests extension behavior using mocked GNOME window/monitor signals;
it cannot replace live compositor testing.
