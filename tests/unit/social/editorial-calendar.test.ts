import { describe, expect, it } from "vitest";
import { calendarRange, editorialHref, localDateTime, localDayKey, plannedDateIso, shiftCalendar } from "@/domain/social/editorial-calendar";

describe("editorial calendar date boundaries", () => {
  it("shows a full Monday-Sunday week across a year boundary", () => {
    const range = calendarRange("2027-01-01", "week");
    expect(range.days.map(localDayKey)).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
    expect(localDayKey(new Date(range.to))).toBe("2027-01-04");
    expect(new Date(range.to).getHours()).toBe(0);
  });
  it("includes leap day and rounds the month to complete weeks", () => {
    const range = calendarRange("2028-02-29", "month");
    expect(range.days.some((d) => localDayKey(d) === "2028-02-29")).toBe(true);
    expect(range.days[0].getDay()).toBe(1);
    expect(range.days[range.days.length - 1].getDay()).toBe(0);
    expect(range.days.length % 7).toBe(0);
    expect(new Set(range.days.map(localDayKey)).size).toBe(range.days.length);
  });
  it("navigates from the 31st without skipping the following month", () => {
    expect(shiftCalendar("2026-01-31", "month", 1)).toBe("2026-02-01");
    expect(shiftCalendar("2026-12-31", "month", 1)).toBe("2027-01-01");
    expect(shiftCalendar("2026-03-30", "week", -1)).toBe("2026-03-23");
  });
  it("preserves local wall time when loading and saving a stored ISO date", () => {
    const iso = new Date(2026, 9, 4, 9, 30).toISOString();
    expect(localDateTime(iso)).toBe("2026-10-04T09:30");
    expect(plannedDateIso(localDateTime(iso))).toBe(iso);
  });
  it("uses an exclusive end and calendar days during a daylight-saving week", () => {
    const range = calendarRange("2026-03-29", "week");
    expect(range.days.map(localDayKey)).toEqual(["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"]);
    expect(localDayKey(new Date(range.to))).toBe("2026-03-30");
    // This test suite is also run with TZ=Europe/Paris to exercise the 167-hour week.
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Paris") {
      expect((Date.parse(range.to) - Date.parse(range.from)) / 3_600_000).toBe(167);
      expect(() => plannedDateIso("2026-03-29T02:30")).toThrow();
      expect(plannedDateIso("2026-03-29T03:30")).toBe("2026-03-29T01:30:00.000Z");
    }
  });
  it("does not accept normalized impossible dates or silently convert malformed input", () => {
    expect(() => calendarRange("2026-02-30", "month")).toThrow();
    expect(() => plannedDateIso("2026-02-30T09:00")).toThrow();
    expect(() => plannedDateIso("not-a-date")).toThrow();
    expect(localDateTime("invalid")).toBe("");
    expect(plannedDateIso("")).toBeNull();
  });
  it("preserves campaign and workspace context in an encoded creation link", () => {
    const url = new URL(editorialHref({ campaignId: "c&1", workspaceId: "w/1", day: "2026-10-04" }), "https://test.invalid");
    expect(url.searchParams.get("campaignId")).toBe("c&1");
    expect(url.searchParams.get("workspaceId")).toBe("w/1");
    expect(url.searchParams.get("date")).toBe("2026-10-04");
    expect(editorialHref({ id: "post-id" })).toBe("/publication?edit=post-id");
  });
});
