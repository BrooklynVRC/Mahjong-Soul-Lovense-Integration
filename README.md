# Mahjong Soul × Lovense

A Windows app that **reads your Mahjong Soul game from the screen** (Steam client) and makes a Lovense toy react. It can also react to Twitch viewers through the separate [Mahjong Soul Twitch Integration](https://github.com/BrooklynVRC/Mahjong-Soul-Twitch-Integration) app.

> 🔞 For adults only. Use with consenting adults, and follow the rules of any platform you stream on. On Twitch, sexual content is not allowed, so keep the toy off-camera and out of the stream.

## Features

- **Game reactions**, each with its own setting: my riichi, opponent riichi, calls, my ron or tsumo, yakuman, **dealing in**, opponent wins, draws, round and game start, game mode, **taking or losing the lead** (from the live scores), and finishing 1st–4th.
- **Action types**: constant strength, Lovense presets (pulse, wave, fireworks, earthquake), or custom patterns (`20;0;15;0`). You also choose the function: Vibrate, Rotate, Pump, Thrusting and so on.
- **Twitch triggers** (optional): bits tiers, subs, resubs, gift subs (duration grows with the count), follows, raids, channel point redeems by title, and chat commands with cooldowns and a mods-only option.
- **Safety**: a big **STOP** button, a master switch, a strength cap, a maximum duration, and a choice of queue, replace or ignore when busy. Mods can type `!stop` in chat. **Closing the window stops the toy.**

This app **never logs in to Twitch**. It only listens to the Twitch app's local event feed, and you can run it without the Twitch app at all.

## Read-only: it never touches the game

The screen reader gets the game's picture the same way **OBS Window Capture and Discord screen share** do, through Windows Graphics Capture. It never opens the game's process, injects code, changes files or sends the game input. It works while the game is behind other windows or you've tabbed out, but **not while it's minimized**, so use windowed or borderless mode.

## Quick start

1. Download **MahjongSoul-Lovense.exe** from the [latest release](https://github.com/BrooklynVRC/Mahjong-Soul-Lovense-Integration/releases/latest) and double-click it. It opens in its own window; there's nothing else to install.
   Windows may warn that the app isn't signed. Click **More info → Run anyway**.
2. **Lovense**: in Lovense Remote, connect your toy and turn on **Game Mode**. Lovense Connect also works.
   - Copy the IP and port it shows into *Lovense connection* and save, then click **Find toys**.
   - For an HTTPS port, the host looks like `192-168-1-5.lovense.club`; turn *Use HTTPS* on.
3. **Screen reader**: start Mahjong Soul, open **Screen reader & calibration** and teach it the banners and score boxes. The [Twitch app's README](https://github.com/BrooklynVRC/Mahjong-Soul-Twitch-Integration#calibrating-the-screen-reader) has the full guide. Templates are shared between the two apps, so if you calibrated in the Twitch app, you're already done.
4. **Twitch triggers** (optional): run the Twitch app with *Forwarding* on, then turn on **Twitch triggers → Enabled** here.

Use the **Test** buttons to try every event and viewer trigger without playing.

## Settings reference

| Setting | What it does |
|---|---|
| Master switch | Turns every reaction off (and stops the toy) without losing your setup |
| Max strength cap / Max seconds | Hard limits on every action, including Twitch ones |
| When busy | **Queue it** plays actions back to back; **Replace current** interrupts; **Ignore new** drops actions while one plays |
| Toy ID | Target one toy; blank = all |
| Stop command | Chat command (broadcaster or mods) that stops the toy and clears the queue |

Settings are in `%APPDATA%\MahjongSoulLovense`. Screen templates are in `%APPDATA%\MahjongSoulScreenReader`, shared with the Twitch app.

## Troubleshooting

- **Lovense errors or timeouts**:
  - The PC and phone must be on the same network.
  - Game Mode must be on, and the port must match the one shown in Lovense Remote.
  - Some routers block devices from talking to each other ("AP isolation").
- **No game events**: open the screen reader page. The checklist and hint there tell you what's missing, for example the game is minimized or there are no templates yet.

## Building from source

Needs Node 22+ and the .NET 8 SDK.

```powershell
npm install
npm run build:host
npm start
npm test
npm run package      # release\MahjongSoul-Lovense.exe
```

MIT licensed. Not affiliated with Yostar, Mahjong Soul or Lovense.
