// TSUE dars eslatma boti — Cloudflare Worker.
//
// Sozlamalar (Worker > Settings > Variables and Secrets):
//   BOT_TOKEN      — @BotFather bergan token (Secret)
//   CHAT_ID        — xabar boradigan chat (guruh ID'si odatda -100... bilan boshlanadi)
//   SCHEDULE_URL   — GitHub'dagi jadval.json ning "raw" havolasi
//   WEBHOOK_SECRET — o'zingiz o'ylab topgan ixtiyoriy maxfiy so'z (Secret)
// Trigger: Cron "* * * * *" (har daqiqa)

const OFFSET_MS = 5 * 60 * 60 * 1000; // Toshkent = UTC+5
const REMIND_BEFORE_MIN = 10;
const KUNLAR = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export default {
  // Har daqiqada: 10 daqiqadan keyin boshlanadigan dars bormi?
  async scheduled(event, env, ctx) {
    const target = tashkent(event.scheduledTime + REMIND_BEFORE_MIN * 60 * 1000);
    const lessons = await lessonsOn(env, target);
    const hhmm = target.toISOString().slice(11, 16);
    for (const d of lessons.filter((d) => d.boshlanish === hhmm)) {
      await sendMessage(env, env.CHAT_ID, reminderText(d));
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    // Telegram webhook: /start, /bugun, /ertaga buyruqlari
    if (url.pathname === "/webhook" && request.method === "POST") {
      if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const update = await request.json();
      const msg = update.message;
      if (!msg || !msg.text) return new Response("ok");
      const cmd = msg.text.split(/[\s@]/)[0].toLowerCase();
      let text;
      if (cmd === "/start") {
        text = `Salom! Bu chat ID: ${msg.chat.id}\n\n/bugun — bugungi darslar\n/ertaga — ertangi darslar`;
      } else if (cmd === "/bugun" || cmd === "/ertaga") {
        const day = tashkent(Date.now() + (cmd === "/ertaga" ? 24 * 60 * 60 * 1000 : 0));
        text = dayText(day, await lessonsOn(env, day));
      } else {
        return new Response("ok");
      }
      // Javobni webhook javobining o'zida qaytaramiz — alohida so'rov shart emas
      return Response.json({ method: "sendMessage", chat_id: msg.chat.id, text });
    }

    // Sinov: /test?secret=... — CHAT_ID ga bugungi darslarni yuboradi
    if (url.pathname === "/test") {
      if (!env.WEBHOOK_SECRET || url.searchParams.get("secret") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const day = tashkent(Date.now());
      const res = await sendMessage(env, env.CHAT_ID, "🧪 Sinov xabari\n\n" + dayText(day, await lessonsOn(env, day)));
      return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Bot ishlayapti ✅");
  },
};

// Toshkent vaqtini UTC maydonlarida saqlaydigan Date (getUTC* = Toshkent soati)
function tashkent(ms) {
  const d = new Date(ms + OFFSET_MS);
  d.setUTCSeconds(0, 0);
  return d;
}

async function loadSchedule(env) {
  const res = await fetch(env.SCHEDULE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`Jadval yuklanmadi: ${res.status}`);
  return res.json();
}

// Berilgan kundagi darslar (o'sha sanada amal qiladigan jadval bo'yicha)
async function lessonsOn(env, day) {
  const schedule = await loadSchedule(env);
  const date = day.toISOString().slice(0, 10);
  const active = schedule.jadvallar.filter((j) => j.boshlanadi <= date).pop();
  if (!active) return [];
  const weekday = (day.getUTCDay() + 6) % 7; // 0 = Dushanba
  return active.darslar.filter((d) => d.kun === weekday);
}

function reminderText(d) {
  const lines = [
    `🔔 ${REMIND_BEFORE_MIN} daqiqadan keyin dars!`,
    ``,
    `📚 ${d.fan}`,
    `🚪 Xona: ${d.xona || "ko'rsatilmagan"}`,
    `🕐 ${d.boshlanish}–${d.tugash}`,
  ];
  if (d.oqituvchi) lines.push(`👤 ${d.oqituvchi}`);
  if (d.haftalar.includes("0")) lines.push(`⚠️ Bu dars har hafta emas — jadvalni tekshiring`);
  return lines.join("\n");
}

function dayText(day, lessons) {
  const title = `📅 ${KUNLAR[(day.getUTCDay() + 6) % 7]}, ${day.toISOString().slice(0, 10)}`;
  if (!lessons.length) return `${title}\n\nDars yo'q 🎉`;
  return title + "\n\n" + lessons
    .map((d) => `🕐 ${d.boshlanish}–${d.tugash}\n📚 ${d.fan}\n🚪 ${d.xona || "—"}`)
    .join("\n\n");
}

function sendMessage(env, chatId, text) {
  return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
