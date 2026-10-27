import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

/** Place new application windows on the current primary monitor, once. */
export default class PrimaryMonitorLaunchExtension extends Extension {
    enable() {
        // An extension can be enabled mid-session. Those windows must stay put,
        // even if GNOME later maps their actors again.
        this._knownWindows = new Map();
        for (const window of global.display.list_all_windows())
            this._remember(window);

        this._mapId = global.window_manager.connect('map', (_wm, actor) => {
            const window = actor?.meta_window;
            if (!window || !this._remember(window))
                return;

            // Dialogs and popups need native placement. Wayland can report a
            // parented xdg_toplevel as NORMAL, so check the parent as well.
            if (window.get_window_type() !== Meta.WindowType.NORMAL ||
                window.get_transient_for())
                return;

            const primary = global.display.get_primary_monitor();
            if (primary < 0 || window.get_monitor() === primary)
                return;

            // No retry/polling: the user can move it anywhere afterwards.
            try {
                window.move_to_monitor(primary);
            } catch (error) {
                // A client can close while its first map is being processed.
                console.warn(`Primary Monitor Launch: move failed: ${error}`);
            }
        });
    }

    _remember(window) {
        // GJS can recreate JS wrappers for the same Meta.Window. The stable
        // sequence is tied to the native window, unlike object identity.
        const sequence = window.get_stable_sequence();
        if (this._knownWindows.has(sequence))
            return false;

        // Retain the wrapper and free both the window and our bookkeeping
        // when Mutter unmanages it; this prevents growth in long sessions.
        const signalId = window.connect('unmanaged', () => {
            this._knownWindows?.delete(sequence);
        });
        this._knownWindows.set(sequence, {window, signalId});
        return true;
    }

    disable() {
        if (this._mapId) {
            global.window_manager.disconnect(this._mapId);
            this._mapId = null;
        }
        for (const {window, signalId} of this._knownWindows.values())
            window.disconnect(signalId);
        this._knownWindows.clear();
        this._knownWindows = null;
    }
}
