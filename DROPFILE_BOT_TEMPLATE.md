# Dropfile Bot Pattern - Documentation & Template

**Concept:** Dedicated Telegram bots for collecting thoughts/tasks asynchronously into dropfiles for Claude Code sessions.

**Primary Use Cases:**
- **Hot-List Bot** (DOOR/Potential phase - idea collection)
- **Session Logger Bot** (Entspannungs/Fitness/Fuel session logging)
- **Feedback Bot** (Client feedback, quick reflections)

---

## 🎯 Core Concept

Each dropfile bot:
1. **Listens passively** to Telegram messages
2. **Saves to daily file**: `~/[project]/[name]-YYYY-MM-DD.md`
3. **Aggregates daily** → `~/[project]/[NAME].md` (dropfile)
4. **Claude reads** when starting session in that directory
5. **Claude executes** and deletes completed items

---

## 📋 Template Structure

```
Project: ~/dev/[projectname]/
Bot Name: [descriptive-name]
Dropfile: ~/dev/[projectname]/[NAME].md
Daily File: ~/dev/[projectname]/[name]-YYYY-MM-DD.md
```

### Example: Hot-List Bot

```
Project: ~/AlphaOs-Vault/DOOR/
Bot Name: Hot-List Bot
Dropfile: ~/AlphaOs-Vault/DOOR/HOT-LIST.md
Daily File: ~/AlphaOs-Vault/DOOR/hot-list-YYYY-MM-DD.md
Purpose: Collect ideas for DOOR phase (Potential)
```

---

## 🤖 Creating a New Dropfile Bot

### Step 1: Create Bot Script

**File:** `~/dev/[projectname]/[name]-bot.py`

```python
#!/usr/bin/env python3
"""
[PROJECT] [NAME] Bot - Dropfile Pattern

Listens for Telegram messages → saves to daily file
Aggregates daily → generates dropfile for Claude Code sessions

Daily File: ~/dev/[projectname]/[name]-YYYY-MM-DD.md
Dropfile: ~/dev/[projectname]/[NAME].md
"""

import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from aiogram import Bot, Dispatcher
    from aiogram.types import Message
    import asyncio
except ImportError:
    print("⚠️ aiogram not installed. Install with: pip install aiogram")
    sys.exit(1)

# Configuration
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TODO_BOT_TOKEN") or os.getenv("BOT_TOKEN")
if not TELEGRAM_TOKEN:
    print("❌ Telegram bot token not set!")
    sys.exit(1)

PROJECT_DIR = Path.home() / "dev" / "[projectname]"  # ← UPDATE

bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()

def get_today_file():
    """Get today's message file path"""
    today = datetime.now().strftime("%Y-%m-%d")
    return PROJECT_DIR / f"[name]-{today}.md"  # ← UPDATE

def append_message(text: str) -> bool:
    """Append message to today's file with timestamp"""
    try:
        today_file = get_today_file()

        # Create file with header if it doesn't exist
        if not today_file.exists():
            header = f"# [NAME] - {datetime.now().strftime('%Y-%m-%d')}\n\n"
            today_file.write_text(header)

        # Append message with timestamp
        timestamp = datetime.now().strftime("%H:%M:%S")
        message_line = f"- [{timestamp}] {text}\n"

        with open(today_file, "a") as f:
            f.write(message_line)

        return True
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return False

@dp.message()
async def handle_any_message(message: Message):
    """Handle ANY incoming message"""
    if not message.text or message.text.startswith("/"):
        return

    text = message.text.strip()

    # Append to daily file
    if append_message(text):
        await message.answer(f"✓")
    else:
        await message.answer(f"❌")

async def main():
    """Start bot"""
    print("🤖 [PROJECT] [NAME] Bot starting...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
```

### Step 2: Create Aggregator Script

**File:** `~/dev/[projectname]/[name]-aggregator.py`

