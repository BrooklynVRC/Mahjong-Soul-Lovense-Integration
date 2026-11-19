# Mahjong Soul × Lovense

Makes a Lovense toy react to your Mahjong Soul games. It can also react to Twitch viewers through the separate [Mahjong Soul Twitch Integration](https://github.com/BrooklynVRC/Mahjong-Soul-Twitch-Integration) app.

> 🔞 For adults only. Use with consenting adults, and follow the rules of any platform you stream on. On Twitch, sexual content is not allowed, so keep the toy off-camera and out of the stream.

## Features

- **Game reactions** with a separate setting for each event: my riichi, opponent riichi, calls, my ron, my tsumo, yakuman, **dealing in**, opponent tsumo, tenpai/noten at a draw, my dealer round, and finishing 1st, 2nd, 3rd or 4th.
- **Action types**: constant strength, Lovense presets (pulse, wave, fireworks, earthquake), or custom patterns (`20;0;15;0`). You choose the function too (Vibrate, Rotate, Pump, Thrusting, and so on).
- **Twitch triggers** (optional): bits tiers, subs, resubs, gift subs (duration scales with the count), follows, raids, channel point redeems by title, and chat commands with cooldowns and a mods-only option.
- **Safety**: a big **STOP** button, a master switch, a strength cap, a maximum duration, a queue / replace / ignore mode when busy, and a mod `!stop` chat command. The toy is also stopped when the app closes.

The Twitch part is kept separate on purpose. **This app never logs in to Twitch.** It only listens to the Twitch app's local event feed (`ws://localhost:7701/events`). You can run it with no Twitch app at all.

## Quick start (no coding)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser. On Chrome/Edge, open the extension's details and turn on **Allow User Scripts**.
2. Download **MahjongSoul-Lovense.exe** from the [latest release](https://github.com/BrooklynVRC/Mahjong-Soul-Lovense-Integration/releases/latest) and double-click it.
   Windows may warn that the app isn't signed. Click **More info → Run anyway**.
3. The settings page opens in your browser. Click **Install userscript**. Skip this if you already installed it for the Twitch app.
4. In Lovense Remote, turn on **Game Mode**, copy its IP and port into *Lovense connection*, click **Save settings**, then click **Find toys**.
5. Optional: for Twitch viewer triggers, also run the Twitch app and turn on *Twitch triggers → Enabled*.
6. Keep the app's window open while you play. Closing it stops the toy.

Your settings are stored in `%APPDATA%\MahjongSoulLovense`. To update, download the new `.exe` and replace the old one; your settings are kept.

## Playing on the Steam / desktop client?

The userscript only works in the browser version. On the Steam client, run **MahjongSoul-ScreenReader.exe** (in the same release) instead. It watches the game picture like a screen share, still works when you tab out, and never touches the game. You teach it the banners once. See [screen-reader/README.md](screen-reader/README.md).

## How it works

```
Mahjong Soul (browser) ──userscript──▶ this app (localhost:7702) ──HTTP──▶ Lovense Remote / Connect (Game Mode)
mahjong-soul-twitch ──ws /events (optional)──┘
```

The userscript is the same read-only one used by the Twitch app. It never sends anything to the game server or automates play.

> ⚠️ Any client-side script is technically outside Yostar's terms of service. This one is passive and read-only, but use it at your own risk.

## Setup

1. **Start the app.** Either run the `.exe` from the latest release (see Quick start), or install Node.js 20+ and run it from source:
   ```powershell
   npm install
   npm start
   ```
   Open <http://localhost:7702>.
2. **Install the userscript once.** If you already installed it for the Twitch app, skip this step.
   Install [Tampermonkey](https://www.tampermonkey.net/), create a new script and paste in [`userscript/mahjong-soul-bridge.user.js`](userscript/mahjong-soul-bridge.user.js).
   On Chrome/Edge, turn on **Allow User Scripts** in the extension's details. If the browser asks about local network access, allow it.
3. **Lovense:** open **Lovense Remote**, connect your toy, and turn on **Game Mode**. Lovense Connect also works.
   Copy the **IP and port** it shows into *Lovense connection*.
   - For the HTTP port, leave *Use HTTPS* off.
   - For the HTTPS port, the host looks like `192-168-1-5.lovense.club`. Use that host and turn *Use HTTPS* on.
   - Click **Find toys** to check it works.
4. **Optional, Twitch:** run `mahjong-soul-twitch` and keep its *Forwarding* setting on. Here, turn on **Twitch triggers → Enabled** and save. The status card should show *Twitch app: connected*.

Use the **Test** buttons to try every event and viewer trigger without playing.

## Settings reference

| Setting | What it does |
|---|---|
| Master switch | Turns every reaction off (and stops the toy) without losing your setup |
| Max strength cap / Max seconds | Hard limits applied to every action, including Twitch ones |
| When busy | **Queue it** plays actions back to back; **Replace current** interrupts; **Ignore new** drops actions while one is playing |
| Toy ID | Target one toy; leave blank for all |
| Stop command | Chat command (broadcaster or mods) that stops the toy and clears the queue |

Settings are saved to `config.json` (git-ignored).

## Troubleshooting

- **Lovense errors / timeouts:** the PC and phone must be on the same network. Game Mode must be on, and the port must match the one in the app. Some routers block devices from reaching each other ("AP isolation").
- **No game events:** in the game tab's console run `localStorage.msbDebug = '1'`, then reload. The script logs each event.
- **Twitch app shows "disconnected":** make sure mahjong-soul-twitch is running and the URL/port match.

## Development

```powershell
npm run dev
npm run typecheck
npm test     # decoder + trigger mapping + safety clamp tests
npm run package    # build release/*.exe (standalone, no Node needed)
```

**Making a release:** bump `version` in package.json, commit, then push a tag such as `v1.0.1`. GitHub Actions builds the .exe and publishes the release automatically.

MIT licensed.
