"""Edupage'dan guruh jadvalini olib, ixcham jadval.json yaratadi.

GitHub Actions har kuni ishga tushiradi. Faqat standart kutubxona ishlatiladi.
"""
import json
import os
import sys
import urllib.request
from datetime import date, datetime, timezone, timedelta

SCHOOL = os.environ.get("SCHOOL", "tsue")
GROUP = os.environ.get("GROUP", "MNP-75/23")
OUT = os.environ.get("OUT", "jadval.json")
BASE = f"https://{SCHOOL}.edupage.org/timetable/server"
TASHKENT = timezone(timedelta(hours=5))


def call(path, func, args):
    body = json.dumps({"__args": args, "__gsh": "00000000"}).encode()
    req = urllib.request.Request(
        f"{BASE}/{path}?__func={func}",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))["r"]


def timetables():
    today = datetime.now(TASHKENT).date()
    # O'quv yili sentyabrda boshlanadi: 2026-2027 o'quv yili = 2026
    year = today.year if today.month >= 8 else today.year - 1
    data = call("ttviewer.js", "getTTViewerData", [None, year])
    return [t for t in data["regular"]["timetables"] if not t.get("hidden")]


def group_lessons(tt_num):
    tables = call("regulartt.js", "regularttGetData", [None, tt_num])["dbiAccessorRes"]["tables"]
    t = {tab["id"]: tab["data_rows"] for tab in tables}
    by_id = lambda name: {row["id"]: row for row in t[name]}
    subjects, teachers, rooms = by_id("subjects"), by_id("teachers"), by_id("classrooms")
    periods = {p["period"]: p for p in t["periods"]}

    cls = next((c for c in t["classes"] if c["name"] == GROUP), None)
    if cls is None:
        return None
    lessons = {l["id"]: l for l in t["lessons"] if cls["id"] in l["classids"]}

    result = []
    for card in t["cards"]:
        lesson = lessons.get(card["lessonid"])
        if not lesson or not card.get("days") or not card.get("period"):
            continue  # jadvalga hali qo'yilmagan dars
        start = periods[card["period"]]
        last_no = str(int(card["period"]) + int(lesson.get("durationperiods") or 1) - 1)
        end = periods.get(last_no, start)
        for day, flag in enumerate(card["days"]):
            if flag != "1":
                continue
            result.append({
                "kun": day,  # 0 = Dushanba
                "haftalar": card.get("weeks") or "1",
                "boshlanish": start["starttime"],
                "tugash": end["endtime"],
                "fan": subjects[lesson["subjectid"]]["name"],
                "xona": ", ".join(rooms[r]["name"] for r in card.get("classroomids", []) if r in rooms),
                "oqituvchi": ", ".join(teachers[x]["short"] for x in lesson.get("teacherids", []) if x in teachers),
            })
    result.sort(key=lambda d: (d["kun"], d["boshlanish"]))
    return result


def main():
    out = []
    for tt in timetables():
        lessons = group_lessons(tt["tt_num"])
        if lessons is None:
            print(f"{tt['tt_num']}: '{GROUP}' guruhi topilmadi", file=sys.stderr)
            continue
        out.append({"tt_num": tt["tt_num"], "nomi": tt["text"], "boshlanadi": tt["datefrom"], "darslar": lessons})
        print(f"{tt['tt_num']} ({tt['text']}): {len(lessons)} ta dars")
    if not out:
        sys.exit("Hech qanday jadval topilmadi, eski fayl o'zgartirilmadi")
    out.sort(key=lambda x: x["boshlanadi"])
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"guruh": GROUP, "jadvallar": out}, f, ensure_ascii=False, indent=1)
        f.write("\n")


if __name__ == "__main__":
    main()