```python
#!/usr/bin/env python3
"""
Aggregate [NAME] daily file into dropfile

Reads: ~/dev/[projectname]/[name]-YYYY-MM-DD.md
Writes: ~/dev/[projectname]/[NAME].md (dropfile for Claude)

Called by: systemd timer
"""

import sys
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path.home() / "dev" / "[projectname]"  # ← UPDATE
DROPFILE = PROJECT_DIR / "[NAME].md"  # ← UPDATE

def aggregate():
    """Aggregate today's messages into dropfile"""
    today = datetime.now().strftime("%Y-%m-%d")
    today_file = PROJECT_DIR / f"[name]-{today}.md"  # ← UPDATE

    # Build dropfile
    lines = [
        "# [NAME]",
        "",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]

    # Read today's file if exists
    if today_file.exists():
        content = today_file.read_text()
        lines.append(content)
    else:
        lines.append("✅ Keine Einträge für heute")

    # Add footer
    lines.extend([
        "",
        "---",
        "",
        "📱 New entries? → Send message to Telegram bot",
    ])

    # Write dropfile
    DROPFILE.write_text("\n".join(lines))
    print(f"✓ {DROPFILE.name} generated")
    return True

if __name__ == "__main__":
    try:
        aggregate()
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
```

### Step 3: Create Systemd Service

**File:** `~/.config/systemd/user/[name]-bot.service`

```ini
[Unit]
Description=[PROJECT] [NAME] Bot - Dropfile Pattern
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /home/alpha/dev/[projectname]/[name]-bot.py
WorkingDirectory=/home/alpha/dev/[projectname]
StandardOutput=journal
StandardError=journal
Restart=on-failure
RestartSec=10
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONUNBUFFERED=1"
EnvironmentFile=%h/.env/telegram.env

[Install]
WantedBy=default.target
```

### Step 4: Create Systemd Timer

**File:** `~/.config/systemd/user/[name]-aggregator.service`

```ini
[Unit]
Description=[PROJECT] [NAME] Aggregator
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /home/alpha/dev/[projectname]/[name]-aggregator.py
WorkingDirectory=/home/alpha/dev/[projectname]
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=[name]-aggregator.timer
```

**File:** `~/.config/systemd/user/[name]-aggregator.timer`

```ini
[Unit]
Description=[PROJECT] [NAME] Aggregator Timer
Requires=[name]-aggregator.service

[Timer]
OnCalendar=12:00        # Run at noon
OnBootSec=2min          # Also run 2 min after boot
Persistent=true

[Install]
WantedBy=timers.target
```

### Step 5: Enable Services

```bash
# Reload systemd
systemctl --user daemon-reload

# Enable bot (runs automatically on boot)
systemctl --user enable [name]-bot.service
systemctl --user start [name]-bot.service

# Enable aggregator timer (runs at 12:00 + on boot)
systemctl --user enable [name]-aggregator.timer
systemctl --user start [name]-aggregator.timer

# Check status
systemctl --user status [name]-bot.service
systemctl --user list-timers [name]-aggregator.timer

# View logs
journalctl --user -u [name]-bot.service -f
journalctl --user -u [name]-aggregator.service -n 20
```

---

## 📝 Example: HOT-LIST Bot

### Setup
```bash
PROJECT=AlphaOs-Vault/DOOR
BOT_NAME=hot-list
DROPFILE_NAME=HOT-LIST
```

### Files Created
```
~/AlphaOs-Vault/DOOR/hot-list-bot.py          (bot)
~/AlphaOs-Vault/DOOR/hot-list-aggregator.py   (aggregator)
~/.config/systemd/user/hot-list-bot.service   (service)
~/.config/systemd/user/hot-list-aggregator.service
~/.config/systemd/user/hot-list-aggregator.timer
```

### Workflow
```
User sends Telegram: "Redesign FADARO homepage"
   ↓
hot-list-bot.py appends to: ~/AlphaOs-Vault/DOOR/hot-list-2026-03-13.md
   ↓
At 12:00 + on boot: hot-list-aggregator.py runs
   ↓
Generates: ~/AlphaOs-Vault/DOOR/HOT-LIST.md
   ↓
User starts Claude Code: clau (from DOOR directory)
   ↓
I read HOT-LIST.md
   ↓
I execute ideas, delete completed items
   ↓
Next session: fresh HOT-LIST.md ready
```

