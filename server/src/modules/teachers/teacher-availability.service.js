const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const { addDays } = require("../checkins/checkin.dates");
const A = require("../mentor-bookings/availability.rules");
const R = require("../mentor-bookings/mentor-booking.rules");
const EducatorBusy = require("../mentor-bookings/educator-busy");

// The My Availability page (23 Nov 2026): the mentor's weekly hours laid over what's really on each
// date, whether families can book them, and saving the hours in one go.

const TABLE = "teacher_availability_slots";
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const Bookings = () => require("../mentor-bookings/mentor-booking.service");
const Checkins = () => require("../mentor-checkins/mentor-checkin.service");

const windowRow = (w) => ({ id: w.id, dayOfWeek: w.dayOfWeek, startTime: A.hhmm(w.startTime), endTime: A.hhmm(w.endTime) });
const loadWindows = async (teacherId) => (await db(TABLE).where({ teacherId }).select("id", "dayOfWeek", "startTime", "endTime")).map(windowRow);

// The booking rules of the workspace this mentor can be booked in: the first with bookings on.
async function bookingSettingsFor(teacher) {
  const hubIds = await db("teacher_hub_links").where({ teacherId: teacher.id }).pluck("hubId");
  const owners = new Set(hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).distinct("ownerAdminId").pluck("ownerAdminId") : []);
  if (teacher.createdByAdminId) owners.add(teacher.createdByAdminId);
  let first = null;
  for (const owner of [...owners].filter(Boolean)) {
    const settings = await Bookings().settingsFor(owner);
    if (settings.enabled) return settings;
    first = first || settings;
  }
  return first || R.DEFAULT_SETTINGS;
}

async function loadTeacher(teacherId) {
  const teacher = await db("teachers").where({ id: teacherId }).first("id", "status", "profilePublic", "createdByAdminId");
  if (!teacher) fail("Teacher not found", 404);
  return teacher;
}

// What stands between this mentor and being booked.
async function statusOf(teacher, windows, settings) {
  const checks = {
    hours: windows.length > 0,
    published: !!teacher.profilePublic,
    active: !["inactive", "removed", "in_training"].includes(teacher.status),
    open: !!settings.enabled,
  };
  const needsNewTime = Number((await db("mentor_bookings").where({ teacherId: teacher.id, status: "confirmed" }).whereNotNull("clashAt").count({ n: "*" }).first())?.n || 0);
  return { bookable: Object.values(checks).every(Boolean), checks, needsNewTime, noticeHours: settings.noticeHours, horizonDays: settings.horizonDays };
}

const TeacherAvailabilityService = {
  async status(teacherId) {
    const teacher = await loadTeacher(teacherId);
    const windows = await loadWindows(teacherId);
    return statusOf(teacher, windows, await bookingSettingsFor(teacher));
  },

  // One week of the planner. `detail` false (a hub's login) leaves out what the classes and
  // sessions are: a hub sees that the educator is busy, not where or with whom.
  async week(teacherId, { from = null, detail = true } = {}) {
    const teacher = await loadTeacher(teacherId);
    const windows = await loadWindows(teacherId);
    const settings = await bookingSettingsFor(teacher);
    const now = new Date();
    const today = R.kenyaNow(now).date;
    const dates = A.weekDates(from || today);
    const horizonEnd = addDays(today, settings.horizonDays);
    const rangeFrom = dates[0] < today ? dates[0] : today;
    const rangeTo = dates[6] > horizonEnd ? dates[6] : horizonEnd;

    const classes = await EducatorBusy.classTimes(teacherId, rangeFrom, rangeTo);
    const checkins = (await Checkins()._internal.busyFor([teacherId], rangeFrom, rangeTo, { withBookings: false, withClasses: false })).dated || [];
    const bookingRows = (await db("mentor_bookings").where({ teacherId }).whereIn("status", R.ACTIVE).whereBetween("date", [rangeFrom, rangeTo])
      .select("id", "learnerId", "date", "startTime", "endTime", "status", "holdExpiresAt", "clashAt", "courseName"))
      .map((b) => ({ ...b, date: String(b.date).slice(0, 10) }))
      .filter((b) => R.holdsTime(b, now));
    const learnerIds = [...new Set(bookingRows.map((b) => b.learnerId))];
    const learners = new Map((learnerIds.length ? await db("learners").whereIn("id", learnerIds).select("id", "firstName") : []).map((l) => [l.id, l.firstName]));

    const items = [
      ...classes.map((c) => ({
        kind: "class", date: c.date, startTime: c.startTime, endTime: c.endTime,
        title: detail ? c.courseName : "Class",
        subtitle: detail ? `${c.className}${c.covering ? " · covering" : ""}${c.undated ? " · no start date yet" : ""}` : "",
      })),
      ...checkins.map((c) => ({ kind: "checkin", date: String(c.date).slice(0, 10), startTime: A.hhmm(c.startTime), endTime: A.hhmm(c.endTime), title: "Parent check-in", subtitle: "" })),
      ...bookingRows.map((b) => ({
        kind: "booking", id: detail ? b.id : undefined, date: b.date, startTime: b.startTime, endTime: b.endTime,
        title: "Mentor session", subtitle: detail ? [learners.get(b.learnerId), b.courseName].filter(Boolean).join(" · ") : "",
        needsNewTime: !!b.clashAt, waitingForPayment: b.status === "held",
      })),
    ];

    const earliest = R.kenyaNow(new Date(now.getTime() + settings.noticeHours * 3600 * 1000));
    const days = dates.map((date) => {
      const dayItems = items.filter((i) => i.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { ...A.planDay({ date, windows, busy: items, earliest }), items: dayItems, busy: dayItems, isToday: date === today, isPast: date < today };
    });
    const suggestions = windows.length ? A.suggestReplacements(days) : [];
    const shortest = settings.lengths?.[0]?.minutes || 30;
    const nextOpen = R.freeSlots({ windows, minutes: shortest, busy: { dated: items }, noticeHours: settings.noticeHours, horizonDays: settings.horizonDays, now })[0] || null;

    return {
      teacherId,
      today,
      week: { from: dates[0], to: dates[6] },
      windows,
      days: days.map(({ busy, ...d }) => d),
      summary: A.summarise(days),
      nextOpen: nextOpen ? { date: nextOpen.date, startTime: nextOpen.startTime, endTime: nextOpen.endTime } : null,
      suggestions,
      status: await statusOf(teacher, windows, settings),
    };
  },

  // Saves the whole weekly pattern at once (joined and tidied), so a page's undo is one more save.
  async replace(teacherId, input) {
    const teacher = await loadTeacher(teacherId);
    if (teacher.status === "removed") fail("This educator has been removed", 409);
    const { windows, error } = A.normaliseWindows(input);
    if (error) fail(error);
    const now = new Date();
    const rows = windows.map((w) => ({ id: generateId(), teacherId, ...w, createdAt: now, updatedAt: now }));
    await db.transaction(async (trx) => {
      await trx(TABLE).where({ teacherId }).del();
      if (rows.length) await trx(TABLE).insert(rows);
    });
    return rows.map(windowRow);
  },
};

module.exports = TeacherAvailabilityService;
