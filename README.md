# TSUE dars eslatma boti (MNP-75/23)

Har bir dars boshlanishidan **10 daqiqa oldin** Telegram'ga fan, xona raqami va vaqtni yuboradi.
Kompyuter yoqiq turishi shart emas, hammasi bepul.

## Qanday ishlaydi

```
GitHub Actions (har kuni 01:00)                 Cloudflare Worker (har daqiqa)
  edupage'dan 8 MB jadvalni oladi      ──►        jadval.json ni o'qiydi
  → faqat bizning guruhni ajratadi                10 daqiqadan keyin dars bormi?
  → jadval.json (2 KB) ga yozadi                  → bor bo'lsa Telegram'ga yuboradi
```

Ish ikki qismga bo'lingan, chunki bepul Cloudflare tarifida bitta ishga tushirishga atigi 10 ms CPU vaqti beriladi.
Bu vaqt edupage'ning 8 MB javobini o'qishga yetmaydi. Shuning uchun og'ir ishni GitHub qiladi, Worker esa faqat kichik faylni o'qiydi.

| Fayl | Nima qiladi |
|---|---|
| `worker.js` | Cloudflare'dagi bot |
| `scripts/update_schedule.py` | Edupage'dan jadvalni oladi |
| `.github/workflows/update.yml` | Skriptni har kuni ishga tushiradi |
| `jadval.json` | Tayyor jadval (hozirgisi allaqachon to'ldirilgan) |

---

## 1-qadam. Bot yaratish
1. Telegramda **@BotFather** ga `/newbot` deb yozing, botga nom bering.
2. U bergan **tokenni** saqlab qo'ying.
3. Botni guruhingizga qo'shing.

## 2-qadam. GitHub
1. github.com da akkaunt oching va **New repository** tugmasini bosing. Nomi `tsue-bot`, turi **Public** bo'lsin.
2. **Add file → Upload files** orqali `worker.js`, `jadval.json`, `README.md` va `scripts` papkasini yuklang.
3. `.github` papkasi nuqta bilan boshlangani uchun yuklanmasligi mumkin. Unda **Add file → Create new file** ni bosing,
   nomiga `.github/workflows/update.yml` deb yozing va fayl ichidagi matnni nusxalab qo'ying.
4. **Actions** bo'limiga kiring → **Jadvalni yangilash** → **Run workflow**. Ish yashil ✅ bilan tugashi kerak.
   - Agar `push` bosqichida xato chiqsa: **Settings → Actions → General → Workflow permissions** dan
     **Read and write permissions** ni tanlang.
5. `jadval.json` faylini oching → **Raw** tugmasini bosing va manzilni nusxalang. U shunday ko'rinishda bo'ladi:
   `https://raw.githubusercontent.com/<username>/tsue-bot/main/jadval.json`

## 3-qadam. Cloudflare Worker
1. dash.cloudflare.com da akkaunt oching.
2. **Workers & Pages → Create → Create Worker** ni tanlang, nom bering (masalan `tsue-bot`) va **Deploy** ni bosing.
3. **Edit code** ni bosing, eski kodni o'chirib, `worker.js` ni to'liq qo'ying va yana **Deploy** ni bosing.
4. **Settings → Variables and Secrets** bo'limiga qo'shing:

   | Nomi | Turi | Qiymati |
   |---|---|---|
   | `BOT_TOKEN` | Secret | BotFather bergan token |
   | `WEBHOOK_SECRET` | Secret | o'zingiz o'ylab topgan so'z, masalan `mnp75sirli2026` |
   | `SCHEDULE_URL` | Text | 2-qadamdagi Raw havola |
   | `CHAT_ID` | Text | hozircha bo'sh qoldiring (keyingi qadamda olinadi) |

5. **Settings → Trigger Events → Cron Triggers** ga `* * * * *` yozing (har daqiqa).

## 4-qadam. Botni Worker'ga ulash va chat ID olish
1. Brauzerda quyidagi manzilni oching (`<...>` o'rniga o'z qiymatlaringizni yozing):
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<worker-nomi>.<akkaunt>.workers.dev/webhook&secret_token=<WEBHOOK_SECRET>
   ```
   `"ok":true` chiqishi kerak.
2. Guruhda `/start` deb yozing. Bot **chat ID** ni yuboradi (`-100...` ko'rinishida).
3. Shu raqamni Cloudflare'dagi `CHAT_ID` ga yozing va saqlang.

## 5-qadam. Sinov
Brauzerda oching:
```
https://<worker-nomi>.<akkaunt>.workers.dev/test?secret=<WEBHOOK_SECRET>
```
Guruhga bugungi darslar ro'yxati kelsa, hammasi to'g'ri ishlayapti. ✅

Guruhda ishlaydigan buyruqlar: `/bugun`, `/ertaga`.

---

## Eslatmalar
- **Jadval o'zgarsa** (masalan 30.10 dan keyin yangisi chiqsa), GitHub uni tunda o'zi yangilaydi.
  Yangi jadval o'zining boshlanish sanasidan kuchga kiradi.
- **Boshqa guruh** uchun `update.yml` ga `env: GROUP: "MNP-76/23"` qatorini qo'shing.
- **GitHub** repozitoriyda 60 kun hech qanday faollik bo'lmasa, avtomatik ishlarni to'xtatib qo'yishi mumkin.
  Bunday bo'lsa, xat yuboradi va **Actions** bo'limida bitta tugma bilan qayta yoqiladi.
- **Juft/toq hafta** darslari (hozir yo'q) uchun bot har hafta xabar yuboradi va oxiriga "har hafta emas" degan izoh qo'shadi.
