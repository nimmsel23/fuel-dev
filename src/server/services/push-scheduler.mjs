import fs from "fs";
import path from "path";
import webpush from "web-push";
import { format } from "date-fns";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BOafCxLae9KCsYm5j6NJv0csS_Qmvtef8XWszQBootQiX6Cpvkih3fL3P71dXP_2T05CMSXO3bwGxLNZN_SbF_w";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "zD3-SRxK2iGrs8XVEavlgkgQn9X9XtrXVef7ams3VXI";

webpush.setVapidDetails(
  "mailto:example@yourdomain.org",
  PUBLIC_KEY,
  PRIVATE_KEY
);

// Einfache Due-Check Logik (ähnlich Frontend)
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isDueToday(item, dateString) {
  if (!item.schedule) return false;
  if (item.schedule.type === "daily") return true;
  
  const dateObj = new Date(dateString);
  if (item.schedule.type === "weekly") {
    const dayName = WEEKDAYS[dateObj.getDay()];
    return item.schedule.days?.includes(dayName);
  }
  
  if (item.schedule.type === "cyclical") {
    if (!item.schedule.start_date || !item.schedule.interval_days) return false;
    const start = new Date(item.schedule.start_date);
    const diffTime = Math.abs(dateObj - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % item.schedule.interval_days === 0;
  }
  return false;
}

export function startPushScheduler(baseDataDir, catalogsDir) {
  // Der Scheduler prüft jede Minute, ob es "Reminder-Zeit" ist.
  // Morning = 08:00, Evening = 19:00, Night = 21:00
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Nur zur vollen Minute triggern
    if (minutes !== 0) return;

    let timeOfDayToCheck = null;
    if (hours === 8) timeOfDayToCheck = "morning";
    else if (hours === 13) timeOfDayToCheck = "midday";
    else if (hours === 19) timeOfDayToCheck = "evening";
    else if (hours === 21) timeOfDayToCheck = "night";

    if (timeOfDayToCheck) {
      console.log(`[PushScheduler] Running check for ${timeOfDayToCheck}...`);
      checkAndSendReminders(timeOfDayToCheck, baseDataDir, catalogsDir);
    }
  }, 60000); // alle 60 Sekunden prüfen
}

async function checkAndSendReminders(timeOfDay, baseDataDir, catalogsDir) {
  try {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const catalogPath = path.join(catalogsDir, "supplements", "catalog.json");
    const logsPath = path.join(baseDataDir, "supplements", "logs", `${todayStr}.json`);
    const subsPath = path.join(baseDataDir, "push-subscriptions.json");

    if (!fs.existsSync(catalogPath) || !fs.existsSync(subsPath)) return;

    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8")).items || [];
    const subscriptions = JSON.parse(fs.readFileSync(subsPath, "utf-8")) || [];

    let intakes = [];
    if (fs.existsSync(logsPath)) {
      intakes = JSON.parse(fs.readFileSync(logsPath, "utf-8")).intakes || [];
    }

    // Fällige Supplements für diese Tageszeit finden, die noch nicht geloggt wurden
    const dueItems = catalog.filter(item => {
      const isDue = isDueToday(item, todayStr) && item.default_time_of_day === timeOfDay;
      if (!isDue) return false;
      const isLogged = intakes.some(intake => intake.supplement_id === item.id);
      return !isLogged;
    });

    if (dueItems.length > 0) {
      const names = dueItems.map(i => i.name).join(", ");
      const payload = JSON.stringify({
        title: `Time for your ${timeOfDay} Supplements!`,
        body: `You still need to take: ${names}`,
        icon: "/favicon-192x192.png",
        url: "/supplements"
      });

      console.log(`[PushScheduler] Sending reminders for: ${names}`);

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error("[PushScheduler] Send failed (maybe unsubscribed):", err.statusCode);
        }
      }
    } else {
      console.log(`[PushScheduler] All good. No missing supplements for ${timeOfDay}.`);
    }
  } catch (error) {
    console.error("[PushScheduler] Error checking reminders:", error);
  }
}
