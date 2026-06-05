# 158th FW ACMI Recorder

Electron desktop app for recording **all aircraft** (user + AI + multiplayer) in MSFS 2024 via SimConnect and saving the data as a Tacview-compatible **.acmi** file.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Windows 10/11 | SimConnect is Windows-only |
| MSFS 2020 or 2024 | Must be running before you connect |
| Node.js 20+ | https://nodejs.org |
| Tacview (optional) | To replay the recorded .acmi files |

---

## Setup (first time)

```powershell
# 1. Install dependencies
cd acmi-recorder
npm install

# 2. Rebuild node-simconnect for Electron's Node version
npx @electron/rebuild -f -w node-simconnect

# 3. Launch the app
npm start
```

> If `@electron/rebuild` fails, ensure you have Visual Studio Build Tools or the Windows SDK installed.  
> Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/

---

## Usage

1. **Launch MSFS 2024** and load into a flight (multiplayer session)
2. **Start the recorder** (`npm start`)
3. Click **Connect to MSFS** — the status dot turns green
4. Set a mission name and date in the left panel
5. Click **▶ Start Recording** — all aircraft within 200 km are captured at 2 Hz
6. The live table shows each aircraft's position, heading, IAS, and G-force in real time
7. Click **■ Stop Recording** — a save dialog appears
8. Save the **.acmi** file, then upload it to the [158th FW ACMI Room](https://158fw.vercel.app/acmi-room.html)

---

## How it works

```
MSFS 2024
  └─ SimConnect API
       └─ node-simconnect (native Node addon)
            └─ SimConnectBridge  (src/simconnect-bridge.js)
                 │  polls requestDataOnSimObjectType every 500 ms
                 │  returns all AIRCRAFT-type objects (user + AI + multiplayer)
                 └─ ACMIWriter    (src/acmi-writer.js)
                      │  builds Tacview ACMI 2.2 format
                      └─ .acmi file  →  upload to ACMI Room
```

### SimConnect variables recorded per aircraft

| Variable | Unit | ACMI field |
|---|---|---|
| PLANE LATITUDE | degrees | T= lat |
| PLANE LONGITUDE | degrees | T= lon |
| PLANE ALTITUDE | feet → metres | T= alt |
| PLANE HEADING DEGREES TRUE | degrees | T= yaw |
| PLANE PITCH DEGREES | degrees (inverted) | T= pitch |
| PLANE BANK DEGREES | degrees (inverted) | T= roll |
| AIRSPEED INDICATED | knots | IAS= |
| G FORCE | number | (in table only) |

---

## Multiplayer aircraft visibility

MSFS 2024 exposes multiplayer aircraft through the same SimConnect `SIMCONNECT_SIMOBJECT_TYPE_AIRCRAFT` enumeration used for AI traffic. Aircraft are visible up to the sim's render/LOD distance (typically 50–150 km at altitude). The recorder uses a 200 km radius query to capture everything MSFS is tracking.

---

## Future: Custom SimConnect recorder (Phase 2)

- Name resolution via `ATC ID` SimVar for multiplayer callsigns
- Higher recording rate (up to 10 Hz)
- Auto-upload to Supabase Storage on stop
- Weapon release events (SimConnect `WEAPON_FIRED` system event)
- Damage / kill events