---

## 🎨 Usage Patterns by Domain

### DOOR Phase
- **Hot-List Bot** - Ideas for potential doors
- **War-Stack Bot** - Quick war stack reflections
- **Obstacle Bot** - Barriers discovered during work

### GAME Phase
- **Frame-Shift Bot** - Reality changes noticed
- **Freedom-Vision Bot** - Long-term goal clarifications
- **Fire-Plan Bot** - Weekly strike ideas

### VOICE Phase
- **Block-Report Bot** - Mental blocks to process
- **Narrative-Draft Bot** - Story rewrites in progress

### BUSINESS Domain
- **Client-Feedback Bot** - Direct client input
- **Feature-Ideas Bot** - Coaching platform features
- **Content-Ideas Bot** - Blog/Twitter content ideas

---

## ✅ Checklist for New Bot

- [ ] Create bot script (with your project path)
- [ ] Create aggregator script
- [ ] Create service file
- [ ] Create timer file
- [ ] Update all `[name]`, `[NAME]`, `[projectname]` placeholders
- [ ] Make scripts executable: `chmod +x *.py`
- [ ] Reload systemd: `systemctl --user daemon-reload`
- [ ] Enable and start services
- [ ] Test: send message to Telegram
- [ ] Check at 12:00: is dropfile generated?
- [ ] Document bot in project AGENTS.md

---

## 🔧 Common Customizations

### Change aggregation time
**File:** `.config/systemd/user/[name]-aggregator.timer`

```ini
OnCalendar=12:00        # Noon
OnCalendar=09:00        # 9 AM
OnCalendar=17:30        # 5:30 PM
OnCalendar=*-*-* 10:00  # Every day at 10:00
OnCalendar=Mon 08:00    # Every Monday at 8 AM
```

### Multiple aggregations per day
```ini
OnCalendar=09:00
OnCalendar=12:00
OnCalendar=18:00
```

### Change boot delay
```ini
OnBootSec=2min          # 2 minutes
OnBootSec=10s           # 10 seconds
OnBootSec=30min         # 30 minutes
```

---

## 🐛 Troubleshooting

### Bot not receiving messages?
```bash
# Check if running
systemctl --user status [name]-bot.service

# View logs
journalctl --user -u [name]-bot.service -f

# Manual test
python3 ~/dev/[projectname]/[name]-bot.py
```

### Dropfile not updating?
```bash
# Manual aggregation test
python3 ~/dev/[projectname]/[name]-aggregator.py
cat ~/dev/[projectname]/[NAME].md

# Check timer
systemctl --user list-timers [name]-aggregator.timer
```

### Check all dropfile timers
```bash
systemctl --user list-timers | grep aggregator
```

---

## 📊 Summary

| Component | Purpose | Schedule |
|-----------|---------|----------|
| `[name]-bot.py` | Listen & save messages | Always running |
| `[name]-YYYY-MM-DD.md` | Daily message storage | Generated by bot |
| `[name]-aggregator.py` | Aggregate daily → dropfile | Noon + on boot |
| `[NAME].md` | Dropfile for Claude | Updated at noon + boot |
| `[name]-bot.service` | Bot service | Always active |
| `[name]-aggregator.timer` | Aggregator schedule | 12:00 + 2min after boot |

---

## 🚀 Future Enhancements

- [ ] Multi-line message support
- [ ] Message tagging (priority, category)
- [ ] Automatic categorization in dropfile
- [ ] Slack/Discord bot alternatives
- [ ] Webhook instead of polling
- [ ] Message archival (keep daily files forever)
- [ ] Stats: messages/day, trends

---

**Pattern Status:** ✅ Proven & scalable
**Example Implementations:** TO-DO Bot (~/dev/), Hot-List Bot (~/AlphaOs-Vault/DOOR/)
**Suggested Aggregation:** Once per day (12:00) + on system boot
