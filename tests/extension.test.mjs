import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../extension.js', import.meta.url), 'utf8')
    .replace("import Meta from 'gi://Meta';", '')
    .replace("import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';", '')
    .replace('export default class PrimaryMonitorLaunchExtension extends Extension', 'class PrimaryMonitorLaunchExtension extends Extension');

function setup({primary = 0, initial = []} = {}) {
    const signals = new Map();
    let nextSignal = 1;
    const wm = {
        connect(name, callback) { const id = nextSignal++; signals.set(id, {name, callback}); return id; },
        disconnect(id) { signals.delete(id); },
    };
    const display = {
        list_all_windows() { return initial; },
        get_primary_monitor() { return primary; },
    };
    const context = {Extension: class {}, Meta: {WindowType: {NORMAL: 0}}, global: {display, window_manager: wm}, console};
    vm.runInNewContext(source + '\nthis.ExtensionUnderTest = PrimaryMonitorLaunchExtension;', context);
    const extension = new context.ExtensionUnderTest();
    return {
        extension, signals,
        setPrimary(value) { primary = value; },
        map(window) { for (const {name, callback} of [...signals.values()]) if (name === 'map') callback(wm, {meta_window: window}); },
    };
}

let nextSequence = 10;
function makeWindow({monitor = 1, type = 0, parent = null, throws = false, sequence} = {}) {
    const listeners = new Map();
    let nextId = 1;
    const w = {
        moves: [],
        get_stable_sequence: () => sequence ?? w.sequence,
        get_window_type: () => type,
        get_transient_for: () => parent,
        get_monitor: () => monitor,
        move_to_monitor(value) { if (throws) throw Error('window closed'); w.moves.push(value); monitor = value; },
        connect(name, callback) { const id = nextId++; listeners.set(id, {name, callback}); return id; },
        disconnect(id) { listeners.delete(id); },
        emit(name) { for (const [, listener] of [...listeners]) if (listener.name === name) listener.callback(); },
        listenerCount: () => listeners.size,
    };
    w.sequence = sequence ?? nextSequence++;
    return w;
}

test('new normal window on secondary moves to primary', () => {
    const s = setup(); const w = makeWindow(); s.extension.enable(); s.map(w);
    assert.deepEqual(w.moves, [0]); s.extension.disable();
});
test('new window already on primary stays put', () => {
    const s = setup(); const w = makeWindow({monitor: 0}); s.extension.enable(); s.map(w);
    assert.deepEqual(w.moves, []); s.extension.disable();
});
test('windows present at enable are not moved', () => {
    const w = makeWindow(); const s = setup({initial: [w]}); s.extension.enable(); s.map(w);
    assert.deepEqual(w.moves, []); s.extension.disable();
});
test('repeat map does not move a window twice', () => {
    const s = setup(); const w = makeWindow(); s.extension.enable(); s.map(w); s.map(w);
    assert.deepEqual(w.moves, [0]); s.extension.disable();
});
test('manual movement after first map is preserved', () => {
    const s = setup(); const w = makeWindow(); s.extension.enable(); s.map(w);
    w.move_to_monitor(1); s.map(w); assert.deepEqual(w.moves, [0, 1]); s.extension.disable();
});
test('transient normal windows are ignored', () => {
    const s = setup(); const w = makeWindow({parent: {}}); s.extension.enable(); s.map(w);
    assert.deepEqual(w.moves, []); s.extension.disable();
});
test('non-normal windows are ignored', () => {
    const s = setup(); const w = makeWindow({type: 3}); s.extension.enable(); s.map(w);
    assert.deepEqual(w.moves, []); s.extension.disable();
});
test('new windows use the current primary monitor', () => {
    const s = setup(); s.extension.enable(); s.setPrimary(2);
    const w = makeWindow(); s.map(w); assert.deepEqual(w.moves, [2]); s.extension.disable();
});
test('unavailable primary monitor causes no move', () => {
    const s = setup({primary: -1}); const w = makeWindow(); s.extension.enable(); s.map(w);
    assert.deepEqual(w.moves, []); s.extension.disable();
});
test('window closing during move does not crash map callback', () => {
    const s = setup(); const w = makeWindow({throws: true}); s.extension.enable();
    assert.doesNotThrow(() => s.map(w)); s.extension.disable();
});
test('unmanaged window is removed from tracking', () => {
    const s = setup(); const w = makeWindow(); s.extension.enable(); s.map(w);
    assert.equal(s.extension._knownWindows.size, 1);
    w.emit('unmanaged'); assert.equal(s.extension._knownWindows.size, 0); s.extension.disable();
});
test('disable disconnects signal handlers and window listeners', () => {
    const s = setup(); const w = makeWindow(); s.extension.enable(); s.map(w);
    s.extension.disable(); assert.equal(s.signals.size, 0); assert.equal(w.listenerCount(), 0);
});
