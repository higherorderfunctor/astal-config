"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Bar;
var astal_1 = require("astal");
var gtk3_1 = require("astal/gtk3");
var hyprland_1 = require("@astal/hyprland");
var mpris_1 = require("@astal/mpris");
var battery_1 = require("@astal/battery");
var wp_1 = require("@astal/wp");
var network_1 = require("@astal/network");
var tray_1 = require("@astal/tray");
function SysTray() {
    var tray = tray_1.default.get_default();
    return <box className="SysTray">
        {(0, astal_1.bind)(tray, "items").as(function (items) { return items.map(function (item) { return (<menubutton tooltipMarkup={(0, astal_1.bind)(item, "tooltipMarkup")} usePopover={false} actionGroup={(0, astal_1.bind)(item, "action-group").as(function (ag) { return ["dbusmenu", ag]; })} menuModel={(0, astal_1.bind)(item, "menu-model")}>
                <icon gicon={(0, astal_1.bind)(item, "gicon")}/>
            </menubutton>); }); })}
    </box>;
}
function Wifi() {
    var wifi = network_1.default.get_default().wifi;
    return <icon tooltipText={(0, astal_1.bind)(wifi, "ssid").as(String)} className="Wifi" icon={(0, astal_1.bind)(wifi, "iconName")}/>;
}
function AudioSlider() {
    var _a;
    var speaker = (_a = wp_1.default.get_default()) === null || _a === void 0 ? void 0 : _a.audio.defaultSpeaker;
    return <box className="AudioSlider" css="min-width: 140px">
         <icon icon={(0, astal_1.bind)(speaker, "volumeIcon")}/>
         <slider hexpand onDragged={function (_a) {
        var value = _a.value;
        return speaker.volume = value;
    }} value={(0, astal_1.bind)(speaker, "volume")}/>
     </box>;
}
function BatteryLevel() {
    var bat = battery_1.default.get_default();
    return <box className="Battery" visible={(0, astal_1.bind)(bat, "isPresent")}>
         <icon icon={(0, astal_1.bind)(bat, "batteryIconName")}/>
         <label label={(0, astal_1.bind)(bat, "percentage").as(function (p) {
            return "".concat(Math.floor(p * 100), " %");
        })}/>
     </box>;
}
function Media() {
    var mpris = mpris_1.default.get_default();
    return <box className="Media">
         {(0, astal_1.bind)(mpris, "players").as(function (ps) { return ps[0] ? (<box>
                 <box className="Cover" valign={gtk3_1.Gtk.Align.CENTER} css={(0, astal_1.bind)(ps[0], "coverArt").as(function (cover) {
                return "background-image: url('".concat(cover, "');");
            })}/>
                 <label label={(0, astal_1.bind)(ps[0], "title").as(function () {
                return "".concat(ps[0].title, " - ").concat(ps[0].artist);
            })}/>
             </box>) : ("Nothing Playing"); })}
     </box>;
}
function Workspaces() {
    var hypr = hyprland_1.default.get_default();
    return <box className="Workspaces">
         {(0, astal_1.bind)(hypr, "workspaces").as(function (wss) { return wss
            .sort(function (a, b) { return a.id - b.id; })
            .map(function (ws) { return (<button className={(0, astal_1.bind)(hypr, "focusedWorkspace").as(function (fw) {
                return ws === fw ? "focused" : "";
            })} onClicked={function () { return ws.focus(); }}>
                     {ws.id}
                 </button>); }); })}
     </box>;
}
function FocusedClient() {
    var hypr = hyprland_1.default.get_default();
    var focused = (0, astal_1.bind)(hypr, "focusedClient");
    return <box className="Focused" visible={focused.as(Boolean)}>
         {focused.as(function (client) { return (client && <label label={(0, astal_1.bind)(client, "title").as(String)}/>); })}
     </box>;
}
function Time(_a) {
    var _b = _a.format, format = _b === void 0 ? "%H:%M - %A %e." : _b;
    var time = (0, astal_1.Variable)("").poll(1000, function () {
        return astal_1.GLib.DateTime.new_now_local().format(format);
    });
    return <label className="Time" onDestroy={function () { return time.drop(); }} label={time()}/>;
}
function Bar(monitor) {
    var anchor = gtk3_1.Astal.WindowAnchor.TOP
        | gtk3_1.Astal.WindowAnchor.LEFT
        | gtk3_1.Astal.WindowAnchor.RIGHT;
    return <window className="Bar" gdkmonitor={monitor} exclusivity={gtk3_1.Astal.Exclusivity.EXCLUSIVE} anchor={anchor}>
         <centerbox>
             <box hexpand halign={gtk3_1.Gtk.Align.START}>
                 <Workspaces />
                 <FocusedClient />
             </box>
             <box>
                 <Media />
             </box>
             <box hexpand halign={gtk3_1.Gtk.Align.END}>
                 <SysTray />
                 <Wifi />
                 <AudioSlider />
                 <BatteryLevel />
                 <Time />
             </box>
         </centerbox>
     </window>;
}
