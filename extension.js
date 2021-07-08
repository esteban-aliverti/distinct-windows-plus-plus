/*jshint esversion: 6 */
'use strict';

let on_window_created;

const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Me = ExtensionUtils.getCurrentExtension();
const Workspace = imports.ui.workspace;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const Markers = Me.imports.markers;

//TODO: make this a configuration
let createRandomForUnamatched = false;

let windowConfigs;
let originalWorkspace;
let settings;
let wmHandler;
let settingsHandler;

var MyWorkspace = GObject.registerClass(
    class MyWorkspace extends Workspace.Workspace {
        _addWindowClone(metaWindow) {
            const clone = super._addWindowClone(metaWindow);

            // This function is called on the window clone and
            // attaches marker to the window
            (function _extendWindow() {
                const windowName = metaWindow.toString();
                log("Window: ", metaWindow.get_title()); //https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-get-title

                const tracker = Shell.WindowTracker.get_default();
                const app = tracker.get_window_app(metaWindow); //https://developer.gnome.org/shell/unstable/shell-shell-app.html

                log("App: "+app.get_name());

                if (windowName in windowConfigs) {
                    const { uniqueName, color } = windowConfigs[windowName];
                } else {
                    setMarker(windowName, app.get_name(), metaWindow.get_title());
                }

                this._marker = {};
                this._marker.box = new St.Bin();

                const { uniqueSymbol, color } = windowConfigs[windowName];
                this._marker.box.style = `background-color: ${color};
                                          border-radius: 0 0 10px 0;
                                          padding: 2px;
                                          text-align: center;`;
                this._marker.box.height = 40;
                this._marker.box.width = 150;


                this._marker.label = new St.Label({
                    style_class: 'extension-distinctWindowsPlusPlus-label',
                    text: `${uniqueSymbol}`
                });
                this._marker.box.add_actor(this._marker.label);

                this.add_child(this._marker.box);
            }).call(clone);

            return clone;
        }
    });


function resetWindowMarkers() {
    // Replace markers in all existing windowConfigs
    log("Reseting all markers");
    for (const windowName in windowConfigs) {
        setMarker(windowName);
    }
}

function setMarker(windowName, appName, windowTitle) {
    // Persist marker and color for given window
    let setting = settings.get_value('marker-choice');
    let marker = Markers[setting.unpack()];
    windowConfigs[windowName] = generateMarker(windowName, appName, windowTitle);
}

function generateMarker(markers, appName, windowTitle) {
    let label;
    let color;
    if (appName === "SWT" || appName === "Eclipse") {
        if (windowTitle.indexOf(" -") > 0) {
            label = windowTitle.substring(0,windowTitle.indexOf(" -"));
            color = `rgba(250, 96, 25, 0.7)`;
        } else {
            label = "UNBLU";
            color = `rgba(250, 96, 25, 0.7)`;
        }
    } else if(createRandomForUnamatched) {
        const index = Math.floor(Math.random() * markers.length);
        label = markers[index];
        color = generateRGBA();
    }

    return { uniqueSymbol: label, color: color };
}

function generateRandomColor() {
    return Math.floor((Math.random() * 255) + 1);
}

function generateRGBA() {
    return `rgba(${generateRandomColor()}, ${generateRandomColor()}, ${generateRandomColor()}, 0.7)`;
}


function enable() {
    log(`Enabling ${Me.metadata.name} version ${Me.metadata.version}`);

    settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.distinctPlusPlus');

    windowConfigs = {};

    Workspace.Workspace = MyWorkspace;

    let wm = global.window_manager;
    wmHandler = wm.connect('destroy', function(_shellwm, actor) {
        // Remove configs for windows that has been closed
        let metaName = actor.meta_window.toString();
        delete windowConfigs[metaName];
    });

    // When user changed preferred markers in settings, reset all markers
    settingsHandler = settings.connect('changed::marker-choice', function() {
        resetWindowMarkers();
    });
    log('Done');

}

function init() {
    log(`Initializing ${Me.metadata.name} version ${Me.metadata.version}`);
    originalWorkspace = Workspace.Workspace;
}

function disable() {
    log(`Disabling ${Me.metadata.name} version ${Me.metadata.version}`);
    Workspace.Workspace = originalWorkspace;
    windowConfigs = {};
    if (settings && settingsHandler) {
        settings.disconnect(settingsHandler);
    }
    if (wmHandler) {
        let wm = global.window_manager;
        wm.disconnect(wmHandler);
    }
}
