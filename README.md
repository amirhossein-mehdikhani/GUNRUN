# 🔫 RUNGUN - 3D Multiplayer First-Person Shooter (LAN)

Release automation: [build and publish guide](RELEASING.md). Development findings: [game improvement and optimization review](GAME_REVIEW.md).

Implemented reliability work: [server-side shooting, cleanup, asset serving, spatial queries and reconnection](QUALITY_IMPROVEMENTS.md). Refresh all players' browser tabs after upgrading so the client and server protocols match.

Choose exactly two different firearms in the main menu before hosting or joining. Keys **1** and **2** equip your chosen guns; **3** equips the knife. The mouse wheel cycles only these three items. Loadouts persist through respawns and reconnects and cannot be changed during a match.

The arsenal now includes Assault Rifle, DMR, Heavy Sniper, Vector SMG, Slug Shotgun (single powerful projectile), Tactical Pistol and Support LMG. New cosmetic operators are Pathfinder, Sentinel and Desert Ranger; all operators share the same gameplay stats and hitbox sizes.

The new operators and guns now use locally bundled GLB models. See [asset sources, licenses and preview generation](ASSET_CREDITS.md). Operator cards use full-body renders of the actual models.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)](#)
[![Stack](https://img.shields.io/badge/Tech%20Stack-Node.js%20%7C%20Socket.io%20%7C%20Three.js-orange.svg)](#)
[![LAN Ready](https://img.shields.io/badge/LAN%20Play-100%25%20Offline-success.svg)](#)

---

## 🌐 Quick Language Navigation / ناوبری زبان
- [English Documentation](#-english-guide)
- [راهنمای جامع فارسی (Persian Guide)](#-راهنمای-جامع-فارسی)

---

# 🇬🇧 English Guide

**RUNGUN** is a fast-paced, competitive 3D Multiplayer First-Person Shooter designed specifically for **Local Area Network (LAN) and shared Wi-Fi**. Built with pure Vanilla JavaScript (ES Modules), Three.js, and Node.js with Socket.io, it operates **100% offline without requiring internet access, external CDNs, bundlers, or HTTPS certificates**.

Any player can host a match with a single click, and friends on the same Wi-Fi can join instantly through their web browsers.

---

## ✨ Key Features

- **Multi-Map Selection (5 Distinct Authentic 3D Arenas)**:
  - 🏆 **Dust II (`dust2`)**: *Authentic 1:1 Counter-Strike de_dust2 Map* featuring Bombsite A, Long, Goose, Pit, CT Spawn, and Catwalk with realistic textures, full human-scale dimensions, and zero floating.
  - 🏭 **Stalkyard (`stalkyard`)**: *Classic Half-Life Multiplayer Map* with industrial indoor corridors, hazardous machinery rooms, elevated catwalks, and tight CQB combat zones.
  - ⚡ **DM-Turbine (`turbine`)**: *Legendary Unreal Tournament Arena* featuring high-tech industrial architecture, central turbine chamber, multi-level combat walkways, and sniper perches.
  - 🔥 **Frenzy (`frenzy`)**: *High-Octane Half-Life Crossfire Arena* featuring central courtyard, fortress bunkers, subterranean passages, and rooftop vantage points.
  - 🏛️ **cs_italy (`italy`)**: *Iconic Counter-Strike Italy Map* featuring the famous marketplace, narrow cobblestone alleys, wine cellar, archways, and hostage apartments in full 3D.
- **Character Selection (7 Playable Operators)**:
  - 🪖 **Tactical Soldier**: Camouflage military combatant.
  - 🤖 **Cyber Robot**: High-tech articulated mech with expressive animations.
  - 🦾 **Spec-Ops Cyborg (Xbot)**: Agile android operative.
  - 🛡️ **Titan Heavy Mech**: Heavy armored procedural exoskeleton with reinforced plates.
- **Comprehensive Tactical Loadout**:
  - `[1]` **Assault Rifle**: Full-auto automatic fire (100ms cycle), 30 rounds, rapid spray.
  - `[2]` **Semi-Auto DMR**: High-precision marksman rifle, 12 rounds, high per-shot damage.
  - `[3]` **Heavy Sniper Rifle**: High-caliber bolt-action rifle with **Right-Click Mil-Dot Scope Zoom** (`20° FOV`). Instant lethal headshots!
  - `[4]` **Combat Knife**: Fast slashing melee weapon with **+15% movement speed boost** and devastating backstab damage.
- **Tactical Throwables (Physics-based Parabolic Arc & Surface Bouncing)**:
  - `[G]` **Frag Grenade**: 2.5s fuse, camera screen shake, explosive shockwave particle effect, and server-side AoE damage.
  - `[F]` **Flashbang**: 2.0s fuse, full-screen optical whiteout blindness with high-frequency tinnitus ringing.
- **In-Game Pause & Match Control (ESC)**:
  - Press `ESC` during a match to access the in-game menu: **Resume**, **Rematch (Restart Round)**, **Finish Match (Show MVP & Scoreboard)**, and **Leave Room**.
- **100% Offline & No Installation Required**:
  - Available as **standalone standalone executable binaries** for Windows, macOS, and Linux. No Node.js or npm needed to run the server!
  - Three.js is served locally from `/node_modules/three/` via HTML `<script type="importmap">`.

---

## 🎮 Game Controls Reference

| Key / Input | Action | Description |
| :--- | :--- | :--- |
| **`W` `A` `S` `D`** | **Movement** | Walk forward, strafe left, backward, strafe right |
| **`Mouse Move`** | **Aim Camera** | First-person mouse look (Pointer Lock) |
| **`Shift`** | **Sprint** | Sprint forward at increased speed |
| **`Space`** | **Jump** | Jump over obstacles (and boost on jump pads) |
| **`Left-Click`** | **Primary Fire** | Shoot weapon (Auto-fire for Rifle, Slash for Knife) |
| **`Right-Click`** | **Sniper Scope** | Toggle high-magnification optical scope zoom (Sniper only) |
| **`R`** | **Reload** | Manually reload current weapon magazine |
| **`1`** | **Gun 1** | Equip your first selected firearm |
| **`2`** | **Gun 2** | Equip your second selected firearm |
| **`3`** | **Combat Knife** | Equip your knife |

| **`Mouse Wheel`** | **Cycle Weapons** | Scroll up/down to cycle your two selected guns and knife |
| **`G`** | **Frag Grenade** | Throw explosive fragmentation grenade (2 available) |
| **`B`** | **Molotov** | Throw a fire bottle (2 per life); burns a 3.2m area for 6 seconds |
| **`F`** | **Flashbang** | Throw tactical flashbang grenade (2 available) |
| **`Tab`** (Hold) | **Scoreboard** | View real-time player rankings, Kills, Deaths, and Ping |
| **`ESC`** | **Pause Menu** | Unlock mouse and open In-Game Menu (Resume / Rematch / Leave) |

---

## 🚀 How to Play on LAN / Shared Wi-Fi

### Method 1: Using Standalone Executables (No Node.js Needed!)

1. **Host Starts Server**:
   - **Windows**: Double-click `dist/fps-lan-server-win.exe` (or run `start-windows.bat`).
   - **macOS**: Double-click `dist/fps-lan-server-macos` (or run `./start-mac.command`).
   - **Linux / Ubuntu**: Run `./dist/fps-lan-server-linux` (or `./start-ubuntu.sh`).
2. The server terminal opens, displays the local and LAN IP address, and automatically launches your browser at `http://localhost:3000`.
3. **Friends on the Same Wi-Fi Connect**:
   - Tell your friends to open their web browser (Chrome, Firefox, Edge, Safari, Brave) and navigate to the LAN URL shown in the host's terminal, e.g.:
     ```
     http://192.168.1.101:3000
     ```
4. Pick your nickname, select your 3D character, create or join a room, and start fragging!

---

### Method 2: Running from Source with Node.js

```bash
# 1. Install dependencies
npm install

# 2. Download free 3D GLB character models (optional, fallback models are built-in)
npm run download-assets

# 3. Start the server
npm start
```

---

## 🛡️ Firewall Troubleshooting (Port 3000)

If your friends cannot load the game URL on their devices, your host machine's firewall may be blocking inbound traffic on port `3000`. Here is how to allow it:

### 🪟 Windows Defender Firewall
1. Open **PowerShell as Administrator** and run:
   ```powershell
   New-NetFirewallRule -DisplayName "RUNGUN LAN Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
2. Or open **Control Panel → Windows Defender Firewall → Allow an app or feature** and check both **Private** and **Public** for Node.js / `fps-lan-server-win.exe`.

### 🍎 macOS
1. Open **System Settings → Network → Firewall → Options**.
2. Add your terminal or the executable to the allowed incoming connections list.
3. If using `pf` firewall, add the following rule to `/etc/pf.conf`:
   ```bash
   pass in proto tcp to any port 3000
   ```

### 🐧 Ubuntu / Linux
If using `ufw` (Uncomplicated Firewall), run:
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```
If using `iptables`:
```bash
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

---
---

# 🇮🇷 راهنمای جامع فارسی

بازی **RUNGUN** یک بازی شوتر اول شخص (FPS) سه‌بعدی و مالتی‌پلیر آنلاین است که منحصراً برای **شبکه محلی (LAN) و وای‌فای مشترک (Wi-Fi)** توسعه یافته است. این بازی بدون نیاز به اینترنت، بدون نیاز به نصب هیچ‌گونه ابزار جانبی و کاملاً آفلاین کار می‌کند.

تمام کلاینت‌ها تنها با باز کردن یک مرورگر ساده (کروم، فایرفاکس، اج، بریو و...) روی کامپیوتر یا لپ‌تاپ خود می‌توانند به سرور محلی متصل شده و به بازی بپردازند!

---

## ✨ ویژگی‌های برجسته بازی

- **۵ نقشه مبارزاتی سه‌بعدی و نوستالژیک (انتخاب توسط میزبان / Host)**:
  - 🏆 **داست ۲ (Dust II - de_dust2)**: *نقشه محبوب و اسطوره‌ای کانتر استرایک* شامل بمب‌سایت A، راهروی لانگ (Long)، پیت (Pit)، اسپان سی‌تی (CT Spawn) و کت‌واک (Catwalk) با مقیاس کاملاً واقعی ۱:۱، بافت‌های باکیفیت و بدون هیچ‌گونه پرواز یا معلق ماندن در هوا.
  - 🏭 **استالک‌یارد (Stalkyard - Half-Life)**: *نقشه کلاسیک و هیجان‌انگیز هاف‌لایف* با سالن‌های صنعتی، راهروهای فلزی، طبقات فوقانی و درگیری‌های فشرده نفس‌گیر.
  - ⚡ **توربین (DM-Turbine - Unreal Tournament)**: *آرنای پرطرفدار آنریل تورنومنت* با معماری صنعتی پیشرفته، محفظه توربین‌های عظیم و مسیرهای چندسطحی.
  - 🔥 **فرنزی (Frenzy - Half-Life)**: *میدان نبرد پرحرارت و سریع هاف‌لایف* با حیاط مرکزی، پناهگاه‌های زیرزمینی و پشت‌بام‌های مشرف به میدان نبرد.
  - 🏛️ **ایتالیا (cs_italy - Counter-Strike)**: *نقشه خاطره‌انگیز ایتالیا در کانتر استرایک* با بازار میوه و ترره‌بار معروف، کوچه‌های سنگ‌فرش، انبار شراب، طاق‌نماها و خانه گروگان‌ها.
- **انتخاب شخصیت (۴ کاراکتر ۳ بعدی با انیمیشن کامل)**:
  - 🪖 **سرباز تاکتیکال (Soldier)**: کاراکتر نظامی با استتار جنگی.
  - 🤖 **ربات سایبری (Cyber Robot)**: مکانیکال هوشمند با انیمیشن‌های رباتیک.
  - 🦾 **اندروید کماندو (Cyborg / Xbot)**: کاراکتر چابک با پوشش تیره.
  - 🛡️ **مِک زره‌پوش سنگین (Titan Mech)**: زره تقویت‌شده رباتیک با شیلدهای محافظ.
- **سیستم تسلیحات و لودات کامل**:
  - کلید `[1]` **تفنگ رگبار (Assault Rifle)**: شلیک خودکار و ممتد با نگه‌داشتن کلیک چپ، خشاب ۳۰ تیری، آسیب ۱۸ برای بدن و ۳۶ برای هدشات.
  - کلید `[2]` **تک‌تیرانداز سبک (Semi-Auto DMR)**: دقت بالا، خشاب ۱۲ تایی، آسیب ۳۵ برای بدن و ۷۰ برای هدشات.
  - کلید `[3]` **اسنایپر سنگین (Heavy Sniper)**: شلیک قدرتمند گلوله‌های کالیبر بالا همراه با **دوربین زوم اسکوپ مجهز به خطوط هدف‌گیری میل‌دات (با راست‌کلیک)** و زاویه دید ۲۰ درجه! هدشات مرگبار ۱۹۰.
  - کلید `[4]` **چاقوی نظامی تاکتیکال (Combat Knife)**: انیمیشن سریع ضربه با چاقو، **افزایش ۱۵ درصدی سرعت دویدن بازیکن** هنگام دست گرفتن چاقو و قابلیت ضربه مرگبار از پشت (Backstab).
- **پرتابه‌های تاکتیکال (نارنجک‌های دارای فیزیک پرتاب قوسی و بازگشت از موانع)**:
  - کلید `[G]` **نارنجک انفجاری (Frag Grenade)**: دارای تایمر فیوز ۲.۵ ثانیه‌ای، افکت انفجار سه‌بعدی آتشین، لرزش صفحه و محاسبه آسیب محیطی (AoE) در سرور تا ۱۰۰ واحد.
  - کلید `[F]` **بمب نوری (Flashbang)**: تایمر ۲.۰ ثانیه‌ای، ایجاد کوری کامل با سفید شدن تمام صفحه (Whiteout) همراه با صدای سوت گوش‌خراش واقعی که طی ۳.۵ ثانیه به مرور محو می‌شود.
- **منوی توقف (Pause) و مدیریت مسابقه با کلید ESC**:
  - دسترسی به دکمه‌های **ادامه بازی (Resume)**، **شروع مجدد دست (Rematch)**، **پایان مسابقه و جدول MVP** و **خروج از اتاق (Leave Room)**.
- **فایل‌های اجرایی مستقل برای تمام سیستم‌عامل‌ها**:
  - بدون نیاز به نصب Node.js، تنها با دو بار کلیک روی فایل اجرایی مربوط به ویندوز، مک یا لینوکس سرور اجرا می‌شود.

---

## 🎮 جدول راهنمای کلیدها و کنترل‌های بازی

| کلید / دکمه | عملکرد | توضیح |
| :--- | :--- | :--- |
| **`W` `A` `S` `D`** | **حرکت کاراکتر** | حرکت به جلو، عقب، چپ و راست |
| **`حرکت ماوس`** | **دید اول شخص** | چرخش زاویه دید و دوربین (Pointer Lock) |
| **`Shift`** | **دویدن سریع (Sprint)** | دویدن با سرعت بیشتر به سمت جلو |
| **`Space`** | **پرش (Jump)** | پریدن از موانع و استفاده از سکوهای پرش ایستگاه فضایی |
| **`کلیک چپ`** | **شلیک / حمله** | شلیک با اسلحه (رگبار مداوم برای مسلسل / ضربه با چاقو) |
| **`راست کلیک`** | **زوم اسکوپ اسنایپر** | فعال‌سازی دوربین دوربرد و زوم عدسی تک‌تیرانداز |
| **`R`** | **تعویض خشاب (Reload)** | بارگذاری مجدد مهمات اسلحه فعلی |
| **`1`** | **مسلسل رگبار** | انتخاب اسلحه اول (Assault Rifle) |
| **`2`** | **تفنگ تک‌تیر** | انتخاب اسلحه دوم (Semi-Auto DMR) |
| **`3`** | **اسنایپر** | انتخاب تفنگ اسنایپر سنگین (Sniper Rifle) |
| **`4`** | **چاقوی نظامی** | انتخاب چاقو (افزایش ۱۵٪ سرعت حرکت) |
| **`اسکرول ماوس`** | **تعویض اسلحه** | چرخاندن چرخ ماوس به بالا و پایین جهت جابجایی سلاح‌ها |
| **`G`** | **نارنجک انفجاری** | پرتاب نارنجک دستی ترکش‌دار (Frag Grenade) |
| **`F`** | **بمب نوری** | پرتاب بمب کورکننده فلش‌بنگ (Flashbang) |
| **`Tab`** (نگه‌داشتن) | **جدول امتیازات** | نمایش رده‌بندی زنده، تعداد کیل‌ها، مرگ‌ها و پینگ بازیکنان |
| **`ESC`** | **منوی توقف** | آزادسازی ماوس و باز شدن منوی تنظیمات و ریمچ |

---

## 📡 راهنمای گام‌به‌گام اجرای بازی روی شبکه LAN یا Wi-Fi مشترک

### روش اول: استفاده از فایل‌های اجرایی آماده (بدون نیاز به نصب Node.js)

1. **میزبان (Host) سرور را اجرا می‌کند**:
   - **در ویندوز**: روی فایل `dist/fps-lan-server-win.exe` (یا اسکریپت `start-windows.bat`) دو بار کلیک کنید.
   - **در مک (macOS)**: فایل `dist/fps-lan-server-macos` (یا `./start-mac.command`) را اجرا نمایید.
   - **در اوبونتو / لینوکس**: دستور `./dist/fps-lan-server-linux` (یا `./start-ubuntu.sh`) را اجرا کنید.
2. پنجره ترمینال باز شده و آدرس شبکه محلی (LAN IP) شما را نمایش می‌دهد، همچنین مرورگر شما به صورت خودکار به نشانی `http://localhost:3000` هدایت می‌شود.
3. **اتصال دوستان از طریق وای‌فای**:
   - به دوستان خود که به همان مودم یا وای‌فای متصل هستند بگویید مرورگر خود را باز کنند و آدرس نمایش‌داده‌شده در ترمینال سرور را وارد کنند (مثال: `http://192.168.1.101:3000`).
4. نام دلخواه و کاراکتر مورد نظر خود را برگزینید، اتاق جدید بسازید یا وارد اتاق موجود شوید و از نبردی هیجان‌انگیز لذت ببرید!

---

### روش دوم: اجرا از طریق سورس‌کد با Node.js

```bash
# ۱. نصب پیش‌نیازها
npm install

# ۲. اجرای سرور
npm start
```

---

## 🛡️ رفع خطای فایروال (باز کردن پورت ۳۰۰۰)

در صورتی که دوستان شما نمی‌توانند وارد صفحه بازی شوند، فایروال سیستم شما ممکن است پورت ۳۰۰۰ را مسدود کرده باشد. با دستورات زیر آن را باز کنید:

### 🪟 فایروال ویندوز (PowerShell به صورت Run as Administrator):
```powershell
New-NetFirewallRule -DisplayName "RUNGUN LAN Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 🍎 سیستم‌عامل مک (macOS):
به مسیر **System Settings → Network → Firewall** رفته و اجازه دسترسی به پورت یا ترمینال را صادر نمایید.

### 🐧 سیستم‌عامل اوبونتو / لینوکس (Terminal):
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

---

## 🛠️ ساختار فنی و توسعه‌دهندگان (Tech Stack)
- **موتور رندرینگ و سه‌بعدی**: Three.js (مستقر به صورت محلی در مسیر `/node_modules/three/` بدون نیاز به وب‌پک یا باندلر).
- **سمت سرور و شبکه**: Node.js, Express, Socket.io (همگام‌سازی بلادرنگ موقعیت، تیراندازی، انیمیشن‌ها و لابی).
- **صداگذاری و افکت‌های صوتی**: Web Audio API (تولید و ترکیب تمامی افکت‌های صوتی شلیک، انفجار، سوتی گوش و برخورد به صورت کدنویسی‌شده و بدون نیاز به دانلود فایل‌های صوتی حجیم).

---
**توسعه‌یافته با افتخار برای علاقه‌مندان به بازی‌های شوتر اول شخص و شبکه‌ای آفلاین.** 🎯🔥

## Operator abilities and Killhouse

Press **Q** to use the selected operator ability. Pathfinder marks enemy positions within 18m for 3 seconds (25s cooldown); Sentinel reduces damage 25% for 5 seconds (22s cooldown); Desert Ranger heals up to 30 health (25s cooldown); Titan reduces damage 40% for 3 seconds (30s cooldown). The server owns cooldowns, healing and damage reduction. Respawning clears active armor and preserves cooldowns. All operators keep the same movement speed and hit volumes.

Killhouse is an original lightweight recreation inspired by the training warehouse layout, not an extracted COD Mobile asset or a claimed exact replica. It includes a central observation tower, stairs, raised bases, containers, plywood cover and side lanes. Rendered and server collision geometry come from the same factory; it uses 1,356 triangles and 8 material batches with no downloaded textures. Download candidates were checked first: the Sketchfab model was not downloadable and its download endpoint returned 401; no direct model archive was exposed by the CGTrader page.

Camera stair/crouch changes and small server corrections now ease the rendered eye while applying physical collision changes immediately. Physics uses steps of at most 1/60s to reduce low-FPS collision jumps. Large teleports and respawns reset camera easing. Hover the FPS counter for server/step/recovery correction counts when diagnosing a remaining jump.

### Local downloaded Killhouse model

The local installation now prefers the downloaded Blenderworks FBX map. Run `npm run import:killhouse -- path/to/killhouse.fbx` to regenerate its optimized GLB, collision proxy and spawn metadata. The source has 735,086 triangles; the game render has 86,863 triangles in six material batches, and collision uses a separate 8,776-triangle proxy. Dense decorative props use coarse collision hulls while structural walls keep their mesh shape.

The licensed FBX, converted GLB, imported collision and metadata are ignored by Git. The source checkout and CI fall back to the code-built arena when these local files are absent. Do not upload the standalone model files without redistribution permission. See [CGTrader's license](https://help.cgtrader.com/hc/en-us/articles/360015124437-Royalty-Free-License).

Mouse look now requests unadjusted pointer input when supported, rejects non-finite/extreme warp packets and guards capture transitions. Normal fast turns and yaw wrap stay responsive. The FPS tooltip includes a mouse-spike rejection count. Buffered jump input is cleared on focus loss, pause, death and respawn; airborne floor queries cannot snap the player upward onto a surface they have not crossed.

Ability feedback includes armor shells, healing particles, recon rings and local screen indicators, with reduced particle counts on Low and a reduced-motion CSS fallback.

### Play on Android and iOS

Open the LAN URL shown in RUNGUN on a phone or tablet connected to the host's Wi-Fi.
Use Chrome on Android or Safari on iOS. You can join the same rooms as desktop
players or host a solo Zombies match. Landscape gives the controls more space.

Drag the left stick to move and drag the open play area to aim. Hold Fire for
automatic weapons. The other buttons let you jump, crouch, switch weapons, reload,
scope, use abilities, throw equipment, or pause.
